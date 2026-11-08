#!/usr/bin/env python3
"""Build the app's explainable linear-regression growth research model."""

from __future__ import annotations

import hashlib
import json

from evaluate_linear_regression import DATASETS, fit_linear_regression, run
from train_growth_model import METRICS, ROOT, grouped_rows, interval_rates, load_csv


OUTPUT = ROOT.parent / "public" / "growth-model.json"
ALGORITHM_VERSION = "weighted-linear-log-growth-v1"


def train() -> dict:
    rows = [row for name, path in DATASETS.items() for row in load_csv(path, name)]
    grouped = grouped_rows(rows)
    normalized = sorted(rows, key=lambda row: (row["source_cohort"], row["days_since_stocking"]))
    digest = hashlib.sha256(json.dumps(normalized, sort_keys=True).encode("utf-8")).hexdigest()[:12]
    gaps = [
        end["days_since_stocking"] - start["days_since_stocking"]
        for measurements in grouped.values()
        for start, end in zip(measurements, measurements[1:])
    ]
    evaluation = run()["results"]
    return {
        "schema_version": 2,
        "model_kind": "linear_regression",
        "model_version": f"milkfish-{ALGORITHM_VERSION}-{digest}",
        "model_name": "Cohort-weighted linear regression on daily log growth",
        "target_horizon_days": 7,
        "formula": "predicted_daily_rate = intercept + slope * ln(latest_value); forecast = latest_value * exp(predicted_daily_rate * days)",
        "outputs": {metric: fit_linear_regression(grouped, metric) for metric in METRICS},
        "training_data": {
            "measurement_count": len(rows),
            "cohort_count": len(grouped),
            "transition_count": sum(len(interval_rates(measurements, "avg_weight_g")) for measurements in grouped.values()),
            "sources": list(DATASETS),
            "day_gaps_between_measurements": {"min": min(gaps), "max": max(gaps)},
        },
        "validation": {
            "method": "Leave one published study out; each candidate is fitted on the other two studies",
            "status": "mixed_results_not_reliably_accurate",
            "note": "Better on laboratory fry, worse on held-out ponds. Errors describe their observed gaps; they are not a universal accuracy percentage.",
            "held_out_mae": {
                study: {
                    metric: result[metric]["mae"]["linear_regression"]
                    for metric in METRICS
                }
                for study, result in evaluation.items()
            },
        },
        "seven_day_validation": {
            "status": "not_validated",
            "note": "Seven-day evidence is from four fry pools in one laboratory experiment, not independent fingerling or grow-out ponds.",
        },
        "sources": [
            {
                "title": "The feasibility of milkfish (Chanos chanos) aquaculture in Solomon Islands",
                "publisher": "WorldFish", "year": 2016, "license": "CC BY 4.0",
                "url": "https://digitalarchive.worldfishcenter.org/items/d63bc10f-eec1-4053-86c9-08106a92c55e",
            },
            {
                "title": "Milkfish Culture and Pond Management",
                "publisher": "FAO", "year": 1976,
                "url": "https://www.fao.org/4/H9727E/H9727E00.htm",
            },
            {
                "title": "The Study of Improvement of The Milkfish Culture In Deep-water Pond",
                "publisher": "Taiwan Fisheries Research Institute", "year": 1980,
                "url": "https://www.tfrin.gov.tw/redirect_files.php?file_name=q88wWFUpoNJMkVpXz72LguwFXwfC75NsSUaZLhF4v9ET7DowsTWGPluskLaLAR2QW6m6S&id=10300",
            },
        ],
    }


if __name__ == "__main__":
    model = train()
    OUTPUT.write_text(json.dumps(model, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "model_version": model["model_version"], "model_kind": model["model_kind"]}, indent=2))
