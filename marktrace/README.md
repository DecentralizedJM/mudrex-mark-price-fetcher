# MarkTrace

**Mudrex LTP & Mark Price Lookup** — an internal, public (no-auth) support dashboard for looking up historical Last Traded Price (LTP) and Mark Price data around incident timestamps.

Built for Mudrex support staff who need self-serve access to price data without API keys, terminal commands, or epoch math. MarkTrace calls Mudrex's public FAPI v1 Price REST endpoints directly from the browser.

## Quick start

```bash
cd marktrace
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
npm start        # serves production build (Railway)
```

## Railway deployment

1. Connect this repo to Railway.
2. Set the **Root Directory** to `marktrace` (if deploying from monorepo root).
3. Railway auto-detects Node.js. Build and start commands:
   - **Build:** `npm run build`
   - **Start:** `npm start`
4. The Express server serves the static Vite build on `PORT` (Railway sets this automatically).

No environment variables or secrets are required.

## Usage

1. Enter a symbol (e.g. `ESPORTS/USDT`, `esportsusdt`, or `ESPORTSUSDT`).
2. Pick the incident date and local start/end times.
3. Choose timezone (IST or UTC), interval, and optional buffer minutes.
4. Click **Fetch prices** to load LTP and Mark candles side by side.
5. Review the summary, automated analysis, and download CSV for tickets.

## API

Uses public endpoints (no authentication):

- `GET https://trade.mudrex.com/fapi/v1/price/kline` — LTP candles
- `GET https://trade.mudrex.com/fapi/v1/price/mark-kline` — Mark candles

Query params: `assets`, `aggregation`, `start_time`, `end_time` (epoch seconds UTC).

## Manual QA scenarios

| Symbol | Date | Time (IST) | Notes |
|--------|------|------------|-------|
| ESPORTS/USDT | 2026-06-18 | 04:38–04:44 | Mark low ~0.12058 at 04:42 |
| ESPORTS/USDT | 2026-06-18 | 15:54–16:04 | Mark spike ~0.165 at 16:01 |
| EVAA/USDT | 2026-06-15 | 17:23–17:33 | Sharp LTP wick at 17:23 |
