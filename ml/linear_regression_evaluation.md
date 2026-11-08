# Linear regression growth model: pre-beta evaluation

## Model and calculation

The app now uses **cohort-weighted ordinary least squares linear regression**,
a supervised learning method. For each interval of measured fish growth, the
training input is `ln(earlier weight or length)` and the target is the observed
daily log-growth rate, `ln(later / earlier) / elapsed_days`. Weight and length
have separate fitted intercepts and slopes. Each cohort contributes equal total
weight to the fit, even if its number of samples differs.

At prediction time the app calculates:

```text
predicted_daily_rate = intercept + slope * ln(latest_measurement)
forecast = latest_measurement * exp(predicted_daily_rate * 7)
```

The model uses the latest measured fish weight or length only. It does not
predict mortality or yield, and it does not use water parameters. The final
coefficients are fitted on all three public studies by
`python ml/train_linear_growth_model.py`. The versioned artifact is
`public/growth-model.json`; the former pooled-rate model is preserved in
`ml/models/pooled_log_rate_reference.json` for comparison. No private BFAR
records are included in the app model.

Data sources: [WorldFish Sulu et al. (2016), Table 10](https://digitalarchive.worldfishcenter.org/items/d63bc10f-eec1-4053-86c9-08106a92c55e),
[FAO Pedini (1976), Table 1](https://www.fao.org/4/H9727E/H9727E00.htm), and
[Taiwan Fisheries Research Institute Su and Ting (1980), Table 1](https://www.tfrin.gov.tw/redirect_files.php?file_name=q88wWFUpoNJMkVpXz72LguwFXwfC75NsSUaZLhF4v9ET7DowsTWGPluskLaLAR2QW6m6S&id=10300).
The code uses Python's standard library, with no external training dependency.

## Held-out evaluation

`python ml/evaluate_linear_regression.py` holds out each entire study in turn.
For each test study, its regression coefficients are fitted on the **other
two** studies. This is distinct from evaluating the final app fit on its own
training rows. It also compares the former model where that model's WorldFish
training data do not overlap the test study, and an unchanged-value baseline.
Mean absolute error (MAE) is the average size of the forecast error; lower is
better. These are errors at the studies' **observed gaps**, not all seven-day
errors.

| Held-out study and gap | Pairs | Output | Linear regression MAE | Former model MAE | Unchanged MAE |
| --- | ---: | --- | ---: | ---: | ---: |
| FAO fry pools, 7 days | 12 | Weight (g) | 0.0828 | 0.0952 | 0.1060 |
| FAO fry pools, 7 days | 12 | Length (cm) | 0.3537 | 0.4175 | 0.4855 |
| TFRI deep-water ponds, 20–22 days | 10 | Weight (g) | 69.1197 | 28.2689 | 36.7070 |
| TFRI deep-water ponds, 20–22 days | 10 | Fork length (cm) | 2.3752 | 1.2404 | 2.3130 |
| WorldFish grow-out ponds, 99–127 days | 5 | Weight (g) | 1039.3423 | In-sample; omitted | 44.9000 |
| WorldFish grow-out ponds, 99–127 days | 5 | Body length (cm) | 16.0104 | In-sample; omitted | 7.4560 |

On the eight TFRI intervals with earlier growth history, a simple recent
absolute-growth baseline scores 23.1485 g and 1.1577 cm MAE. The regression
scores 83.7856 g and 2.9133 cm on those **same** eight intervals. It does not
consistently beat a simple rule.

## Interpretation for the paper

The regression performs better for the FAO laboratory fry but **worse for the
held-out pond studies**. Using a recognized ML algorithm does not make the
forecasts accurate. The app keeps the **Research estimate** label and shows no
confidence percentage or interval. The FAO seven-day pairs are four pools in
one experiment, not independent fingerling or grow-out ponds. The pond studies
have longer observation gaps. Life stages, conditions, and length definitions
also differ (TFRI fork length, BFAR total length, WorldFish body length).

For the adviser, report the model name, formula, input variables, source
studies, held-out method, and the separate MAEs above. Do not turn these MAEs
into a single accuracy percentage. Nine public cohorts across three studies
are too few and too different to validate seven-day accuracy in a new pond.
The one-hour beta tests usability, not future biological outcomes. Improving
predictive reliability needs more comparable pond cohorts with matched length
definitions and sampling horizons, followed by another independent test.
