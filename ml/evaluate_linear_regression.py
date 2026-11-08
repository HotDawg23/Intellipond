#!/usr/bin/env python3
"""Evaluate an age-normalized linear regression against frozen growth forecasts.

The regression target is daily log growth. Its single input is log(latest
measurement), so it can predict from the same information the app has today.
Each pond contributes equal total weight to the least-squares fit.
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path

from train_growth_model import METRICS, ROOT, grouped_rows, interval_rates, load_csv


DATASETS = {
    "FAO fry pools": ROOT / "data" / "fao_milkfish_fry_weekly.csv",
    "TFRI deep-water ponds": ROOT / "data" / "tfrin_milkfish_pond_growth.csv",
    "WorldFish grow-out ponds": ROOT / "data" / "worldfish_milkfish_growth.csv",
}
PUBLISHED = ROOT / "models" / "pooled_log_rate_reference.json"


def fit_linear_regression(cohorts: dict[str, list[dict]], metric: str) -> dict[str, float]:
    """Weighted ordinary least squares of daily log rate on log(start value)."""
    points = []
    for measurements in cohorts.values():
        intervals = interval_rates(measurements, metric)
        for interval in intervals:
            points.append((math.log(interval["start"]), interval["daily_log_rate"], 1 / len(intervals)))
    if len(points) < 2:
        raise ValueError("At least two growth intervals are required")
    total_weight = sum(weight for _, _, weight in points)
    x_mean = sum(x * weight for x, _, weight in points) / total_weight
    y_mean = sum(y * weight for _, y, weight in points) / total_weight
    variance = sum(weight * (x - x_mean) ** 2 for x, _, weight in points)
    if variance == 0:
        raise ValueError("Training measurements need different starting values")
    slope = sum(weight * (x - x_mean) * (y - y_mean) for x, y, weight in points) / variance
    return {"intercept": y_mean - slope * x_mean, "slope": slope}


def predict(model: dict[str, float], start: float, days: float) -> float:
    rate = model["intercept"] + model["slope"] * math.log(start)
    try:
        value = start * math.exp(rate * days)
    except OverflowError:
        return math.inf
    return value


def evaluate(
    test: dict[str, list[dict]], training: dict[str, list[dict]], published: dict,
    published_is_external: bool = True,
) -> dict:
    if set(test) & set(training):
        raise ValueError("Test ponds cannot appear in regression training")
    output = {}
    for metric in METRICS:
        model = fit_linear_regression(training, metric)
        errors = {name: [] for name in ("linear_regression", "published_model", "unchanged_value")}
        paired = {name: [] for name in (*errors, "recent_linear_rate")}
        for measurements in test.values():
            intervals = interval_rates(measurements, metric)
            for index, interval in enumerate(intervals):
                start, actual, days = interval["start"], interval["end"], interval["days"]
                predictions = {
                    "linear_regression": predict(model, start, days),
                    "unchanged_value": start,
                }
                if published_is_external:
                    predictions["published_model"] = start * math.exp(
                        published["outputs"][metric]["daily_log_growth_median"] * days
                    )
                for name, value in predictions.items():
                    error = abs(value - actual)
                    errors[name].append(error)
                    if index > 0:
                        paired[name].append(error)
                if index > 0:
                    previous = intervals[index - 1]
                    recent = max(0, start + (previous["end"] - previous["start"]) / previous["days"] * days)
                    paired["recent_linear_rate"].append(abs(recent - actual))
        output[metric] = {
            "unit": "g" if metric == "avg_weight_g" else "cm (source-specific length definition)",
            "training_ponds": len(training),
            "test_ponds": len(test),
            "test_intervals": len(errors["linear_regression"]),
            "observed_gap_days": sorted({int(interval["days"]) for rows in test.values() for interval in interval_rates(rows, metric)}),
            "coefficients": {key: round(value, 8) for key, value in model.items()},
            "mae": {name: round(statistics.mean(values), 6) if values else None for name, values in errors.items()},
            "paired_intervals": len(paired["recent_linear_rate"]),
            "paired_mae": {name: round(statistics.mean(values), 6) if values else None for name, values in paired.items()},
        }
    return output


def run(private_bfar: Path | None = None) -> dict:
    studies = {
        name: grouped_rows(load_csv(path, name))
        for name, path in DATASETS.items()
    }
    published = json.loads(PUBLISHED.read_text(encoding="utf-8"))
    results = {}
    for held_out, test in studies.items():
        training = {cohort: rows for name, groups in studies.items() if name != held_out for cohort, rows in groups.items()}
        results[held_out] = evaluate(
            test, training, published,
            published_is_external=held_out != "WorldFish grow-out ponds",
        )
    if private_bfar is not None:
        test = grouped_rows(load_csv(private_bfar, "Private BFAR biometric sampling"))
        if any(not cohort.startswith("BFAR-") for cohort in test):
            raise ValueError("Private cohort IDs must start with BFAR-")
        training = {cohort: rows for groups in studies.values() for cohort, rows in groups.items()}
        results["BFAR private external check"] = evaluate(test, training, published)
    return {
        "candidate": "cohort-weighted ordinary least squares: daily log growth = intercept + slope * log(latest value)",
        "forecast_formula": "latest value * exp(predicted daily log growth * horizon days)",
        "published_model_version": published["model_version"],
        "method": "leave one whole published study out; no test study used to fit its candidate; BFAR optional and entirely held out",
        "warning": "Published model was trained on WorldFish, so its WorldFish error is omitted rather than presented as external validation. Sources differ by fish stage, gap, and length definition.",
        "results": results,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bfar-csv", type=Path, help="Optional private BFAR file; never stored in the repository")
    args = parser.parse_args()
    print(json.dumps(run(args.bfar_csv), indent=2, allow_nan=False))
