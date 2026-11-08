# FAO weekly fry evaluation (exploratory)

## Source and transcription

M. Pedini (1976), *Milkfish Culture and Pond Management*, FAO/UNDP report
FI:DP INS/72/003/3, Table 1: https://www.fao.org/4/H9727E/H9727E00.htm

The [transcribed CSV](data/fao_milkfish_fry_weekly.csv) contains the reported
mean weights and lengths for pools SP1-SP4 at the end of weeks 1-4. The report
describes young fry in four laboratory pools, not independent pond batches.
Weights were converted from milligrams to grams and lengths from millimeters to
centimeters. Day 0 is excluded because the report gives one initial mean shared
by the fry before placement in pools, rather than a separate observation for
each pool. Each pool has three exact seven-day transitions, giving 12 pairs.
The report calls this field length without defining total versus fork length.

The FAO page notes that its electronic text used OCR. Before quoting individual
figures in a paper, check them against the original page image. The striking
SP4 gain from week 3 to 4 is present in both Table 1 and the weekly-increase
Table 2; it has not been removed as an outlier.

## Method

Run `python ml/evaluate_fao_fry.py` from the application repository. It uses
the former frozen model in `ml/models/pooled_log_rate_reference.json` and compares four methods on
the *same* 12 transitions. For the two FAO-trained candidates, each test pool
is held out entirely while the rate is learned from the other three pools.
The candidates use the same median-of-pool-rates approach as the current
trainer: one uses daily log growth, the other absolute daily gain. The unchanged
baseline predicts the latest measurement. The recent-log-rate baseline needs a
prior transition, so it is compared separately on eight paired transitions.
No test-pool observations are used to train its held-out candidate.

| Method | Weight MAE (g), 12 pairs | Length MAE (cm), 12 pairs |
| --- | ---: | ---: |
| Published WorldFish model | 0.095246 | 0.417516 |
| FAO pooled log-rate candidate | 0.088348 | 0.368956 |
| FAO pooled linear-rate candidate | 0.079308 | 0.342500 |
| Unchanged-value baseline | 0.106022 | 0.485500 |

On the eight pairs with an earlier transition, the recent-log-rate baseline
has MAE 0.115024 g and 0.426872 cm. The FAO linear candidate has MAE
0.114856 g and 0.466375 cm on those *same* eight pairs: nearly tied for
weight and worse for length. The published model has MAE 0.122693 g and
0.440356 cm on those eight pairs.

## Interpretation and decision

This is a real seven-day **fry-pool** test, but it is not a validated accuracy
claim for the application's fingerling and grow-out pond forecasts. Four pools
within one experiment do not represent four independent sites or culture cycles.
The published WorldFish model was trained on much larger fish and much longer
measurement gaps, so this fry test is outside its training range.
SP4's very rapid later growth creates strong between-pool variation. The
candidate methods were examined on this small dataset; selecting the best
method by these test errors would require a fresh independent test set before
claiming its performance. Do not combine these tiny fry values with the
WorldFish long-interval grow-out measurements into one pooled rate. Keep the
former model unchanged for this historical comparison. The app now uses a
linear regression documented in `linear_regression_evaluation.md`. Do not
turn MAE into an arbitrary accuracy %.

## Additional primary sources reviewed

- Su and Ting (1980), *The Study of Improvement of The Milkfish Culture In
  Deep-water Pond*, Bulletin of Taiwan Fisheries Research Institute No. 32,
  [Table 1](https://www.tfrin.gov.tw/redirect_files.php?file_name=q88wWFUpoNJMkVpXz72LguwFXwfC75NsSUaZLhF4v9ET7DowsTWGPluskLaLAR2QW6m6S&id=10300):
  two pond weight and fork-length series sampled about every 20-22 days. One
  pond ends early after mass mortality. This is a promising exact-number source
  for a longer-horizon **exploratory** test, but two ponds from one experiment
  cannot establish general performance. Its fork length is not automatically
  equivalent to the FAO or WorldFish length field.
- Hidayat et al., [juvenile milkfish pond study](https://ijaseit.insightsociety.org/index.php/ijaseit/article/download/11130/pdf_1398/24600):
  growth is charted at seven-day intervals across four treatments, but exact
  intermediate weight rows and paired length rows are not tabulated. Do not
  convert approximate chart readings into exact validation observations.
- Macusi et al. (2025), [milkfish feeding trial](https://ija.scholasticahq.com/article/130044-non-fishmeal-based-and-selected-indigenous-raw-materials-as-cost-effective-feeds-for-milkfish-aquaculture):
  a 12-week cage study with weight and length growth figures. Obtain numerical
  observations and confirm treatment replication before using it in evaluation.
- Pleto et al. (2018), [Philippine pond study](https://pubmed.ncbi.nlm.nih.gov/30560004/):
  monthly milkfish weights by pond, without matched repeated length rows.
  Useful for weight-only longer-horizon exploration, not a complete two-output
  seven-day test.

Changing the forecast to 20-22 days or monthly could make a matched-period
evaluation possible with these sources, but does not itself improve model
quality. Choose a horizon for an actual user need, then compare models and
simple baselines on independent ponds or cycles at that horizon. Until then,
retain the Research estimate label and keep errors scoped to their source and
life stage in the paper.
