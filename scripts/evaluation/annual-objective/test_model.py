"""Behavior tests: future leakage, missingness and independently checked arithmetic."""
import math
import unittest
from model import METHODS, forecast, score_rows


class ForecastTests(unittest.TestCase):
    def test_valid_history_produces_all_registered_methods(self):
        # Missing or silently dropped candidates must fail this test.
        predictions = forecast({y: 40 + y - 2000 for y in range(2000, 2020)}, 2019, 1, "life_expectancy")
        self.assertIsNotNone(predictions)
        self.assertEqual(set(predictions), set(METHODS))

    def test_future_tail_cannot_change_any_forecast(self):
        # Reading a fit window from the end of the full series must fail here.
        base = {y: 40 + (y - 2000) * 0.2 + math.sin(y) for y in range(2000, 2020)}
        for target in ["gdp", "unemployment", "life_expectancy"]:
            for horizon in [1, 5]:
                expected = forecast(base, 2019, horizon, target)
                self.assertIsNotNone(expected)
                poisoned = {**base, **{y: 1e90 for y in range(2020, 2030)}}
                self.assertEqual(expected, forecast(poisoned, 2019, horizon, target))

    def test_missing_history_skips_all_methods_without_future_fill(self):
        values = {y: 50.0 for y in range(2000, 2030)}
        values[2010] = None
        self.assertIsNone(forecast(values, 2019, 1, "life_expectancy"))
        del values[2010]
        self.assertIsNone(forecast(values, 2019, 5, "life_expectancy"))

    def test_invalid_gdp_is_not_log_transformed_or_filled(self):
        values = {y: 100.0 for y in range(2000, 2020)}
        values[2018] = 0.0
        self.assertIsNone(forecast(values, 2019, 1, "gdp"))

    def test_no_twenty_year_history_means_no_forecast(self):
        self.assertIsNone(forecast({y: 50.0 for y in range(2001, 2020)}, 2019, 1, "life_expectancy"))

    def test_damped_trend_uses_gdp_logs_and_native_life_units(self):
        life = {y: float(40 + y - 2000) for y in range(2000, 2020)}
        result = forecast(life, 2019, 1, "life_expectancy")
        self.assertAlmostEqual(result["persistence"]["prediction"], 59.0)
        self.assertAlmostEqual(result["damped_trend"]["prediction"], 59.9)
        self.assertAlmostEqual(result["ridge_changes"]["prediction"], 59 + 18 / 28)
        gdp = {y: 100 * math.exp(0.02 * (y - 2000)) for y in range(2000, 2020)}
        result = forecast(gdp, 2019, 1, "gdp")
        self.assertAlmostEqual(result["damped_trend"]["prediction"], 100 * math.exp(0.398))

    def test_explicit_bounds_keep_raw_forecast(self):
        values = {y: float(80 + 2 * (y - 2000)) for y in range(2000, 2020)}
        result = forecast(values, 2019, 5, "life_expectancy")
        self.assertEqual(result["damped_trend"]["prediction"], 120)
        self.assertGreater(result["damped_trend"]["rawPrediction"], 120)


class ScoreTests(unittest.TestCase):
    def test_matching_mask_normalized_gdp_error_and_direction_ties(self):
        # Mixed origin dollar scales must not turn this into raw-dollar MAE.
        rows = [{"country": "A", "originValue": 100, "actual": 110, "prediction": 108},
                {"country": "B", "originValue": 1000, "actual": 900, "prediction": 1000},
                {"country": "C", "originValue": 50, "actual": 50, "prediction": 51},
                {"country": "D", "originValue": 20, "actual": None, "prediction": 25}]
        result = score_rows(rows, "gdp")
        self.assertEqual(result["n"], 3)
        self.assertEqual(result["missingOutcomes"], 1)
        self.assertAlmostEqual(result["mae"], 14 / 3)
        self.assertAlmostEqual(result["changeMAE"], 14 / 3)
        self.assertAlmostEqual(result["baselineMAE"], 20 / 3)
        self.assertAlmostEqual(result["skill"], 0.3)
        self.assertEqual(result["directionDenominator"], 2)
        self.assertEqual(result["actualTiesExcluded"], 1)
        self.assertEqual(result["predictedTiesOnNonzeroActual"], 1)
        self.assertEqual(result["directionAccuracy"], 0.5)


if __name__ == "__main__":
    unittest.main()
