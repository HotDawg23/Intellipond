"""Check cohort holdout and stage comparison bookkeeping."""

import unittest

from compare_growth_models import evaluate, linear_daily_gain


def row(cohort, day, value):
    return {
        "source_cohort": cohort,
        "days_since_stocking": day,
        "avg_weight_g": value,
        "avg_length_cm": value,
        "source": "test",
    }


class GrowthComparisonTests(unittest.TestCase):
    def test_linear_candidate_weights_ponds_equally(self):
        groups = {
            "a": [row("a", 0, 1), row("a", 1, 2), row("a", 2, 3)],
            "b": [row("b", 0, 1), row("b", 1, 4)],
        }
        self.assertEqual(linear_daily_gain(groups, "avg_weight_g"), 2)
        self.assertIsNone(linear_daily_gain({}, "avg_weight_g"))

    def test_held_out_target_does_not_change_its_prediction(self):
        public = [row("a", 0, 1), row("a", 10, 2),
                  row("b", 0, 1), row("b", 10, 3)]
        bfar = [row("BFAR-a", 0, 1), row("BFAR-a", 10, 4)]
        first = evaluate(public, bfar)
        changed = [dict(item) for item in public]
        changed[1]["avg_weight_g"] = 100
        second = evaluate(changed, bfar)
        first_fold = first["results"]["all"]["avg_weight_g"]["interval_predictions"][1]
        second_fold = second["results"]["all"]["avg_weight_g"]["interval_predictions"][1]
        self.assertEqual(first_fold["held_out_cohort"], "a")
        self.assertEqual(first_fold["predictions"], second_fold["predictions"])
        self.assertAlmostEqual(first_fold["predictions"]["pooled_linear"], 3.5)
        reversed_report = evaluate(list(reversed(public)), list(reversed(bfar)))
        self.assertEqual(first["comparison_version"], reversed_report["comparison_version"])
        self.assertNotEqual(first["comparison_version"], second["comparison_version"])

    def test_missing_initial_value_preserves_recent_baseline(self):
        public = [row("a", 0, None), row("a", 1, 1), row("a", 2, 2), row("a", 3, 4),
                  row("b", 0, 1), row("b", 3, 2)]
        metric = evaluate(public, [])["results"]["all"]["avg_weight_g"]
        self.assertEqual(metric["paired_intervals"], 1)
        self.assertEqual(metric["paired_mae"]["recent_growth"], 0)
        self.assertEqual(metric["paired_mae"]["recent_linear"], 1)
        self.assertEqual(metric["evaluated_intervals"]["pooled_linear"], 3)

    def test_bfar_model_reports_missing_training_coverage(self):
        public = [row("a", 0, 1), row("a", 10, 2)]
        bfar = [row("BFAR-a", 0, 1), row("BFAR-a", 10, 2)]
        metric = evaluate(public, bfar)["results"]["bfar_fingerling"]["avg_weight_g"]
        self.assertEqual(metric["evaluated_intervals"]["bfar_linear"], 0)
        self.assertIsNone(metric["mae"]["bfar_linear"])

    def test_same_held_out_intervals_and_private_stage_only(self):
        public = [
            row("public-one", 0, 1), row("public-one", 20, 2),
            row("public-two", 0, 1), row("public-two", 20, 3),
        ]
        bfar = [
            row("BFAR-one", 0, 1), row("BFAR-one", 10, 2), row("BFAR-one", 20, 3),
            row("BFAR-two", 0, 1), row("BFAR-two", 10, 2), row("BFAR-two", 20, 4),
        ]
        report = evaluate(public, bfar)
        all_weight = report["results"]["all"]["avg_weight_g"]
        bfar_weight = report["results"]["bfar_fingerling"]["avg_weight_g"]
        self.assertEqual((all_weight["held_out_cohorts"], all_weight["intervals"]), (4, 6))
        self.assertEqual((bfar_weight["held_out_cohorts"], bfar_weight["intervals"]), (2, 4))
        self.assertEqual(bfar_weight["paired_intervals"], 2)
        self.assertIsNone(all_weight["mae"]["bfar_only"])
        self.assertIsNotNone(bfar_weight["mae"]["bfar_only"])
        self.assertEqual(report["seven_day_bfar_pairs"], 0)


if __name__ == "__main__":
    unittest.main()
