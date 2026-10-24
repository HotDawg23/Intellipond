"""Check cohort holdout and stage comparison bookkeeping."""

import unittest

from compare_growth_models import evaluate


def row(cohort, day, value):
    return {
        "source_cohort": cohort,
        "days_since_stocking": day,
        "avg_weight_g": value,
        "avg_length_cm": value,
        "source": "test",
    }


class GrowthComparisonTests(unittest.TestCase):
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
