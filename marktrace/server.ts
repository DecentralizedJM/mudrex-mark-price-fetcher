import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import {
  clearAdminSession,
  getAdminSession,
  isAdminConfigured,
  requireAdmin,
  setAdminSession,
  validateAdminCredentials,
} from './server-lib/admin-auth.ts';
import { fetchPriceData } from './src/lib/api.ts';
import { setListedSymbols } from './src/lib/symbols.ts';
import type { LookupParams } from './src/lib/types.ts';
import {
  getFailedUsageEvents,
  getIpSummaries,
  getRecentUsageEvents,
  getRequestMeta,
  getUsageStats,
  recordUsageEvent,
} from './server-lib/usage-tracker.ts';
import {
  runLiquidationCheck,
  type LiquidationCheckInput,
} from './server-lib/liquidation-check.ts';
import { isPeerExchangeId, PEER_EXCHANGE_IDS } from './server-lib/peer-exchanges.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const distPath = path.join(__dirname, 'dist');

try {
  const symbolsPath = path.join(__dirname, 'public', 'all-futures-symbols.json');
  const raw = readFileSync(symbolsPath, 'utf-8');
  const symbols = JSON.parse(raw) as string[];
  setListedSymbols(symbols);
} catch (err) {
  console.warn('Could not load symbol list:', err);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '16kb' }));

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const generalMax = Number(process.env.RATE_LIMIT_MAX) || 60;
const apiMax = Number(process.env.RATE_LIMIT_API_MAX) || 20;
const liqMax = Number(process.env.RATE_LIMIT_LIQ_MAX) || 10;

const generalLimiter = rateLimit({
  windowMs,
  max: generalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please wait a few minutes and try again.' },
});

const apiLimiter = rateLimit({
  windowMs,
  max: apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    recordUsageEvent({
      ...getRequestMeta(req),
      action: 'rate_limited',
      status: 'rate_limited',
      errorMessage: 'Price lookup rate limit reached.',
    });
    res.status(429).json({
      message: 'Price lookup rate limit reached. Please wait before fetching again.',
    });
  },
});

const liquidationLimiter = rateLimit({
  windowMs,
  max: liqMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    recordUsageEvent({
      ...getRequestMeta(req),
      action: 'rate_limited',
      status: 'rate_limited',
      errorMessage: 'Liquidation check rate limit reached.',
    });
    res.status(429).json({
      message: 'Liquidation check rate limit reached. Please wait before trying again.',
    });
  },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use(generalLimiter);

app.get('/api/symbols', (_req, res) => {
  try {
    const symbolsPath = path.join(__dirname, 'public', 'all-futures-symbols.json');
    const raw = readFileSync(symbolsPath, 'utf-8');
    res.type('json').send(raw);
  } catch {
    res.status(500).json({ message: 'Symbol list unavailable.' });
  }
});

app.post('/api/usage/track', (req, res) => {
  const body = req.body as Record<string, unknown>;
  const action = body.action;

  if (action !== 'page_load' && action !== 'csv_download') {
    res.status(400).json({ message: 'Invalid tracking action.' });
    return;
  }

  recordUsageEvent({
    ...getRequestMeta(req),
    action,
    status: 'success',
    symbol: typeof body.symbol === 'string' ? body.symbol : undefined,
    startTime: typeof body.startTime === 'string' ? body.startTime : undefined,
    endTime: typeof body.endTime === 'string' ? body.endTime : undefined,
    timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
    aggregation: typeof body.aggregation === 'string' ? body.aggregation : undefined,
    rowCount: typeof body.rowCount === 'number' ? body.rowCount : undefined,
    csvFilename: typeof body.csvFilename === 'string' ? body.csvFilename : undefined,
  });

  res.json({ ok: true });
});

function parseLiquidationCheckBody(body: unknown): LiquidationCheckInput | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid request body.' };
  }

  const raw = body as Record<string, unknown>;
  const input: LiquidationCheckInput = {
    symbol: String(raw.symbol ?? ''),
    side: raw.side as LiquidationCheckInput['side'],
    leverage: raw.leverage as LiquidationCheckInput['leverage'],
    entryPrice: raw.entryPrice as LiquidationCheckInput['entryPrice'],
    liquidationPrice: raw.liquidationPrice as LiquidationCheckInput['liquidationPrice'],
    liquidationTime: String(raw.liquidationTime ?? ''),
    timezone: raw.timezone as LiquidationCheckInput['timezone'],
  };

  if (raw.peerExchanges !== undefined) {
    if (!Array.isArray(raw.peerExchanges)) {
      return { error: 'peerExchanges must be an array of exchange ids.' };
    }
    if (raw.peerExchanges.length > PEER_EXCHANGE_IDS.length) {
      return { error: `At most ${PEER_EXCHANGE_IDS.length} peer exchanges can be selected.` };
    }
    const unique: LiquidationCheckInput['peerExchanges'] = [];
    for (const item of raw.peerExchanges) {
      if (typeof item !== 'string' || !isPeerExchangeId(item)) {
        return {
          error: `Invalid peer exchange. Allowed: ${PEER_EXCHANGE_IDS.join(', ')}.`,
        };
      }
      if (!unique.includes(item)) {
        unique.push(item);
      }
    }
    if (unique.length > 0) {
      input.peerExchanges = unique;
    }
  }

  return input;
}

app.post('/api/liquidation/check', liquidationLimiter, async (req, res) => {
  const started = Date.now();
  const meta = getRequestMeta(req);
  const parsed = parseLiquidationCheckBody(req.body);
  if ('error' in parsed) {
    res.status(400).json({ kind: 'error', message: parsed.error });
    return;
  }
  const body = parsed;
  const result = await runLiquidationCheck(body);
  const durationMs = Date.now() - started;

  recordUsageEvent({
    ...meta,
    action: 'price_fetch',
    status: result.kind === 'error' ? 'validation_error' : 'success',
    symbol: typeof body.symbol === 'string' ? body.symbol : undefined,
    startTime: typeof body.liquidationTime === 'string' ? body.liquidationTime : undefined,
    endTime: typeof body.liquidationTime === 'string' ? body.liquidationTime : undefined,
    timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
    aggregation: '1m',
    durationMs,
    errorMessage: result.kind === 'error' ? result.message : undefined,
  });

  if (result.kind === 'error') {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

app.post('/api/prices', apiLimiter, async (req, res) => {
  const started = Date.now();
  const meta = getRequestMeta(req);
  const params = req.body as LookupParams;
  const result = await fetchPriceData(params);
  const durationMs = Date.now() - started;

  if ('message' in result && !('rows' in result)) {
    recordUsageEvent({
      ...meta,
      action: 'price_fetch',
      status: 'validation_error',
      symbol: params.symbol,
      startTime: params.startTime,
      endTime: params.endTime,
      timezone: params.timezone,
      aggregation: params.aggregation,
      durationMs,
      errorMessage: result.message,
    });
    res.status(400).json(result);
    return;
  }

  recordUsageEvent({
    ...meta,
    action: 'price_fetch',
    status: 'success',
    symbol: result.normalizedSymbol,
    startTime: params.startTime,
    endTime: params.endTime,
    timezone: params.timezone,
    aggregation: params.aggregation,
    rowCount: result.summary.rowCount,
    durationMs,
    maxMarkLtpGapPct: result.summary.maxMarkLtpGapPct,
  });

  res.json(result);
});

app.post('/admin/api/login', (req, res) => {
  if (!isAdminConfigured()) {
    res.status(503).json({ message: 'Admin is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.' });
    return;
  }

  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required.' });
    return;
  }

  if (validateAdminCredentials(email, password)) {
    setAdminSession(res, email.trim());
    res.json({ ok: true, email: email.trim() });
    return;
  }

  recordUsageEvent({
    ...getRequestMeta(req),
    action: 'admin_login_failed',
    status: 'failed',
    errorMessage: 'Invalid admin credentials',
  });
  res.status(401).json({ message: 'Invalid email or password.' });
});

app.post('/admin/api/logout', (req, res) => {
  clearAdminSession(res);
  res.json({ ok: true });
});

app.get('/admin/api/me', (req, res) => {
  const session = getAdminSession(req);
  if (!session) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  res.json({ email: session.email });
});

app.get('/admin/api/stats', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    stats: getUsageStats(),
    ipSummaries: getIpSummaries(),
  });
});

app.get('/admin/api/events', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const actionFilter = typeof req.query.action === 'string' ? req.query.action : undefined;
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;

  let events = getRecentUsageEvents(500);
  if (actionFilter) {
    events = events.filter((event) => event.action === actionFilter);
  }
  if (statusFilter) {
    events = events.filter((event) => event.status === statusFilter);
  }

  res.json({
    events,
    failed: getFailedUsageEvents(100),
  });
});

app.use(express.static(distPath, { maxAge: '1h', index: false }));

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(distPath, 'admin.html'));
});

app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(distPath, 'admin.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PriceFetcher serving on port ${PORT}`);
});
