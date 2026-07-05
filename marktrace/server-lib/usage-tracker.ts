import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import path from 'node:path';
import type {
  IpSummary,
  UsageEvent,
  UsageEventInput,
  UsageStats,
} from '../src/lib/usage-types.ts';

/**
 * DPDP (India): client IPs are personal data. We store a one-way HMAC digest
 * instead of raw IPs so the admin dashboard can group activity without retaining
 * reversible identifiers. Compliance should sign off on this approach + retention.
 */
const MAX_EVENTS = Number(process.env.USAGE_MAX_EVENTS) || 100000;
const RETENTION_DAYS = Number(process.env.USAGE_RETENTION_DAYS) || 90;
const DATA_DIR = process.env.USAGE_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/data' : './data');
const EVENTS_FILE = path.join(DATA_DIR, 'usage-events.jsonl');

const events: UsageEvent[] = [];
let eventCounter = 0;
let persistenceReady = false;

function getIpHashSecret(): string {
  return (
    process.env.IP_HASH_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    'pricefetch-dev-ip-hash'
  );
}

export function hashClientIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  return createHmac('sha256', getIpHashSecret()).update(ip).digest('hex').slice(0, 16);
}

function retentionCutoffIso(): string {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return new Date(cutoff).toISOString();
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function pruneEvents(): void {
  const cutoff = retentionCutoffIso();
  const retained = events.filter((event) => event.timestamp >= cutoff);
  events.length = 0;
  events.push(...retained.slice(0, MAX_EVENTS));
}

function loadPersistedEvents(): void {
  try {
    ensureDataDir();
    if (!existsSync(EVENTS_FILE)) return;

    const raw = readFileSync(EVENTS_FILE, 'utf-8');
    const lines = raw.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as UsageEvent;
        if (parsed.id && parsed.timestamp && parsed.ip && parsed.action) {
          events.push(parsed);
        }
      } catch {
        // skip corrupt lines
      }
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    pruneEvents();
    eventCounter = events.length;
  } catch (err) {
    console.warn('Could not load usage events:', err);
  } finally {
    persistenceReady = true;
  }
}

function persistEvent(event: UsageEvent): void {
  if (!persistenceReady) return;
  try {
    ensureDataDir();
    appendFileSync(EVENTS_FILE, `${JSON.stringify(event)}\n`, 'utf-8');
  } catch (err) {
    console.warn('Could not persist usage event:', err);
  }
}

function nextId(): string {
  eventCounter += 1;
  return `${Date.now()}-${eventCounter}`;
}

function sanitizeInput(input: UsageEventInput): UsageEventInput {
  return {
    ...input,
    ip: hashClientIp(input.ip),
  };
}

loadPersistedEvents();

export function recordUsageEvent(input: UsageEventInput): UsageEvent {
  const event: UsageEvent = {
    id: nextId(),
    timestamp: new Date().toISOString(),
    ...sanitizeInput(input),
  };

  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }

  persistEvent(event);
  return event;
}

export function getRecentUsageEvents(limit = 200): UsageEvent[] {
  return events.slice(0, limit);
}

export function getFailedUsageEvents(limit = 100): UsageEvent[] {
  return events
    .filter(
      (e) =>
        e.status === 'validation_error' ||
        e.status === 'api_error' ||
        e.action === 'rate_limited' ||
        e.action === 'admin_login_failed',
    )
    .slice(0, limit);
}

export function getUsageStats(): UsageStats {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const ips = new Set<string>();

  let pageLoads = 0;
  let priceFetches = 0;
  let csvDownloads = 0;
  let failedFetches = 0;
  let rateLimited = 0;
  let successfulFetches = 0;
  let eventsLast24h = 0;

  for (const event of events) {
    ips.add(event.ip);
    if (new Date(event.timestamp).getTime() >= dayAgo) {
      eventsLast24h += 1;
    }

    switch (event.action) {
      case 'page_load':
        pageLoads += 1;
        break;
      case 'price_fetch':
        priceFetches += 1;
        if (event.status === 'success') successfulFetches += 1;
        if (event.status === 'validation_error' || event.status === 'api_error') {
          failedFetches += 1;
        }
        break;
      case 'csv_download':
        csvDownloads += 1;
        break;
      case 'rate_limited':
        rateLimited += 1;
        break;
      default:
        break;
    }
  }

  return {
    totalEvents: events.length,
    uniqueIps: ips.size,
    pageLoads,
    priceFetches,
    csvDownloads,
    failedFetches,
    rateLimited,
    eventsLast24h,
    successfulFetches,
  };
}

export function getIpSummaries(): IpSummary[] {
  const map = new Map<string, IpSummary>();

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    let summary = map.get(event.ip);

    if (!summary) {
      summary = {
        ip: event.ip,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
        pageLoads: 0,
        priceFetches: 0,
        csvDownloads: 0,
        failedFetches: 0,
        rateLimited: 0,
        lastAction: event.action,
        userAgent: event.userAgent,
      };
      map.set(event.ip, summary);
    } else {
      summary.lastSeen = event.timestamp;
    }

    switch (event.action) {
      case 'page_load':
        summary.pageLoads += 1;
        break;
      case 'price_fetch':
        summary.priceFetches += 1;
        if (event.status === 'validation_error' || event.status === 'api_error') {
          summary.failedFetches += 1;
        }
        break;
      case 'csv_download':
        summary.csvDownloads += 1;
        break;
      case 'rate_limited':
        summary.rateLimited += 1;
        break;
      default:
        break;
    }

    if (event.symbol) summary.lastSymbol = event.symbol;
    if (event.startTime) summary.lastStartTime = event.startTime;
    if (event.endTime) summary.lastEndTime = event.endTime;
    if (event.timezone) summary.lastTimezone = event.timezone;
    summary.lastAction = event.action;
    summary.userAgent = event.userAgent;
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
  );
}

export function getRequestMeta(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): Pick<UsageEventInput, 'ip' | 'userAgent' | 'referer'> {
  const ua = req.headers['user-agent'];
  const referer = req.headers.referer ?? req.headers.referrer;

  return {
    ip: req.ip ?? 'unknown',
    userAgent: typeof ua === 'string' ? ua : 'unknown',
    referer: typeof referer === 'string' ? referer : undefined,
  };
}
