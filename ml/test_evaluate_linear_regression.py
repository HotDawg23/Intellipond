"""Checks for the held-out growth regression evaluation."""

import math
import unittest

from evaluate_linear_regression import evaluate, fit_linear_regression, run
from train_growth_model import grouped_rows


def cohort(name: str, start: float, daily_rate: float) -> list[dict]:
    return [
        {"source_cohort": name, "days_since_stocking": day,
         "avg_weight_g": value, "avg_length_cm": value}
        for day, value in ((0, start), (7, start * math.exp(daily_rate * 7)))
    ]


class LinearRegressionEvaluationTests(unittest.TestCase):
    def test_recovers_known_linear_relationship_and_excludes_test_pond(self):
        training = grouped_rows([
            *cohort("train-a", 1, 0.01),
            *cohort("train-b", math.e, 0.012),
        ])
        model = fit_linear_regression(training, "avg_weight_g")
        self.assertAlmostEqual(model["intercept"], 0.01)
        self.assertAlmostEqual(model["slope"], 0.002)
        with self.assertRaisesRegex(ValueError, "Test ponds cannot appear"):
            evaluate(training, training, {"outputs": {}})

    def test_published_model_is_not_reported_on_its_training_study(self):
        result = run()
        worldfish = result["results"]["WorldFish grow-out ponds"]
        self.assertIsNone(worldfish["avg_weight_g"]["mae"]["published_model"])
        self.assertIsNone(worldfish["avg_length_cm"]["mae"]["published_model"])
        self.assertEqual(result["results"]["FAO fry pools"]["avg_weight_g"]["observed_gap_days"], [7])


if __name__ == "__main__":
    unittest.main()
