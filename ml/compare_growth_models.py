#!/usr/bin/env python3
"""Compare growth approaches on identical held-out pond intervals."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from pathlib import Path

from train_growth_model import (
    METRICS, PUBLIC_DATA, ROOT, cohort_rate_map, grouped_rows,
    interval_rates, load_csv, summarize_rates, train,
)


def linear_daily_gain(groups: dict[str, list[dict]], metric: str) -> float | None:
    """Give each training pond equal weight, even if it has more samples."""
    gains = []
    for measurements in groups.values():
        intervals = interval_rates(measurements, metric)
        if intervals:
            gains.append(statistics.median(
                (interval["end"] - interval["start"]) / interval["days"]
                for interval in intervals
            ))
    return statistics.median(gains) if gains else None


def evaluate(worldfish_rows: list[dict], bfar_rows: list[dict]) -> dict:
    if any(not row["source_cohort"].startswith("BFAR-") for row in bfar_rows):
        raise ValueError("Every private cohort must start with BFAR-")
    public = grouped_rows(worldfish_rows)
    private = grouped_rows(bfar_rows)
    combined = grouped_rows(worldfish_rows + bfar_rows)
    if set(public) & set(private):
        raise ValueError("Public and BFAR cohort IDs must be distinct")

    results = {}
    for scope, test_cohorts in (("all", combined), ("worldfish", public), ("bfar_fingerling", private)):
        results[scope] = {}
        for metric in METRICS:
            errors = {name: [] for name in (
                "worldfish_only", "worldfish_plus_bfar", "bfar_only",
                "pooled_linear", "bfar_linear", "unchanged_value", "recent_growth", "recent_linear",
            )}
            paired_errors = {name: [] for name in errors}
            interval_predictions = []
            for held_out, measurements in sorted(test_cohorts.items()):
                training_groups = {
                    "worldfish_only": {key: value for key, value in public.items() if key != held_out},
                    "worldfish_plus_bfar": {key: value for key, value in combined.items() if key != held_out},
                    "bfar_only": {key: value for key, value in private.items() if key != held_out},
                }
                models = {
                    name: summarize_rates(cohort_rate_map(groups, metric)) if groups else None
                    for name, groups in training_groups.items()
                }
                linear_models = {
                    "pooled_linear": linear_daily_gain(training_groups["worldfish_plus_bfar"], metric),
                    "bfar_linear": linear_daily_gain(training_groups["bfar_only"], metric),
                }
                intervals = interval_rates(measurements, metric)
                for index, interval in enumerate(intervals):
                    start, actual, days = interval["start"], interval["end"], interval["days"]
                    predictions = {"unchanged_value": start}
                    for name, model in models.items():
                        if model is not None and (name != "bfar_only" or scope == "bfar_fingerling"):
                            predictions[name] = start * math.exp(model["daily_log_growth_median"] * days)
                    for name, gain in linear_models.items():
                        if gain is not None and (name != "bfar_linear" or scope == "bfar_fingerling"):
                            predictions[name] = max(0.0, start + gain * days)
                    if index > 0:
                        prior = intervals[index - 1]
                        predictions["recent_growth"] = start * math.exp(prior["daily_log_rate"] * days)
                        predictions["recent_linear"] = max(0.0, start + (prior["end"] - prior["start"]) / prior["days"] * days)
                    interval_predictions.append({
                        "held_out_cohort": held_out,
                        "start_day": interval["start_day"], "end_day": interval["end_day"],
                        "actual": actual, "predictions": predictions,
                    })
                    for name, prediction in predictions.items():
                        error = abs(prediction - actual)
                        errors[name].append(error)
                        if "recent_growth" in predictions:
                            paired_errors[name].append(error)
            results[scope][metric] = {
                "unit": "g" if metric == "avg_weight_g" else "cm",
                "held_out_cohorts": len(test_cohorts),
                "intervals": sum(len(interval_rates(rows, metric)) for rows in test_cohorts.values()),
                "mae": {name: round(statistics.mean(values), 4) if values and not name.startswith("recent_") else None
                        for name, values in errors.items()},
                "evaluated_intervals": {name: len(values) for name, values in errors.items()},
                "paired_intervals": len(paired_errors["recent_growth"]),
                "paired_mae": {name: round(statistics.mean(values), 4) if values else None
                               for name, values in paired_errors.items()},
                "paired_evaluated_intervals": {name: len(values) for name, values in paired_errors.items()},
                "interval_predictions": interval_predictions,
            }
    report = {
        "comparison_algorithm": "cohort-log-and-linear-v2",
        "candidate_method": "median daily absolute gain per training cohort, then median across cohorts; predictions floored at zero",
        "release_status": "research_only_requires_independent_seven_day_validation",
        "method": "leave one entire pond cohort out; predict each observed interval at its actual duration",
        "warning": "These are 13- to 127-day interval errors, not seven-day forecast accuracy. The two BFAR ponds share one culture cycle.",
        "public_model_version": train(worldfish_rows)["model_version"],
        "expanded_model_version": train(worldfish_rows + bfar_rows)["model_version"],
        "seven_day_bfar_pairs": sum(
            interval["days"] == 7 for rows in private.values()
            for interval in interval_rates(rows, "avg_weight_g")
        ),
        "results": results,
    }
    report["comparison_version"] = hashlib.sha256(
        json.dumps(report, sort_keys=True).encode("utf-8")
    ).hexdigest()[:12]
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bfar-csv", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    repo = ROOT.parent.resolve()
    if args.bfar_csv.resolve().is_relative_to(repo) or args.output.resolve().is_relative_to(repo):
        parser.error("BFAR input and comparison output must stay outside the application repository")
    report = evaluate(
        load_csv(PUBLIC_DATA, "WorldFish 2016-07"),
        load_csv(args.bfar_csv, "BFAR supplied records"),
    )
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "comparison_version": report["comparison_version"],
                      "release_status": report["release_status"]}, indent=2))


if __name__ == "__main__":
    main()
