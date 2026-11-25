# tempthingy

One page, `index.html`, with two forecast tools and one shared results view:

- **Your forecast**: draw a distribution for the year that TAI arrives.
- **China questions**: a questionnaire, one question per step, with a probability bar.
- **Everyone's forecasts**: the pooled TAI curve and the median for each China question.

## Flow of the data

```
index.html  --POST one JSON row-->  Apps Script (apps-script/Code.gs)  --appendRow-->  Google Sheet
index.html  <--GET all rows-------  Apps Script                        <--read-------  Google Sheet
```

The sheet has two tabs. In both, one row is one submission and rows are never edited, so the sheet is the full history. The page keeps the latest row for each name.

| Tab | What | Columns |
| --- | --- | --- |
| the tab with a `cdf` column | TAI curves | `at name org years definition mode points comps y0 cdf` (fixed) |
| `answers` | China questions | `at name org years` + one column for each question id |

The script makes the `answers` tab on the first request. It adds a column when a new question id arrives.

## Add or change a question

Edit the `Q` list in `index.html`. That list is the only place where questions are defined. A new `id` becomes a new column in the `answers` tab automatically. Do not reuse an `id` for a different question: old answers would count for the new one.

## Set up or update the backend

1. Open the sheet, then Extensions > Apps Script.
2. Replace the code with `apps-script/Code.gs`.
3. Deploy > Manage deployments > edit the current deployment > Version: New version > Deploy. This keeps the `/exec` URL.
   For a new sheet: Deploy > New deployment > Web app, execute as "Me", access "Anyone", then paste the `/exec` URL into `const API` in `index.html`.

Until the new script is deployed, the page keeps China answers in the browser and keeps the submit button off. This prevents writes of answers into the TAI tab.
