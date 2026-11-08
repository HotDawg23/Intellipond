"""The app artifact must match a deterministic public-data-only fit."""

import json
import unittest

from train_growth_model import ROOT
from train_linear_growth_model import OUTPUT, train


class LinearGrowthArtifactTests(unittest.TestCase):
    def test_generated_artifact_matches_public_training_and_validation(self):
        model = train()
        self.assertEqual(json.loads(OUTPUT.read_text(encoding="utf-8")), model)
        self.assertEqual(model["model_kind"], "linear_regression")
        self.assertEqual(model["training_data"]["cohort_count"], 9)
        self.assertEqual(model["validation"]["status"], "mixed_results_not_reliably_accurate")
        self.assertNotIn("BFAR", json.dumps(model["training_data"]["sources"]))
        self.assertTrue((ROOT / "models" / "pooled_log_rate_reference.json").exists())

    def test_same_inputs_produce_same_model_version(self):
        self.assertEqual(train()["model_version"], train()["model_version"])


if __name__ == "__main__":
    unittest.main()
