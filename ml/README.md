# Bangus growth model

The current reference model is trained from the farm measurements published in
Sulu et al. (2016), *The feasibility of milkfish (Chanos chanos) aquaculture in
Solomon Islands*, WorldFish Program Report 2016-07. The report is available under
CC BY 4.0: https://digitalarchive.worldfishcenter.org/items/d63bc10f-eec1-4053-86c9-08106a92c55e

The included table is transcribed from Table 10 (pond, days since stocking,
average body weight, and average body length). Lengths were converted from mm to
cm. Cite the report and retain this attribution when reusing the extracted data.

These are only eight measurements from three ponds, mostly 99 to 127 days apart.
They are suitable for an academic reference estimate, not for claiming accurate
seven-day predictions at BFAR. The trainer reports validation on held-out
long-interval transitions separately and never treats that as seven-day
validation.

## Public data review (October 2026)

| Source | What is available | Decision |
| --- | --- | --- |
| [WorldFish Sulu et al. 2016, Table 10](https://digitalarchive.worldfishcenter.org/items/d63bc10f-eec1-4053-86c9-08106a92c55e) | Average weight and length by stocking day for three identifiable pond cohorts; CC BY 4.0. The included CSV converts length from mm to cm. | Retain as the current training source. |
| [FAO Milkfish Culture and Pond Management, Table 1](https://www.fao.org/4/H9727E/H9727E00.htm) | Weekly weight and length for milkfish fry in four-week laboratory pools, rather than pond grow-out cohorts. | Exclude from this pond model despite the useful sampling interval. |
| [SEAFDEC/JIRCAS marine-pen study](https://repository.seafdec.org.ph/bitstream/handle/10862/6335/6335-IMTA-Proceedings2022.pdf) | Reports monthly weight and length sampling in marine pens, but provides fitted-model statistics rather than reusable per-pen measurement rows; reuse terms for those rows are not established. | Exclude unless underlying measurements and permission can be obtained. |

Before adding another online dataset, check its original source and document
the license, pond setting, life stage, cohort identity, sampling dates or days,
units, and conversions. Only add measured rows from comparable milkfish pond
cohorts. Do not infer weekly points from endpoints, treat plotted values as
exact, or merge different cohorts. More rows alone do not establish better
seven-day accuracy.

## Train

The trainer uses Python's standard library. To include BFAR data, prepare a CSV
with the same columns as `data/worldfish_milkfish_growth.csv`, use a unique
`source_cohort` beginning with `BFAR-` for each pond stocking cycle, and pass it
with `--bfar-csv`. To evaluate the seven-day forecast, the file must include exact
seven-day measurement pairs from at least three BFAR cohorts. Validation passes
only when the held-out model beats the recent-rate baseline on the *same*
eligible seven-day pairs for both weight and length. A cohort needs an earlier
interval before a recent-rate baseline is available.
Keep BFAR files outside version control unless their owner has authorized sharing.

The generated version includes the algorithm version and a digest of the
training rows. The same rows and algorithm produce the same version; change
`MODEL_ALGORITHM_VERSION` when changing the growth-rate calculation. Long-interval
evaluation compares the model with unchanged-value predictions over all
eligible intervals; its recent-rate comparison uses paired intervals only.
When comparable public data becomes available, compare the old and proposed
models on the same held-out cohorts before replacing the published artifact.
Without supported improvement, keep the current reference model. Its
growth-rate spread is not a confidence interval or confidence percentage.

```sh
python ml/train_growth_model.py
python ml/train_growth_model.py --bfar-csv /path/to/bfar_growth.csv --output /path/to/private/bfar_growth_model_candidate.json
```

The WorldFish-only command writes `public/growth-model.json`. When `--bfar-csv`
is supplied, `--output` is required so candidate data cannot overwrite the
published model by default. Store private BFAR data and generated candidates
outside the repository unless sharing has been authorized.

## Private BFAR candidate comparison

A private BFAR fingerling workbook was summarized into pond/date means outside
this repository. Its source, dates, units, conversions, and evaluation are
documented in the private report beside the CSV. The BFAR length field is total
length; the WorldFish report calls its field body length without specifying its
length convention, so the measurements may not be directly equivalent. DOC is
provisionally interpreted as days since stocking; confirm that interpretation
and the length definition with BFAR before treating this as a validated source.

From the application repository, regenerate the private candidate and a
comparison report (replace the paths with the locations of your private files):

```sh
python ml/train_growth_model.py --bfar-csv ../private-bfar-growth/bfar_growth_training_data.csv --output ../private-bfar-growth/bfar_growth_model_candidate.json
python ml/compare_growth_models.py --bfar-csv ../private-bfar-growth/bfar_growth_training_data.csv --output ../private-bfar-growth/bfar_growth_comparison.json
```

The comparison holds out whole pond cohorts and uses the same observed
intervals for the WorldFish-only and pooled candidates, unchanged-value
baseline, and recent-growth baseline. It also evaluates a BFAR-only rate model
on the BFAR fingerling intervals. Compare `paired_mae` values when judging the
recent-growth baseline, because it requires a prior interval. These results
measure 13- to 127-day intervals, **not** seven-day forecast accuracy.

With the available six BFAR means, the pooled candidate has higher overall
held-out error than the WorldFish-only approach for both weight and length.
The BFAR-only model improves length on the four fingerling intervals but worsens
weight against the pooled candidate. Two ponds from one culture cycle cannot
establish a reliable fingerling model, and there are no exact seven-day BFAR
pairs. Keep the published model and its Research estimate label until
independent cycles support a replacement and the existing seven-day validation
rule can be evaluated. Do not call the reference range a confidence interval.

## Experimental linear-growth comparison

The comparison script also fits two experimental models: `pooled_linear`
uses all available training ponds, and `bfar_linear` uses only the other BFAR
ponds and is evaluated only in the BFAR scope. Each model takes the median
daily absolute gain within each training pond, then the median across ponds.
It predicts latest measurement + daily gain * forecast days, floored at zero.
This avoids exponential extrapolation, but a shared absolute gain can still
overpredict growth for small fish. These are experimental comparisons, not
models loaded by the application.

`recent_linear` is an additional baseline using only the latest preceding
valid interval from the held-out pond. Both recent baselines use measurements
available before the target interval, including when earlier rows contain
missing values. Rows with missing endpoints are skipped; no measurements are
invented to fill gaps.

```sh
python ml/compare_growth_models.py --bfar-csv ../private-bfar-growth/bfar_growth_training_data.csv --output ../private-bfar-growth/bfar_growth_linear_comparison.json
python -m unittest discover -s ml -p "test_*.py" -v
```

The report includes separate WorldFish and BFAR results, interval predictions,
per-method evaluated counts, paired counts, and a deterministic comparison
version. Compare errors only when methods cover the same intervals; a missing
training fold is not a zero-error prediction. The `bfar_fingerling` scope names
the supplied dataset, not an automatic life-stage classifier.

Entire ponds are excluded from training for each test fold, following the
[non-overlapping group validation principle](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupKFold.html).
The two supplied BFAR ponds share a culture cycle, so holding out one pond
does not establish performance on an independent cycle. Trying models on this
small dataset is exploratory; choosing one from these results requires fresh
independent validation. The linear candidates do not improve both measurements
consistently across the available sources and remain research-only. Their
long-interval errors do not validate the app's seven-day horizon.

Keep comparison reports outside the repository because they contain private
BFAR observations and predictions. This workflow does not update
`public/growth-model.json` or add confidence intervals.

## Growth records and water averages

The Growth Records export includes same-pond DO, pH, temperature, and turbidity
averages for each fish sample, along with each parameter's non-null reading
count and the averaging dates. These averages start at stocking for a batch's
first sample, then at the day after its prior distinct sampling date. They are
recomputed when viewed or exported, so readings that arrive later in the day
can change that day's average. Empty averages are exported as blank cells.

These fields are not inputs to the current model: the published growth data has
no paired water measurements, and BFAR does not yet have repeated growth
samples for model evaluation. A future water-informed model needs enough
batch-level fish samples paired with water records, then must be compared with
the growth-only model on held-out batches using the same forecast horizon. The
exported averages describe water conditions over the growth observation
interval, so a forecast evaluation must ensure predictor values were available
at the time the forecast would have been made and do not include water readings
from after that point. The Pi's DO column is calculated from a second pH probe;
do not treat it as an independent, direct dissolved-oxygen measurement.
