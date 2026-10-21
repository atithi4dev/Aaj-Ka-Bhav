# आज का भाव — Aaj Ka Bhav

### The mandi rate, in the farmer's hand.

**A Hindi-first, phone-first price app that answers the one question that decides a farmer's income: *what is my crop worth today, and where will I get the most for it?***

Built by **team kitty**.

---

## The problem

Every day, farmers sell crops without knowing the price. The official mandi data exists, but it is scattered across government portals, English-first, and designed for a desktop. By the time the number is found, the deal is already done.

Three things are missing at the moment of sale:

1. **One clear number** for the crop, the district, and the day.
2. **Comparison** with nearby mandis, so the farmer knows whether the trip is worth it.
3. **Trust**: certainty about whether that number is really today's price.

## The solution

Aaj Ka Bhav turns the AGMARKNET feed into **a single screen built for a small phone, a slow connection, and a farmer who reads Hindi.**

Pick your crop and district, and instantly see:

- the **latest reported modal price** at your mandi,
- how it moved against the **previous reported price**, with the date of comparison,
- **nearby mandis ranked by price**, so the best option is obvious at a glance,
- the **last-known rate** for any mandi that has stopped reporting, clearly labelled as old,
- a **7-day trend** that shows real data and nothing else.

**No login. No ads. No hidden spread. No invented prices.**

## What makes it different

**Trust is the product.**
Most price tools quietly fill gaps. Aaj Ka Bhav never does. If a mandi did not report, the app says so. It never averages, estimates, or passes off yesterday's rate as today's. A farmer making a sale deserves a number he can rely on, and that promise is built into the code, not just the copy.

**It turns a number into a decision.**
One mandi's rate is trivia. The ranked nearby-mandi list answers the real question: *is it worth going to the next market?*

**It is built for the device in the hand.**
Hindi first, thumb-sized controls, large readable numbers, installable to the home screen. No app store. No build step. Fast on cheap phones.

**It is state-aware.**
The crop picker shows only crops that the selected state actually reports. Eight common crops stay one tap away, and the full catalogue opens in a searchable sheet with fuzzy matching ("onon" finds Onion).

**It is API-first.**
The same backend can power a voice assistant, an SMS bot, or a partner app. The web app is simply the first client.

## The user journey

1. Open the installed app or a shared link.
2. Choose your state and district once. The app remembers.
3. Tap a crop from eight common options, or search the state's full list.
4. Read one large number: today's latest modal price.
5. Scan the nearby mandis to see who pays more.
6. Check the last seven days, then decide whether to sell or travel.

The whole flow fits on one phone screen and needs no instructions.

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

- The **backend** normalises the raw mandi snapshot, validates dates and prices, deduplicates observations, and serves everything through a small, fast, read-only REST API.
- The **frontend** fetches the state's crops, districts, markets, and price history, then applies a set of pure pricing rules before anything is drawn.
- **One source of truth for the rules.** `frontend/logic.js` decides what counts as reported, what counts as old, and how direction and trends are calculated. The UI only renders those decisions, which makes the behaviour easy to test and easy to trust.

### Data rules

| Rule | Behaviour |
| --- | --- |
| A price is reported | Only when it is a positive, finite number |
| Missing day | Shown as a gap, never filled |
| Mandi with no price today | Shown as *no rate*, with its last-known rate labelled *old* |
| Direction | Latest reported price vs previous **reported** price, with that date |
| Trend | Last 7 calendar days anchored on the newest reported date |
| Rate | The **modal price**: the price at which most deals were made |

## Features

- Latest reported modal price, with min/max exposed by the API
- Nearby-mandi comparison, highest price first
- Direction arrows with the previous comparison date
- Last-known rate for mandis that stopped reporting
- 7-day trend with honest gaps
- State-specific crop catalogue (no irrelevant crops)
- Up to eight featured crops plus full-list fuzzy search
- Hindi and English interface
- Indian number and date formatting
- Installable PWA with an offline app shell for instant repeat launches
- Responsive layout: phone-first, two-column on desktop with an independently scrollable mandi list
- Freshness banner that warns when the newest report is more than three days old
- Public OpenAPI docs at `/docs`

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| API | FastAPI + pandas | Fast to build, typed, self-documenting |
| Data | CSV snapshot + cleaning script | Auditable, portable, no database to operate |
| Frontend | Vanilla HTML/CSS/ES modules | No build step, tiny payload, runs on cheap phones |
| Offline | Service worker | Instant repeat launches and a cached app shell |
| Tests | pytest + Node test runner | Pricing rules are tested without a browser |

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

## Bring your own data

The API reads `agri/data/processed/mandi_prices.csv`. To rebuild it from a new snapshot:

```bash
cp your_mandi_datagov.csv agri/data/raw/mandi_datagov.csv
cd agri
PYTHONPATH=. python3 scripts/clean_data.py
```

To pull directly from data.gov.in, put `DATA_GOV_API_KEY` in `agri/.env`, run `agri/scripts/fetch_data.py`, then `clean_data.py`. Never commit `.env`.

Supported input columns cover the usual AGMARKNET variants (`State`, `District`, `Market`, `Commodity`, `Arrival_Date`, `Min Price`, `Max Price`, `Modal Price`), with both `DD/MM/YYYY` and ISO dates.

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

## Tested where it matters

```bash
cd frontend && node --test tests/logic.test.mjs
cd agri && python3 -m pytest
```

The frontend suite locks in the rules that protect the farmer: missing prices, old rates, direction across gaps, nearby ranking, duplicate market names across states, and trend gaps.

## What's next

- Offline browsing of the last successful price snapshot
- Multi-day snapshot ingestion for a full trend at every market
- Nearest-mandi selection by GPS and travel distance
- Transport-cost-aware "worth the trip" comparison
- SMS / WhatsApp price alerts for low-connectivity users
- More languages: Marathi, Punjabi, Telugu, Tamil, Bengali
- Hosted API with rate limiting and a CDN-delivered frontend
- Partner API keys for FPOs and agri platforms

## Ready for deployment

Aaj Ka Bhav is a lean, read-only service with no database and no accounts, so it is simple to host and cheap to run. Before going public, set `CORS_ORIGINS` in `agri/.env` to your production domain and confirm the data licence terms for your deployment.

---

**Aaj Ka Bhav**: because the price you don't know is the price you lose.