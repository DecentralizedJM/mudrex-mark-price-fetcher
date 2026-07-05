# PriceFetcher

**Mudrex LTP & Mark Price Lookup** — internal support dashboard for historical Last Traded Price (LTP) and Mark Price data around incident timestamps.

Built for support staff who need self-serve price lookups without API keys, terminal commands, or epoch math.

## Repository

The app lives in [`marktrace/`](marktrace/). See [marktrace/README.md](marktrace/README.md) for full setup, deployment, and usage details.

## Quick start

```bash
cd marktrace
npm install
npm run dev      # API on :3000, web on :5173
npm run build
npm start        # production (Railway)
```

## Deploy on Railway

This repo includes a root `Dockerfile` — connect the repo to Railway and deploy from the **repository root**. No env vars required.

**Live app:** https://mudrex-mark-price-fetcher-production.up.railway.app

### DNS / VPN troubleshooting

If you see `ERR_NAME_NOT_RESOLVED` or `DNS_PROBE_POSSIBLE`, **Twingate or Tailscale** is likely hijacking DNS and blocking `*.up.railway.app` lookups.

1. Quit **Twingate** from the menu bar (or disconnect the VPN).
2. Set Wi‑Fi DNS to `8.8.8.8` and `1.1.1.1` (System Settings → Network → Wi‑Fi → DNS).
3. Or run from repo root: `bash scripts/fix-pricefetch-dns.sh` (prompts for sudo to flush cache / update hosts).

Optional rate-limit tuning:

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `120` | Max requests per IP (general) |
| `RATE_LIMIT_API_MAX` | `30` | Max price lookups per IP |

## Developed by

Jithin Mohandas — [GitHub](https://github.com/DecentralizedJM)
