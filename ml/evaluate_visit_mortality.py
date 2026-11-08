"""Evaluate next-visit mortality on Fish Welfare Initiative farm visits.

Usage: python ml/evaluate_visit_mortality.py path/to/water_quality.csv
Requires scikit-learn. The source CSV stays outside this repository.
"""

import argparse
from collections import Counter, defaultdict
import csv
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
from statistics import median

from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, precision_score, recall_score
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


FEATURES = ("do_mg_l", "ph", "temperature_c", "previous_dead")


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def median_or_none(values):
    values = [value for value in values if value is not None]
    return median(values) if values else None


def load_visits(path):
    grouped = defaultdict(list)
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            if not row["pond_id"] or not row["Date of data collection"]:
                continue
            if row["Dead fish"] == "":
                continue  # Missing is not a zero-death observation.
            date = datetime.strptime(row["Date of data collection"], "%m/%d/%Y").date()
            dead = number(row["Dead fish"])
            if dead is None or dead < 0:
                continue
            grouped[row["pond_id"], date].append(row)

    visits = defaultdict(list)
    for (pond, date), rows in grouped.items():
        # Repeated observations on one day are one visit. The maximum reported
        # death count avoids multiplying the same mortality report by sensor rows.
        dead = max(number(row["Dead fish"]) for row in rows)
        temperature_key = next(key for key in rows[0] if key.startswith("Temp (in "))
        def measured(key, low, high):
            return median_or_none([
                value if value is not None and low <= value <= high else None
                for value in (number(row[key]) for row in rows)
            ])
        visits[pond].append({
            "date": date,
            "dead": dead,
            "do_mg_l": measured("DO (mg/L)", 0.1, 30),
            "ph": measured("pH", 3, 12),
            "temperature_c": measured(temperature_key, 5, 45),
            "species": next((row["Species"] for row in rows if row["Species"]), "Unspecified"),
        })
    return visits, len(grouped)


def make_pairs(visits):
    pairs = []
    for pond, observations in visits.items():
        ordered = sorted(observations, key=lambda visit: visit["date"])
        for previous, following in zip(ordered, ordered[1:]):
            gap = (following["date"] - previous["date"]).days
            if not 1 <= gap <= 60 or all(previous[key] is None for key in FEATURES[:3]):
                continue
            pairs.append({
                "pond": pond,
                "species": previous["species"],
                "gap_days": gap,
                "features": [previous[key] for key in FEATURES[:3]] + [previous["dead"]],
                "label": int(following["dead"] > 0),
            })
    return pairs


def scores(y_true, y_pred):
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
        "positive_precision": round(precision_score(y_true, y_pred, zero_division=0), 3),
        "positive_recall": round(recall_score(y_true, y_pred, zero_division=0), 3),
    }


def evaluate(path):
    visits, visit_count = load_visits(path)
    pairs = make_pairs(visits)
    if not pairs:
        raise ValueError("No valid successive-visit records found")
    y = [pair["label"] for pair in pairs]
    groups = [pair["pond"] for pair in pairs]
    folds = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    predictions = {name: [None] * len(pairs) for name in ("always_no_deaths", "logistic_regression", "random_forest")}
    fold_sizes = []
    for train, test in folds.split([pair["features"] for pair in pairs], y, groups):
        x_train = [pairs[i]["features"] for i in train]
        y_train = [y[i] for i in train]
        x_test = [pairs[i]["features"] for i in test]
        models = {
            "logistic_regression": make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)),
            "random_forest": make_pipeline(SimpleImputer(strategy="median"), RandomForestClassifier(n_estimators=200, min_samples_leaf=5, class_weight="balanced_subsample", random_state=42, n_jobs=1)),
        }
        for i in test:
            predictions["always_no_deaths"][i] = 0
        for name, model in models.items():
            model.fit(x_train, y_train)
            for i, predicted in zip(test, model.predict(x_test)):
                predictions[name][i] = int(predicted)
        fold_sizes.append({
            "train_ponds": len({groups[i] for i in train}),
            "test_ponds": len({groups[i] for i in test}),
            "test_pairs": len(test),
            "test_positive": sum(y[i] for i in test),
        })
    if any(value is None for result in predictions.values() for value in result):
        raise ValueError("A pond was not assigned a held-out fold")
    results = {name: scores(y, result) for name, result in predictions.items()}
    return {
        "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "target": "Any deaths found by the next recorded visit, not a 24-hour mortality rate",
        "features": FEATURES,
        "source_visits": visit_count,
        "source_ponds": len(visits),
        "pairs": len(pairs),
        "pair_positive": sum(y),
        "gap_days_median": median(pair["gap_days"] for pair in pairs),
        "evaluation": "Five-fold grouped cross-validation; each pond held out exactly once",
        "folds": fold_sizes,
        "species": Counter(pair["species"] for pair in pairs),
        "results": results,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    args = parser.parse_args()
    print(json.dumps(evaluate(args.csv), indent=2))
