# PriceFetcher

**Mudrex LTP & Mark Price Lookup** — an internal, public (no-auth) support dashboard for looking up historical Last Traded Price (LTP) and Mark Price data around incident timestamps.

Built for Mudrex support staff who need self-serve access to price data without API keys, terminal commands, or epoch math.

## Features

- Symbol lookup with autocomplete and **listed-symbol validation**
- Start/end **datetime picker** (IST or UTC)
- Side-by-side **LTP + Mark** candles in one table
- **Rule-based price movement analysis** for liquidation/support tickets
- **CSV export** (UTF-8 BOM, Excel-friendly)
- Light / dark mode
- **Rate limiting** on price API routes (anti-abuse)
- Max time range: **24 hours**

## Quick start

```bash
cd marktrace
npm install
npm run dev      # Express API :3000 + Vite :5173 (proxied /api)
npm run build
npm start        # production server
```

Open [http://localhost:5173](http://localhost:5173) after `npm run dev`.

## Railway deployment

Deploy from the **repository root** (not this subfolder). The root `Dockerfile` builds and runs this app.

1. Connect this repo to Railway.
2. Railway uses the root `Dockerfile` automatically.
3. No secrets or env vars required for basic operation.

Optional rate limits (set in Railway variables):

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `120` | General requests per IP per window |
| `RATE_LIMIT_API_MAX` | `30` | Price fetch requests per IP per window |
| `MUDREX_FETCH_TIMEOUT_MS` | `8000` | Upstream Mudrex HTTP timeout (ms) |
| `CSP_ENFORCE` | `false` | Set `true` to enforce CSP (default is report-only) |
| `ADMIN_EMAIL` | — | Admin dashboard login email |
| `ADMIN_PASSWORD` | — | Admin dashboard login password |
| `SESSION_SECRET` | falls back to `ADMIN_PASSWORD` | HMAC secret for admin session cookies |
| `ADMIN_LOGIN_RATE_LIMIT_MAX` | `8` | Login attempts per IP per window |
| `USAGE_MAX_EVENTS` | `100000` | Max usage events kept in memory |
| `USAGE_RETENTION_DAYS` | `90` | Drop usage events older than this on load |
| `USAGE_DATA_DIR` | `/data` in production, `./data` locally | Directory for `usage-events.jsonl` |
| `IP_HASH_SECRET` | falls back to `SESSION_SECRET` / `ADMIN_PASSWORD` | HMAC key for client IP hashing (DPDP) |
| `MUDREX_API_KEY` | — | Required for liquidation asset validation |

### Admin usage dashboard

The public dashboard has **no login**. Usage is tracked silently (page loads, price fetches, CSV downloads, rate limits).

A separate admin app is available at **`/admin`** (e.g. `https://pricefetch.up.railway.app/admin`).

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Railway.

The admin dashboard shows summary stats, recent activity (filterable), per-IP breakdown with last used, and failed fetches. Client IPs are stored as HMAC digests (DPDP). Events persist to `usage-events.jsonl` under `USAGE_DATA_DIR` and are pruned by `USAGE_RETENTION_DAYS`.

**CSP:** Content-Security-Policy ships in **report-only** mode by default. Verify `/` and `/admin` in the browser console, then set `CSP_ENFORCE=true` to enforce.

Local dev: main app at [http://localhost:5173](http://localhost:5173), admin at [http://localhost:5173/admin.html](http://localhost:5173/admin.html) (production serves `/admin`).

## Usage

1. Enter a symbol (e.g. `ESPORTS/USDT`, `esportsusdt`, or `ESPORTSUSDT`).
2. Pick **start** and **end** date & time.
3. Choose timezone (IST or UTC) and candle interval.
4. Click **Fetch prices** to load LTP and Mark candles side by side.
5. Review summary, analysis, and **Download CSV** for tickets.

Invalid or unlisted symbols show a clear error with suggestions — not a generic “no data” message.

## API

Price lookups go through the app server (`POST /api/prices`) with rate limiting. The server calls Mudrex public FAPI v1 Price REST endpoints:

- `GET https://trade.mudrex.com/fapi/v1/price/kline` — LTP candles
- `GET https://trade.mudrex.com/fapi/v1/price/mark-kline` — Mark candles

Query params: `assets`, `aggregation`, `start_time`, `end_time` (epoch seconds UTC).

Listed symbols are loaded from `public/all-futures-symbols.json` — update this file to expand validation coverage.

## Manual QA scenarios

| Symbol | Date | Time (IST) | Notes |
|--------|------|------------|-------|
| ESPORTS/USDT | 2026-06-18 | 04:38–04:44 | Mark low ~0.12058 at 04:42 |
| ESPORTS/USDT | 2026-06-18 | 15:54–16:04 | Mark spike ~0.165 at 16:01 |
| EVAA/USDT | 2026-06-15 | 17:23–17:33 | Sharp LTP wick at 17:23 |

## Project structure

```
marktrace/
├── src/
│   ├── components/   # UI
│   ├── lib/          # API, symbols, CSV, analysis
│   └── hooks/        # Theme
├── public/           # favicon, symbol list
├── server.ts         # Express + rate limits + /api/prices
└── Dockerfile        # (at repo root)
```

## Credits

Developed by [Jithin Mohandas](https://github.com/DecentralizedJM)
