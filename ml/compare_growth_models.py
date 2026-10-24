#!/usr/bin/env python3
"""Compare growth approaches on identical held-out pond intervals."""

from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path

from train_growth_model import (
    METRICS, PUBLIC_DATA, ROOT, cohort_rate_map, grouped_rows,
    interval_rates, load_csv, summarize_rates, train,
)


def evaluate(worldfish_rows: list[dict], bfar_rows: list[dict]) -> dict:
    if any(not row["source_cohort"].startswith("BFAR-") for row in bfar_rows):
        raise ValueError("Every private cohort must start with BFAR-")
    public = grouped_rows(worldfish_rows)
    private = grouped_rows(bfar_rows)
    combined = grouped_rows(worldfish_rows + bfar_rows)
    if set(public) & set(private):
        raise ValueError("Public and BFAR cohort IDs must be distinct")

    results = {}
    for scope, test_cohorts in (("all", combined), ("bfar_fingerling", private)):
        results[scope] = {}
        for metric in METRICS:
            errors = {name: [] for name in (
                "worldfish_only", "worldfish_plus_bfar", "bfar_only",
                "unchanged_value", "recent_growth",
            )}
            paired_errors = {name: [] for name in errors}
            for held_out, measurements in test_cohorts.items():
                training_groups = {
                    "worldfish_only": {key: value for key, value in public.items() if key != held_out},
                    "worldfish_plus_bfar": {key: value for key, value in combined.items() if key != held_out},
                    "bfar_only": {key: value for key, value in private.items() if key != held_out},
                }
                models = {
                    name: summarize_rates(cohort_rate_map(groups, metric)) if groups else None
                    for name, groups in training_groups.items()
                }
                for index, interval in enumerate(interval_rates(measurements, metric)):
                    start, actual, days = interval["start"], interval["end"], interval["days"]
                    predictions = {"unchanged_value": start}
                    for name, model in models.items():
                        if model is not None and (name != "bfar_only" or scope == "bfar_fingerling"):
                            predictions[name] = start * math.exp(model["daily_log_growth_median"] * days)
                    if index > 0:
                        prior = interval_rates(measurements[:index + 1], metric)
                        if prior:
                            predictions["recent_growth"] = start * math.exp(prior[-1]["daily_log_rate"] * days)
                    for name, prediction in predictions.items():
                        error = abs(prediction - actual)
                        errors[name].append(error)
                        if "recent_growth" in predictions:
                            paired_errors[name].append(error)
            results[scope][metric] = {
                "unit": "g" if metric == "avg_weight_g" else "cm",
                "held_out_cohorts": len(test_cohorts),
                "intervals": sum(len(interval_rates(rows, metric)) for rows in test_cohorts.values()),
                "mae": {name: round(statistics.mean(values), 4) if values and name != "recent_growth" else None
                        for name, values in errors.items()},
                "paired_intervals": len(paired_errors["recent_growth"]),
                "paired_mae": {name: round(statistics.mean(values), 4) if values else None
                               for name, values in paired_errors.items()},
            }
    return {
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
    print(json.dumps({"output": str(args.output), "results": report["results"]}, indent=2))


if __name__ == "__main__":
    main()
