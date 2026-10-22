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

## Train

The trainer uses Python's standard library. To include BFAR data, prepare a CSV
with the same columns as `data/worldfish_milkfish_growth.csv`, use a unique
`source_cohort` beginning with `BFAR-` for each pond stocking cycle, and pass it
with `--bfar-csv`. To evaluate the seven-day forecast, the file must include exact
seven-day measurement pairs from at least three BFAR cohorts. Validation passes
only when the held-out model beats the recent-rate baseline for both weight and
length.
Keep BFAR files outside version control unless their owner has authorized sharing.

```sh
python ml/train_growth_model.py
python ml/train_growth_model.py --bfar-csv /path/to/bfar_growth.csv
```

The generated artifact is `public/growth-model.json`.

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
