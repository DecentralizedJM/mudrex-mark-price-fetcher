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
import { runLiquidationCheck } from './server-lib/liquidation-check.ts';
import { applySecurityHeaders } from './server-lib/security-headers.ts';
import {
  adminLoginSchema,
  formatZodError,
  liquidationCheckSchema,
  lookupParamsSchema,
  usageTrackSchema,
} from './server-lib/validation-schemas.ts';
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
app.set('trust proxy', 1);
applySecurityHeaders(app);
app.use(express.json({ limit: '16kb' }));

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const generalMax = Number(process.env.RATE_LIMIT_MAX) || 120;
const apiMax = Number(process.env.RATE_LIMIT_API_MAX) || 30;

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

const adminLoginLimiter = rateLimit({
  windowMs,
  max: Number(process.env.ADMIN_LOGIN_RATE_LIMIT_MAX) || 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please wait and try again.' },
});

app.use(generalLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

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
  const parsed = usageTrackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: formatZodError(parsed.error) });
    return;
  }

  const body = parsed.data;
  recordUsageEvent({
    ...getRequestMeta(req),
    action: body.action,
    status: 'success',
    symbol: body.symbol,
    startTime: body.startTime,
    endTime: body.endTime,
    timezone: body.timezone,
    aggregation: body.aggregation,
    rowCount: body.rowCount,
    csvFilename: body.csvFilename,
  });

  res.json({ ok: true });
});

app.post('/api/prices', apiLimiter, async (req, res) => {
  const parsed = lookupParamsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: formatZodError(parsed.error) });
    return;
  }

  const started = Date.now();
  const meta = getRequestMeta(req);
  const params = parsed.data as LookupParams;
  const result = await fetchPriceData(params);
  const durationMs = Date.now() - started;

  if ('message' in result && !('rows' in result)) {
    const isValidation =
      result.message.includes('required') ||
      result.message.includes('Invalid') ||
      result.message.includes('cannot exceed') ||
      result.message.includes('must be after') ||
      result.message.includes('too large') ||
      result.message.includes('not a listed') ||
      result.message.includes('no recent kline') ||
      result.message.includes('No price data');

    recordUsageEvent({
      ...meta,
      action: 'price_fetch',
      status: isValidation ? 'validation_error' : 'api_error',
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

app.post('/api/liquidation/check', apiLimiter, async (req, res) => {
  const parsed = liquidationCheckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: formatZodError(parsed.error) });
    return;
  }

  const result = await runLiquidationCheck(parsed.data);
  res.json(result);
});

app.post('/admin/api/login', adminLoginLimiter, (req, res) => {
  if (!isAdminConfigured()) {
    res.status(503).json({ message: 'Admin is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.' });
    return;
  }

  const parsed = adminLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: formatZodError(parsed.error) });
    return;
  }

  const { email, password } = parsed.data;
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
