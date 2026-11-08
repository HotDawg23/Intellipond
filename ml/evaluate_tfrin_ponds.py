#!/usr/bin/env python3
"""External historical check of the frozen published growth model on two ponds."""

from __future__ import annotations

import json
import math
import statistics

from train_growth_model import METRICS, ROOT, grouped_rows, interval_rates, load_csv


DATA = ROOT / "data" / "tfrin_milkfish_pond_growth.csv"
PUBLISHED_MODEL = ROOT / "models" / "pooled_log_rate_reference.json"
SOURCE_URL = "https://www.tfrin.gov.tw/redirect_files.php?file_name=q88wWFUpoNJMkVpXz72LguwFXwfC75NsSUaZLhF4v9ET7DowsTWGPluskLaLAR2QW6m6S&id=10300"


def evaluate() -> dict:
    grouped = grouped_rows(load_csv(DATA, "TFRI Bulletin 32 (1980) Table 1"))
    expected_days = {
        "Taiwan-TFRI-Pond-I": [0, 21, 41, 63],
        "Taiwan-TFRI-Pond-II": [0, 21, 41, 63, 85, 105, 127, 149],
    }
    if {cohort: [row["days_since_stocking"] for row in rows] for cohort, rows in grouped.items()} != expected_days:
        raise ValueError("Unexpected ponds or measurement days in TFRI Table 1")

    published = json.loads(PUBLISHED_MODEL.read_text(encoding="utf-8"))
    result = {}
    for metric in METRICS:
        errors = {name: [] for name in ("published_model", "unchanged_value")}
        paired_errors = {name: [] for name in (*errors, "recent_linear_rate", "recent_log_rate")}
        examples = []
        for cohort, measurements in grouped.items():
            intervals = interval_rates(measurements, metric)
            for index, interval in enumerate(intervals):
                days, start, actual = interval["days"], interval["start"], interval["end"]
                predicted = start * math.exp(published["outputs"][metric]["daily_log_growth_median"] * days)
                predictions = {"published_model": predicted, "unchanged_value": start}
                for name, value in predictions.items():
                    error = abs(value - actual)
                    errors[name].append(error)
                    if index > 0:
                        paired_errors[name].append(error)
                if index > 0:
                    previous = intervals[index - 1]
                    recent_linear = max(0, start + (previous["end"] - previous["start"]) / previous["days"] * days)
                    recent_log = start * math.exp(previous["daily_log_rate"] * days)
                    paired_errors["recent_linear_rate"].append(abs(recent_linear - actual))
                    paired_errors["recent_log_rate"].append(abs(recent_log - actual))
                examples.append({
                    "pond": cohort,
                    "start_day": int(interval["start_day"]),
                    "target_day": int(interval["end_day"]),
                    "days": int(days),
                    "previous_measurement": round(start, 3),
                    "predicted": round(predicted, 3),
                    "observed": round(actual, 3),
                    "absolute_error": round(abs(predicted - actual), 3),
                })
        result[metric] = {
            "unit": "g" if metric == "avg_weight_g" else "cm (fork length)",
            "ponds": len(grouped),
            "transitions": len(errors["published_model"]),
            "mae": {name: round(statistics.mean(values), 4) for name, values in errors.items()},
            "paired_transitions": len(paired_errors["recent_linear_rate"]),
            "paired_mae": {name: round(statistics.mean(values), 4) for name, values in paired_errors.items()},
            "examples": examples,
        }
    return {
        "source": "Su and Ting (1980), Taiwan Fisheries Research Institute Bulletin 32, Table 1",
        "source_url": SOURCE_URL,
        "model_version": published["model_version"],
        "method": "Frozen WorldFish model; each earlier observation predicts the next reported observation; no TFRI rows used for model training",
        "scope": "Two deep-water ponds from one experiment; 20-22 day transitions; reported fork length",
        "metrics": result,
    }


if __name__ == "__main__":
    print(json.dumps(evaluate(), indent=2))
