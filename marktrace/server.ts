import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { fetchPriceData } from './src/lib/api.ts';
import { setListedSymbols } from './src/lib/symbols.ts';
import type { LookupParams } from './src/lib/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const distPath = path.join(__dirname, 'dist');

// Load listed symbols for server-side validation
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
  message: { message: 'Price lookup rate limit reached. Please wait before fetching again.' },
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

app.post('/api/prices', apiLimiter, async (req, res) => {
  const params = req.body as LookupParams;
  const result = await fetchPriceData(params);

  if ('message' in result && !('rows' in result)) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

app.use(express.static(distPath, { maxAge: '1h', index: false }));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`PriceFetcher serving on port ${PORT}`);
});
