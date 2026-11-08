#!/usr/bin/env python3
"""Exploratory seven-day evaluation on the FAO's four milkfish fry pools.

The four pools share one experiment, so these held-out pools are not an
independent external validation of predictions for pond batches.
"""

from __future__ import annotations

import json
import math
import statistics

from train_growth_model import ROOT, METRICS, grouped_rows, interval_rates, load_csv, summarize_rates, cohort_rate_map


FAO_DATA = ROOT / "data" / "fao_milkfish_fry_weekly.csv"
PUBLISHED_MODEL = ROOT / "models" / "pooled_log_rate_reference.json"


def evaluate() -> dict:
    grouped = grouped_rows(load_csv(FAO_DATA, "FAO Pedini 1976 Table 1"))
    expected_days = [7, 14, 21, 28]
    if len(grouped) != 4 or any(
        [row["days_since_stocking"] for row in measurements] != expected_days
        for measurements in grouped.values()
    ):
        raise ValueError("Expected four pools sampled on days 7, 14, 21, and 28")
    published = json.loads(PUBLISHED_MODEL.read_text(encoding="utf-8"))
    rates_by_metric = {metric: cohort_rate_map(grouped, metric) for metric in METRICS}
    results = {}
    for metric in METRICS:
        errors = {
            name: []
            for name in (
                "published_model",
                "fao_pooled_log_rate",
                "fao_pooled_linear_rate",
                "unchanged_value",
            )
        }
        paired_errors = {name: [] for name in (*errors, "recent_log_rate")}
        pool_errors = {}
        for cohort, measurements in grouped.items():
            held_out = interval_rates(measurements, metric)
            other_rates = {name: rates for name, rates in rates_by_metric[metric].items() if name != cohort}
            fao_log = summarize_rates(other_rates)
            if fao_log is None:
                raise ValueError("No training pools remain")
            fao_linear = statistics.median([
                statistics.median([
                    (interval["end"] - interval["start"]) / interval["days"]
                    for interval in rates
                ])
                for rates in other_rates.values()
            ])
            pool_errors[cohort] = {name: [] for name in errors}
            for index, interval in enumerate(held_out):
                if interval["days"] != 7:
                    raise ValueError("Unexpected sampling gap")
                start, actual = interval["start"], interval["end"]
                predictions = {
                    "published_model": start * math.exp(
                        published["outputs"][metric]["daily_log_growth_median"] * 7
                    ),
                    "fao_pooled_log_rate": start * math.exp(fao_log["daily_log_growth_median"] * 7),
                    "fao_pooled_linear_rate": max(0, start + fao_linear * 7),
                    "unchanged_value": start,
                }
                for name, prediction in predictions.items():
                    error = abs(prediction - actual)
                    errors[name].append(error)
                    pool_errors[cohort][name].append(error)
                    if index > 0:
                        paired_errors[name].append(error)
                if index > 0:
                    recent = start * math.exp(held_out[index - 1]["daily_log_rate"] * 7)
                    paired_errors["recent_log_rate"].append(abs(recent - actual))
        results[metric] = {
            "unit": "g" if metric == "avg_weight_g" else "cm",
            "held_out_pools": len(grouped),
            "seven_day_pairs": len(errors["published_model"]),
            "mae": {name: round(statistics.mean(values), 6) for name, values in errors.items()},
            "paired_pairs": len(paired_errors["recent_log_rate"]),
            "paired_mae": {name: round(statistics.mean(values), 6) for name, values in paired_errors.items()},
            "pool_mae": {
                cohort: {name: round(statistics.mean(values), 6) for name, values in methods.items()}
                for cohort, methods in pool_errors.items()
            },
        }
    return {
        "source": "M. Pedini (1976), Milkfish Culture and Pond Management, FAO, Table 1",
        "source_url": "https://www.fao.org/4/H9727E/H9727E00.htm",
        "published_model_version": published["model_version"],
        "method": (
            "Leave one FAO pool out for FAO-trained methods; published model frozen; "
            "starts at week 1 because day 0 is a shared initial mean, "
            "not a per-pool observation"
        ),
        "scope": "Milkfish fry in four laboratory pools from one experiment, days 7-28; exploratory only",
        "metrics": results,
    }


if __name__ == "__main__":
    print(json.dumps(evaluate(), indent=2))
