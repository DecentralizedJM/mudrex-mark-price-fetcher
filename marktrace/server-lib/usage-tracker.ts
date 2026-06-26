import type {
  IpSummary,
  UsageEvent,
  UsageEventInput,
  UsageStats,
} from '../src/lib/usage-types.ts';

const MAX_EVENTS = Number(process.env.USAGE_MAX_EVENTS) || 100000;

const events: UsageEvent[] = [];
let eventCounter = 0;

function nextId(): string {
  eventCounter += 1;
  return `${Date.now()}-${eventCounter}`;
}

export function recordUsageEvent(input: UsageEventInput): UsageEvent {
  const event: UsageEvent = {
    id: nextId(),
    timestamp: new Date().toISOString(),
    ...input,
  };

  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }

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
