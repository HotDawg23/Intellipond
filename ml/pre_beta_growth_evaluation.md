# Former pooled-rate model: historical pre-beta comparison

This file records the evaluation of the model used **before** the app switched
to linear regression. The current app model and its errors are documented in
[linear_regression_evaluation.md](linear_regression_evaluation.md). Do not
present the numbers below as validation of the current app model.

The former model, preserved as `ml/models/pooled_log_rate_reference.json`,
was trained on eight [WorldFish](https://digitalarchive.worldfishcenter.org/items/d63bc10f-eec1-4053-86c9-08106a92c55e)
measurements from three ponds. It used a pooled median daily log-growth rate
for each metric: `forecast = latest_value * exp(median_daily_rate * days)`.
The rates were 0.01615328745 per day for weight and 0.005682579925 per day
for length. It was a simple statistical reference, not a validated seven-day
ML predictor. Its rate spread was not a calibrated confidence interval.

Mean absolute error (MAE), lower is better:

| External test source and observed gap | Pairs | Former model weight MAE | Former model length MAE | Unchanged-value MAE |
| --- | ---: | ---: | ---: | --- |
| [FAO fry laboratory pools](fao_fry_evaluation.md), 7 days | 12 | 0.0952 g | 0.4175 cm | 0.1060 g; 0.4855 cm |
| [TFRI deep-water ponds](https://www.tfrin.gov.tw/redirect_files.php?file_name=q88wWFUpoNJMkVpXz72LguwFXwfC75NsSUaZLhF4v9ET7DowsTWGPluskLaLAR2QW6m6S&id=10300), 20–22 days | 10 | 28.2689 g | 1.2404 cm fork length | 36.7070 g; 2.3130 cm fork length |

On eight TFRI intervals with earlier growth history, a recent absolute-growth
baseline scored 23.1485 g and 1.1577 cm MAE, better than the former model's
33.2778 g and 1.5073 cm on the same intervals. The FAO seven-day result is
limited to four small-fry pools in one experiment. The TFRI pond observations
have longer gaps and measure fork length. Neither result establishes reliable
seven-day performance for a new pond. Rerun the historical comparisons with
`python ml/evaluate_fao_fry.py` and `python ml/evaluate_tfrin_ponds.py`.
