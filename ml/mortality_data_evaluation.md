# Mortality model data decision

**Decision: publish an experimental next-visit research estimate, not a 24-hour
prediction or an operational alert.** IntelliPond records daily observed deaths
and transfers, including days with zero deaths. No reviewed public source
supports a next-day outcome test. The research model is shown only when the
batch has a recent death log and a complete fresh sensor reading from the same
day. Its result must not be used to decide pond interventions.

## Source audit

| Source | Relevant contents | Decision |
| --- | --- | --- |
| [Baena-Navarro, Carriazo-Regino, and Torres-Hoyos (2024), Mendeley Data v3](https://doi.org/10.17632/8s73jfvgr5.3), CC BY 4.0 | 43,498 spreadsheet rows, but one survival percentage per month (six distinct values across January–June); no pond/batch identifier or daily death count. The 43,498 rows are **not** 43,498 mortality outcomes. | Exclude from 24-hour model training and testing. |
| [Jongjaraunsuk, Taparhudee, and Matondang (2024)](https://doi.org/10.34044/j.jfe.2024.48.1.04) | Peer-reviewed red tilapia fingerling study with 173 samples and a published mortality classifier. The paper's reported score belongs to its own data and model; individual training rows were not supplied for independent testing here. | Method reference only. |
| [Fish Welfare Initiative, Farm Data India](https://github.com/fish-welfare-initiative/fwi-farm-data-india) | Public pond water quality and “Dead fish” counts, but those counts cover the period **since the previous visit**; ordinary visits are roughly monthly. The project also retracts some Nellore water measurements. | Cannot label a 24-hour outcome from these records. |
| [Liland et al. (2024), Atlantic salmon trial A and B](https://data.mendeley.com/datasets/b9v6tsg3fh/1) | Daily tank counts and dissolved oxygen/temperature exist, but all nine tanks in each trial report zero deaths on every recorded day. | No positive mortality outcomes to train or test. |

The Mendeley workbook SHA-256 is
`15b34aa09719fce3eceb4a990bc08d8890085bacd74348d7a14da0cf75e47efe`.
To repeat its audit, download the workbook from the dataset page and run:

```sh
python ml/audit_mortality_dataset.py path/to/Data_Model_IoTMLCQ_2024.xlsx
```

The workbook need not be committed. The script reports each month's survival
values, row counts, column names, and the missing independent pond and daily
death fields.

## Longer-period candidate: deaths reported by the next farm visit

We also evaluated a **different target** using the [Fish Welfare Initiative's
published India farm data](https://github.com/fish-welfare-initiative/fwi-farm-data-india):
whether any dead fish were found at the *next recorded visit*. The source says
“Dead fish” covers the interval since the previous visit; this is neither a
24-hour outcome nor a measured mortality *rate*. The median observed gap in
eligible visit pairs was 24 days. This experiment uses prior-visit DO, pH,
temperature, and dead-fish count. It excludes the project's retracted Nellore
water data because those rows are in a separate CSV.

The source CSV SHA-256 was
`41e70a84a8b45c6884cff805d1a4270260320b78c0b25bbeb48ca90e54fa8ebd`.
To reproduce the experiment, download `data/water_quality.csv` from the linked
repository and run:

```sh
python -m pip install -r ml/requirements-mortality.txt
python ml/evaluate_visit_mortality.py path/to/water_quality.csv
```

The script combines repeated measurements for a pond on one date into one
visit, using median water readings and the maximum reported death count. It
does **not** multiply repeated death reports. Missing deaths are excluded from
labels; implausible sensor readings are excluded from predictors. Five-fold
grouped cross-validation holds out whole ponds. The dataset yielded 4,333
successive-visit pairs from 272 eligible ponds, of which 72 had a positive next
visit. The source ponds mainly hold Rohu and Catla, often together; they are
not Bangus ponds.

| Model | True positives | False positives | False negatives | Positive precision | Positive recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Always predict no deaths | 0 | 0 | 72 | 0% | 0% |
| Logistic Regression | 28 | 1,410 | 44 | 1.9% | 38.9% |
| Random Forest | 3 | 29 | 69 | 9.4% | 4.2% |

**Model choice and limit:** the Random Forest was exported as an *experimental*
next-visit research candidate because it gave fewer false alarms than Logistic
Regression. It still misses nearly all positive reports, and its 9.4% positive
precision means most elevated signals in the held-out test were false alarms.
It was removed from the app's runtime and UI when the workflow changed to
final harvest counts. This is a capstone research experiment, **not** a
validated mortality warning for Bangus or any other
pond. A different forecast window cannot repair the missing Bangus labels or
the weak independent-pond results.

The retained research artifact is `ml/models/mortality_research_candidate.json`. It is not served by the app. Recreate it
from the reviewed CSV with:

```sh
python ml/train_mortality_model.py path/to/water_quality.csv
```

The exporter checks the source SHA-256, fits the same 200-tree Random Forest
configuration used in cross-validation, and writes a deterministic version.
The source CSV is kept outside Git. The retired candidate used measured DO,
pH, temperature, and same-day death counts; it never trained on the separate
historical research-reference readings. Its target was the next recorded visit,
whose median gap in the source was 24 days.

## What is needed before operational use

Collect multiple independent batch cycles with dated daily deaths (including
zero-death days), stocking counts, recorded transfers, and measured DO, pH,
temperature, and turbidity available **before** the next day's death count.
Keep research-reference readings out of both training and testing. Define an
elevated daily mortality-rate cutoff using training cohorts only, then compare
majority-class, Logistic Regression, and Random Forest models on held-out whole
ponds/cycles. Report event precision, event recall, confusion matrix, and the
number of independent ponds and events. Test Bangus separately before claiming
Bangus accuracy. Until then, the app labels this output **Research estimate**
and keeps it separate from operational alerts.
