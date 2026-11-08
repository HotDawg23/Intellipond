"""Export the evaluated Random Forest as a browser-readable research model.

Usage: python ml/train_mortality_model.py path/to/water_quality.csv
The source CSV is downloaded separately and is never committed.
"""

import argparse
import hashlib
import json
from pathlib import Path
from statistics import median

from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer

from evaluate_visit_mortality import FEATURES, load_visits, make_pairs


REVIEWED_SOURCE_SHA256 = "41e70a84a8b45c6884cff805d1a4270260320b78c0b25bbeb48ca90e54fa8ebd"


def export_model(source: Path, destination: Path):
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if source_hash != REVIEWED_SOURCE_SHA256:
        raise ValueError("Source CSV differs from the reviewed Fish Welfare Initiative data")

    pairs = make_pairs(load_visits(source)[0])
    inputs = [pair["features"] for pair in pairs]
    labels = [pair["label"] for pair in pairs]
    imputer = SimpleImputer(strategy="median")
    fitted_inputs = imputer.fit_transform(inputs)
    forest = RandomForestClassifier(
        n_estimators=200, min_samples_leaf=5,
        class_weight="balanced_subsample", random_state=42, n_jobs=1,
    ).fit(fitted_inputs, labels)

    trees = []
    for estimator in forest.estimators_:
        tree = estimator.tree_
        nodes = []
        for index in range(tree.node_count):
            values = tree.value[index][0]
            positive = float(values[1] / sum(values)) if sum(values) else 0.0
            nodes.append([
                int(tree.feature[index]), float(tree.threshold[index]),
                int(tree.children_left[index]), int(tree.children_right[index]), positive,
            ])
        trees.append(nodes)

    model = {
        "model_type": "Random Forest classifier",
        "target": "Any deaths reported by the next recorded farm visit",
        "source": "Fish Welfare Initiative Farm Data India, water_quality.csv",
        "source_url": "https://github.com/fish-welfare-initiative/fwi-farm-data-india",
        "source_sha256": source_hash,
        "training_pairs": len(pairs),
        "training_ponds": len({pair["pond"] for pair in pairs}),
        "positive_pairs": sum(labels),
        "median_visit_gap_days": median(pair["gap_days"] for pair in pairs),
        "features": FEATURES,
        "imputer_medians": [float(value) for value in imputer.statistics_],
        "decision_threshold": 0.5,
        "trees": trees,
    }
    version_source = json.dumps(model, sort_keys=True, separators=(",", ":")).encode()
    model["version"] = hashlib.sha256(version_source).hexdigest()[:16]
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(model, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {destination} (version {model['version']}, {len(trees)} trees)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--output", type=Path, default=Path("public/mortality-model.json"))
    arguments = parser.parse_args()
    export_model(arguments.csv, arguments.output)
