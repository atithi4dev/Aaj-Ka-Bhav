# आज का भाव — Aaj Ka Bhav

**The mandi rate, in the farmer's hand.** A Hindi-first, phone-first price app that answers one question in seconds: *what is my crop worth today, and where will I get the most for it?*

Built by **team kitty**.

---

## The problem

A farmer usually finds out the price of his crop **after** he has already committed to a buyer. The official mandi data exists, but it is scattered across government portals, hard to search, English-first, and designed for a desktop browser. By the time the number is found, the deal is done.

Three things are missing at the point of sale:

1. **One clear number** for the crop, the district, and the day.
2. **Comparison** with nearby mandis, so the farmer knows whether to travel.
3. **Honesty** about whether that number is actually today's price.

## The product

Aaj Ka Bhav turns the AGMARKNET feed into a single screen designed for a small phone, a slow connection, and a farmer who reads Hindi.

Open the app, pick your crop and district, and see:

- the **latest reported modal price** for the mandi,
- how it moved against the **last reported price**, with the date of that comparison,
- **nearby mandis ranked by price**, so the best option is obvious,
- the **last-known rate** for a mandi that has stopped reporting, clearly labelled old,
- a **7-day trend** where missing days stay missing.

No login. No ads. No hidden spread. No invented prices.

## Why it is different

**It refuses to guess.**
If a mandi did not report a price, the app says so. It never fills a gap, averages, or carries yesterday's rate forward as "today". A missing number is displayed as a missing number — because a farmer making a sale cannot afford a confident lie.

**It compares, not just reports.**
One mandi's rate is trivia. The nearby-mandi list turns it into a decision: *is it worth going to the next market?*

**It is built for the device in the hand.**
Hindi first, thumb-sized controls, large numbers, installable to the home screen, no app store, no build step.

**It is state-aware.**
The crop picker shows only crops that the selected state actually reports. Eight common crops stay one tap away; the full catalogue opens in a searchable sheet with fuzzy matching ("onon" finds Onion).

**It is API-first.**
The same backend can power a voice assistant, an SMS bot, or a partner app. The frontend is only the first client.

## The user journey

1. Open the installed app (or a shared link).
2. Choose a state and district once — the app remembers it.
3. Pick a crop from eight common options, or search the state's full crop list.
4. Read one large number: the latest reported modal price.
5. Scan the nearby mandi list to see who pays more.
6. Check the last seven days before deciding to travel or sell.

The whole flow is designed to fit on one phone screen and to be understood without reading instructions.

## Who it is for

- **Small and marginal farmers** checking a price before a mandi trip.
- **Farmer producer organisations (FPOs)** and rural entrepreneurs advising members.
- **Field workers and extension officers** who need a quick, credible reference.
- **Agri-fintech and market-linkage platforms** that want a clean price API.

## How it works

```
Phone / browser
   |  fetch JSON (read-only)
   v
FastAPI  --->  pandas DataFrame (cached in memory)
   ^
   |  cleaned CSV
   |
data.gov.in / AGMARKNET snapshot
```

- The **backend** normalises the raw mandi snapshot, validates dates and prices, deduplicates observations, and serves it through a small read-only REST API.
- The **frontend** fetches the state's crops, districts, markets, and price history, then applies a set of pure pricing rules before anything is drawn.
- **Rules live in one place.** `frontend/logic.js` decides what counts as reported, what counts as old, and how direction and trends are calculated. The UI only renders those decisions.

### Data rules

| Rule | Behaviour |
| --- | --- |
| A price is reported | Only when it is a positive, finite number |
| Missing day | Shown as a gap — never filled |
| Mandi with no price today | Shown as *no rate*, with its last-known rate labelled *old* |
| Direction | Latest reported price vs previous **reported** price, with that date |
| Trend | Last 7 calendar days anchored on the newest reported date |
| Cents of truth | Rate means **modal price**: the price most deals were made at |

## Features

- Latest reported modal price, with min/max exposed by the API
- Nearby-mandi comparison, highest price first
- Direction arrows with the previous comparison date
- Last-known rate for mandis that stopped reporting
- 7-day trend with gaps preserved
- State-specific crop catalogue (no irrelevant crops)
- Up to eight featured crops plus full-list fuzzy search
- Hindi and English interface
- Indian number and date formatting
- Installable PWA with an offline app shell
- Responsive layout: phone-first, two-column on desktop with an independently scrollable mandi list
- Stale-data banner when the newest report is more than three days old
- Public OpenAPI docs at `/docs`

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| API | FastAPI + pandas | Fast to build, typed, self-documenting |
| Data | CSV snapshot + cleaning script | Works offline, easy to audit, no database to operate |
| Frontend | Vanilla HTML/CSS/ES modules | No build step, tiny payload, runs on cheap phones |
| Offline | Service worker | Instant repeat launches and a cached app shell |
| Tests | pytest + Node test runner | Rules are tested without a browser |

## Run it locally

**Prerequisites:** Python 3, Node 18+ (only for the frontend tests), `pip install -r agri/requirements.txt`.

```bash
./start-merged.sh
```

Then open **http://localhost:5173**.

| Service | URL |
| --- | --- |
| App | http://localhost:5173 |
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| Health | http://localhost:8000/api/v1/health |

On Windows:

```cmd
start-merged.bat
```

Ctrl+C stops both services. Logs are written to `.merged-backend.log` and `.merged-frontend.log`. The launcher checks for port conflicts and fails clearly instead of leaving orphaned processes.

## API

All endpoints are read-only and prefixed with `/api/v1`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Dataset status, record count, latest observation |
| GET | `/states` | States present in the dataset |
| GET | `/commodities?state=` | Crops available in a state (or globally) |
| GET | `/districts?state=` | Districts in a state |
| GET | `/markets?state=&district=&commodity=` | Markets for a crop in a district |
| GET | `/prices/latest?state=&district=&commodity=&market=` | Latest observation per market |
| GET | `/prices/history?state=&district=&market=&commodity=&days=` | Observation history |
| GET | `/mandis/compare?state=&district=&commodity=` | Latest prices ranked for comparison |

Example:

```bash
curl "http://localhost:8000/api/v1/prices/history?state=Uttar%20Pradesh&district=Lucknow&market=Lucknow&commodity=Wheat&days=7"
```

## Loading your own data

The API reads `agri/data/processed/mandi_prices.csv`. To rebuild it from a new snapshot:

```bash
cp your_mandi_datagov.csv agri/data/raw/mandi_datagov.csv
cd agri
PYTHONPATH=. python3 scripts/clean_data.py
```

To fetch directly from data.gov.in, put `DATA_GOV_API_KEY` in `agri/.env` and run `agri/scripts/fetch_data.py`, then `clean_data.py`. Never commit `.env`.

Supported input columns include the usual AGMARKNET variants (`State`, `District`, `Market`, `Commodity`, `Arrival_Date`, `Min Price`, `Max Price`, `Modal Price`), with both `DD/MM/YYYY` and ISO dates.

## Project structure

```
.
├── agri/                         # FastAPI backend
│   ├── app/
│   │   ├── main.py               # app factory, CORS, routers
│   │   ├── config.py             # settings and data paths
│   │   ├── api/routes/           # health, locations, prices
│   │   ├── data/loader.py        # CSV -> validated, cached DataFrame
│   │   └── services/             # pricing, comparison, change rules
│   ├── scripts/                  # fetch + clean the snapshot
│   ├── data/                     # raw and processed CSVs
│   └── tests/                    # pytest
├── frontend/                     # installable PWA
│   ├── index.html
│   ├── app.js                    # boot, state, rendering, events
│   ├── api.js                    # HTTP client and transformers
│   ├── logic.js                  # pure pricing rules (no DOM)
│   ├── i18n.js                   # Hindi/English strings and formatting
│   ├── icons.js                  # inline SVG crop icons
│   ├── styles.css                # responsive design
│   ├── sw.js                     # service worker cache
│   └── tests/logic.test.mjs      # price-rule tests
├── start-merged.sh               # run backend + frontend together
└── start-merged.bat              # Windows launcher
```

## Tests

```bash
cd frontend && node --test tests/logic.test.mjs
cd agri && python3 -m pytest
```

The frontend suite covers the rules that matter most: missing prices, old rates, direction across gaps, nearby ranking, duplicate market names across states, and trend gaps.

## Roadmap

- Cache the last successful price snapshot for true offline browsing
- Ingest multiple days of snapshots so every market has a real trend
- Nearest-mandi selection by GPS and travel distance
- Transport-cost-aware "worth the trip" comparison
- SMS / WhatsApp price alerts for low-connectivity users
- More languages: Marathi, Punjabi, Telugu, Tamil, Bengali
- Deployed API with rate limiting and a CDN-hosted frontend
- Partner API keys for FPOs and agri platforms

## Status and honest limits

This is a working prototype, not a live national service.

- It is read-only: no accounts, no selling, no payments.
- Prices depend entirely on the freshness of the uploaded government snapshot. If the snapshot is one day old, the trend has one point — the app says so rather than inventing history.
- The service worker caches the app shell; price data still needs the API.
- Development CORS allows `localhost:3000` and `localhost:5173`. Set `CORS_ORIGINS` in `agri/.env` before deploying.
- The dataset licence and deployment terms should be reviewed before public distribution.

---

**Aaj Ka Bhav** — because the price you don't know is the price you lose.
