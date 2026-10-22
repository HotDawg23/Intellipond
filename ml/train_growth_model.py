#!/usr/bin/env python3
"""Train a small, explainable Bangus growth-rate reference model."""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
PUBLIC_DATA = ROOT / "data" / "worldfish_milkfish_growth.csv"
DEFAULT_OUTPUT = ROOT.parent / "public" / "growth-model.json"
METRICS = ("avg_weight_g", "avg_length_cm")


def load_csv(path: Path, default_source: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required = {"source_cohort", "days_since_stocking", *METRICS}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path}: missing required columns: {', '.join(sorted(missing))}")

        for line_number, row in enumerate(reader, start=2):
            try:
                cohort = (row.get("source_cohort") or "").strip()
                day = int(row["days_since_stocking"])
                if not cohort or day < 0:
                    raise ValueError("cohort is required and day must be nonnegative")
                parsed: dict[str, Any] = {
                    "source_cohort": cohort,
                    "days_since_stocking": day,
                    "source": (row.get("source") or default_source).strip(),
                }
                for metric in METRICS:
                    raw = (row.get(metric) or "").strip()
                    value = float(raw) if raw else None
                    if value is not None and (not math.isfinite(value) or value <= 0):
                        raise ValueError(f"{metric} must be a positive finite number when supplied")
                    parsed[metric] = value
                rows.append(parsed)
            except (TypeError, ValueError) as error:
                raise ValueError(f"{path}:{line_number}: {error}") from error

    return rows


def grouped_rows(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row["source_cohort"]].append(row)
    for cohort, measurements in grouped.items():
        measurements.sort(key=lambda row: row["days_since_stocking"])
        days = [row["days_since_stocking"] for row in measurements]
        if len(days) != len(set(days)):
            raise ValueError(f"{cohort}: duplicate measurement day")
    return dict(grouped)


def quantile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = fraction * (len(ordered) - 1)
    lower = math.floor(position)
    upper = math.ceil(position)
    portion = position - lower
    return ordered[lower] * (1 - portion) + ordered[upper] * portion


def interval_rates(measurements: list[dict[str, Any]], metric: str) -> list[dict[str, float]]:
    rates: list[dict[str, float]] = []
    for start, end in zip(measurements, measurements[1:]):
        days = end["days_since_stocking"] - start["days_since_stocking"]
        start_value, end_value = start[metric], end[metric]
        if days <= 0 or start_value is None or end_value is None:
            continue
        rates.append({
            "start_day": float(start["days_since_stocking"]),
            "end_day": float(end["days_since_stocking"]),
            "days": float(days),
            "start": float(start_value),
            "end": float(end_value),
            "daily_log_rate": math.log(float(end_value) / float(start_value)) / days,
        })
    return rates


def cohort_rate_map(grouped: dict[str, list[dict[str, Any]]], metric: str) -> dict[str, list[dict[str, float]]]:
    return {cohort: interval_rates(measurements, metric) for cohort, measurements in grouped.items()}


def summarize_rates(rates_by_cohort: dict[str, list[dict[str, float]]], excluded: str | None = None) -> dict[str, float] | None:
    cohort_rates = [
        statistics.median(interval["daily_log_rate"] for interval in intervals)
        for cohort, intervals in rates_by_cohort.items()
        if cohort != excluded and intervals
    ]
    if not cohort_rates:
        return None
    return {
        "daily_log_growth_median": statistics.median(cohort_rates),
        "daily_log_growth_p10": quantile(cohort_rates, 0.10),
        "daily_log_growth_p90": quantile(cohort_rates, 0.90),
        "cohort_count": len(cohort_rates),
    }


def evaluate_long_intervals(
    grouped: dict[str, list[dict[str, Any]]],
    rates_by_metric: dict[str, dict[str, list[dict[str, float]]]],
) -> dict[str, Any]:
    report: dict[str, Any] = {
        "method": "leave-one-cohort-out; each test interval retains its observed duration",
        "forecast_horizon_days": None,
        "note": "The published measurements are months apart; these errors do not validate a seven-day forecast.",
        "metrics": {},
    }
    for metric in METRICS:
        model_errors: list[float] = []
        persistence_errors: list[float] = []
        test_intervals = 0
        for cohort, measurements in grouped.items():
            model = summarize_rates(rates_by_metric[metric], excluded=cohort)
            if model is None:
                continue
            for index, interval in enumerate(interval_rates(measurements, metric)):
                predicted = interval["start"] * math.exp(model["daily_log_growth_median"] * interval["days"])
                model_errors.append(abs(predicted - interval["end"]))
                test_intervals += 1
                if index > 0:
                    previous = interval_rates(measurements[: index + 2], metric)
                    if len(previous) >= 2:
                        recent_rate = previous[-2]["daily_log_rate"]
                        baseline = interval["start"] * math.exp(recent_rate * interval["days"])
                        persistence_errors.append(abs(baseline - interval["end"]))
        report["metrics"][metric] = {
            "held_out_intervals": test_intervals,
            "model_mae": round(statistics.mean(model_errors), 4) if model_errors else None,
            "recent_rate_baseline_mae": round(statistics.mean(persistence_errors), 4) if persistence_errors else None,
            "baseline_intervals": len(persistence_errors),
            "unit": "g" if metric == "avg_weight_g" else "cm",
        }
    return report


def evaluate_seven_day_bfar(
    grouped: dict[str, list[dict[str, Any]]],
    rates_by_metric: dict[str, dict[str, list[dict[str, float]]]],
) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    validation_cohorts: set[str] = set()

    for metric in METRICS:
        model_errors: list[float] = []
        recent_rate_errors: list[float] = []
        tested_cohorts: set[str] = set()

        for cohort, measurements in grouped.items():
            if not cohort.startswith("BFAR-"):
                continue
            intervals = interval_rates(measurements, metric)
            training_model = summarize_rates(rates_by_metric[metric], excluded=cohort)
            if training_model is None:
                continue

            for index, interval in enumerate(intervals):
                if interval["days"] != 7:
                    continue
                predicted = interval["start"] * math.exp(training_model["daily_log_growth_median"] * 7)
                model_errors.append(abs(predicted - interval["end"]))
                tested_cohorts.add(cohort)
                validation_cohorts.add(cohort)

                if index > 0:
                    recent_rate = intervals[index - 1]["daily_log_rate"]
                    baseline = interval["start"] * math.exp(recent_rate * 7)
                    recent_rate_errors.append(abs(baseline - interval["end"]))

        metrics[metric] = {
            "held_out_cohorts": len(tested_cohorts),
            "seven_day_pairs": len(model_errors),
            "model_mae": round(statistics.mean(model_errors), 4) if model_errors else None,
            "recent_rate_baseline_mae": round(statistics.mean(recent_rate_errors), 4) if recent_rate_errors else None,
            "baseline_pairs": len(recent_rate_errors),
            "unit": "g" if metric == "avg_weight_g" else "cm",
        }

    passed = all(
        metrics[metric]["held_out_cohorts"] >= 3
        and metrics[metric]["recent_rate_baseline_mae"] is not None
        and metrics[metric]["model_mae"] < metrics[metric]["recent_rate_baseline_mae"]
        for metric in METRICS
    )
    return {
        "status": "validated" if passed else "not_validated",
        "holdout_method": "leave-one-BFAR-cohort-out",
        "minimum_held_out_cohorts": 3,
        "note": "Requires exact seven-day measurement pairs from at least three separate BFAR stocking batches, with lower error than the recent-rate baseline for both measurements.",
        "metrics": metrics,
        "tested_bfar_cohorts": len(validation_cohorts),
    }


def train(rows: list[dict[str, Any]]) -> dict[str, Any]:
    grouped = grouped_rows(rows)
    rates = {metric: cohort_rate_map(grouped, metric) for metric in METRICS}
    summaries = {metric: summarize_rates(rates[metric]) for metric in METRICS}
    if any(summary is None for summary in summaries.values()):
        raise ValueError("Training needs at least two positive measurements per metric in at least one cohort")

    observed_gaps = [
        end["days_since_stocking"] - start["days_since_stocking"]
        for measurements in grouped.values()
        for start, end in zip(measurements, measurements[1:])
    ]
    sources = sorted({row["source"] for row in rows if row["source"]})
    local_cohorts = sorted({row["source_cohort"] for row in rows if row["source_cohort"].startswith("BFAR-")})
    return {
        "schema_version": 1,
        "model_version": "2026-10-public-milkfish-reference-v1",
        "model_name": "Pooled median daily log-growth rate",
        "target_horizon_days": 7,
        "outputs": {
            "avg_weight_g": summaries["avg_weight_g"],
            "avg_length_cm": summaries["avg_length_cm"],
        },
        "training_data": {
            "measurement_count": len(rows),
            "cohort_count": len(grouped),
            "transition_count": sum(len(values) for values in rates["avg_weight_g"].values()),
            "sources": sources,
            "bfar_cohort_count": len(local_cohorts),
            "day_gaps_between_measurements": {
                "min": min(observed_gaps),
                "max": max(observed_gaps),
            } if observed_gaps else None,
        },
        "validation": evaluate_long_intervals(grouped, rates),
        "seven_day_validation": evaluate_seven_day_bfar(grouped, rates),
        "sources": [
            {
                "title": "The feasibility of milkfish (Chanos chanos) aquaculture in Solomon Islands",
                "publisher": "WorldFish",
                "year": 2016,
                "license": "CC BY 4.0",
                "url": "https://digitalarchive.worldfishcenter.org/items/d63bc10f-eec1-4053-86c9-08106a92c55e",
            }
        ],
        "training_sources": sources,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bfar-csv", type=Path, help="Optional private BFAR CSV in the documented column format")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    rows = load_csv(PUBLIC_DATA, "WorldFish 2016-07")
    if args.bfar_csv:
        rows.extend(load_csv(args.bfar_csv, "BFAR supplied records"))
    model = train(rows)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(model, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "model_version": model["model_version"],
        "measurement_count": model["training_data"]["measurement_count"],
        "cohort_count": model["training_data"]["cohort_count"],
        "seven_day_validation": model["seven_day_validation"]["status"],
        "validation": model["validation"]["metrics"],
    }, indent=2))


if __name__ == "__main__":
    main()
