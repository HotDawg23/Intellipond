"""Small checks for reproducibility and honest holdout comparisons."""

import unittest

from train_growth_model import grouped_rows, train


def row(cohort, day, weight, length):
    return {
        "source_cohort": cohort,
        "days_since_stocking": day,
        "avg_weight_g": weight,
        "avg_length_cm": length,
        "source": "test",
    }


class GrowthModelTests(unittest.TestCase):
    def test_missing_initial_value_keeps_prior_valid_rate_in_evaluation(self):
        rows = [row("a", 0, None, None), row("a", 1, 1, 1),
                row("a", 2, 2, 2), row("a", 3, 4, 4),
                row("b", 0, 1, 1), row("b", 3, 2, 2)]
        metric = train(rows)["validation"]["metrics"]["avg_weight_g"]
        self.assertEqual(metric["baseline_intervals"], 1)
        self.assertEqual(metric["recent_rate_baseline_mae"], 0)

    def test_duplicate_day_in_cohort_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "duplicate measurement day"):
            grouped_rows([row("pond-a", 0, 1, 1), row("pond-a", 0, 2, 2)])

    def test_model_version_is_stable_for_same_measurements(self):
        rows = [row("pond-a", 0, 1, 1), row("pond-a", 7, 2, 1.5),
                row("pond-b", 0, 1, 1), row("pond-b", 7, 3, 2)]
        self.assertEqual(train(rows)["model_version"], train(list(reversed(rows)))["model_version"])
        changed = [dict(item) for item in rows]
        changed[1]["avg_weight_g"] = 2.1
        self.assertNotEqual(train(rows)["model_version"], train(changed)["model_version"])

    def test_seven_day_claim_needs_three_bfar_cohorts_with_paired_baselines(self):
        rows = [row("pond-a", 0, 1, 1), row("pond-a", 7, 2, 2)]
        for cohort in ("BFAR-one", "BFAR-two"):
            rows.extend([row(cohort, 0, 1, 1), row(cohort, 7, 1.5, 1.5), row(cohort, 14, 2, 2)])
        validation = train(rows)["seven_day_validation"]
        self.assertEqual(validation["status"], "not_validated")
        self.assertEqual(validation["metrics"]["avg_weight_g"]["paired_cohorts"], 2)


if __name__ == "__main__":
    unittest.main()
