import { format } from 'date-fns';
import { LogOut, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import type { IpSummary, UsageEvent, UsageStats } from '../lib/usage-types';

interface DashboardPageProps {
  email: string;
  onLogout: () => void;
}

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), 'dd MMM yyyy HH:mm:ss');
  } catch {
    return iso;
  }
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4  ">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function actionLabel(action: UsageEvent['action']): string {
  switch (action) {
    case 'page_load':
      return 'Page load';
    case 'price_fetch':
      return 'Price fetch';
    case 'csv_download':
      return 'CSV download';
    case 'rate_limited':
      return 'Rate limited';
    case 'admin_login_failed':
      return 'Admin login failed';
    default:
      return action;
  }
}

export function DashboardPage({ email, onLogout }: DashboardPageProps) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [ipSummaries, setIpSummaries] = useState<IpSummary[]>([]);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [failed, setFailed] = useState<UsageEvent[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (statusFilter) params.set('status', statusFilter);

      const [statsRes, eventsRes] = await Promise.all([
        fetch('/admin/api/stats'),
        fetch(`/admin/api/events?${params.toString()}`),
      ]);

      if (statsRes.status === 401 || eventsRes.status === 401) {
        onLogout();
        return;
      }

      if (!statsRes.ok || !eventsRes.ok) {
        throw new Error('Failed to load admin data.');
      }

      const statsData = (await statsRes.json()) as {
        stats: UsageStats;
        ipSummaries: IpSummary[];
      };
      const eventsData = (await eventsRes.json()) as {
        events: UsageEvent[];
        failed: UsageEvent[];
      };

      setStats(statsData.stats);
      setIpSummaries(statsData.ipSummaries);
      setEvents(eventsData.events);
      setFailed(eventsData.failed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, statusFilter, onLogout]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void loadData();
    }, 30000);
    return () => window.clearInterval(id);
  }, [autoRefresh, loadData]);

  const handleLogout = async () => {
    await fetch('/admin/api/logout', { method: 'POST' });
    onLogout();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card  ">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              PriceFetcher Admin
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {email}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-border"
              />
              Auto-refresh (30s)
            </label>
            <Button variant="secondary" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => void handleLogout()}>
              <LogOut size={16} />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {error && (
          <p className="alert-destructive rounded-lg px-4 py-3 text-sm">
            {error}
          </p>
        )}

        {stats && (
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
            <StatCard label="Total events" value={stats.totalEvents} />
            <StatCard label="Unique IPs" value={stats.uniqueIps} />
            <StatCard label="Page loads" value={stats.pageLoads} />
            <StatCard label="Price fetches" value={stats.priceFetches} />
            <StatCard label="Successful fetches" value={stats.successfulFetches} />
            <StatCard label="CSV downloads" value={stats.csvDownloads} />
            <StatCard label="Failed fetches" value={stats.failedFetches} />
            <StatCard label="Last 24h" value={stats.eventsLast24h} />
          </section>
        )}

        <section className="rounded-xl border border-border bg-card  ">
          <div className="flex flex-col gap-3 border-b border-border px-5 py-4  sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Recent activity
            </h2>
            <div className="flex flex-wrap gap-2">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                <option value="">All actions</option>
                <option value="page_load">Page load</option>
                <option value="price_fetch">Price fetch</option>
                <option value="csv_download">CSV download</option>
                <option value="rate_limited">Rate limited</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="validation_error">Validation error</option>
                <option value="api_error">API error</option>
                <option value="rate_limited">Rate limited</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  {[
                    'Time',
                    'IP',
                    'Action',
                    'Status',
                    'Symbol',
                    'Range',
                    'TZ',
                    'Interval',
                    'Rows',
                    'Duration',
                    'Gap %',
                    'Error',
                    'User agent',
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-border"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">
                      {formatTime(event.timestamp)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{event.ip}</td>
                    <td className="whitespace-nowrap px-3 py-2">{actionLabel(event.action)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{event.status}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{event.symbol ?? '-'}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {event.startTime && event.endTime
                        ? `${event.startTime} → ${event.endTime}`
                        : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{event.timezone ?? '-'}</td>
                    <td className="whitespace-nowrap px-3 py-2">{event.aggregation ?? '-'}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{event.rowCount ?? '-'}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {event.durationMs != null ? `${event.durationMs}ms` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {event.maxMarkLtpGapPct != null ? `${event.maxMarkLtpGapPct.toFixed(4)}%` : '-'}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs" title={event.errorMessage}>
                      {event.errorMessage ?? '-'}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-xs" title={event.userAgent}>
                      {event.userAgent}
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                      No events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card  ">
          <div className="border-b border-border px-5 py-4 ">
            <h2 className="text-base font-semibold text-foreground">
              By IP (last used)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  {[
                    'IP',
                    'First seen',
                    'Last seen',
                    'Page loads',
                    'Fetches',
                    'CSV',
                    'Failed',
                    'Rate limited',
                    'Last action',
                    'Last symbol',
                    'Last range',
                    'User agent',
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ipSummaries.map((row) => (
                  <tr key={row.ip} className="border-b border-border">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{row.ip}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">
                      {formatTime(row.firstSeen)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">
                      {formatTime(row.lastSeen)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.pageLoads}</td>
                    <td className="px-3 py-2 tabular-nums">{row.priceFetches}</td>
                    <td className="px-3 py-2 tabular-nums">{row.csvDownloads}</td>
                    <td className="px-3 py-2 tabular-nums">{row.failedFetches}</td>
                    <td className="px-3 py-2 tabular-nums">{row.rateLimited}</td>
                    <td className="whitespace-nowrap px-3 py-2">{actionLabel(row.lastAction)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{row.lastSymbol ?? '-'}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {row.lastStartTime && row.lastEndTime
                        ? `${row.lastStartTime} → ${row.lastEndTime}`
                        : '-'}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-xs" title={row.userAgent}>
                      {row.userAgent}
                    </td>
                  </tr>
                ))}
                {ipSummaries.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                      No IP data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card  ">
          <div className="border-b border-border px-5 py-4 ">
            <h2 className="text-base font-semibold text-foreground">
              Failed fetches &amp; errors
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  {['Time', 'IP', 'Action', 'Status', 'Symbol', 'Range', 'Error', 'User agent'].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failed.map((event) => (
                  <tr key={event.id} className="border-b border-border">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums">
                      {formatTime(event.timestamp)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{event.ip}</td>
                    <td className="whitespace-nowrap px-3 py-2">{actionLabel(event.action)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{event.status}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{event.symbol ?? '-'}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {event.startTime && event.endTime
                        ? `${event.startTime} → ${event.endTime}`
                        : '-'}
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-xs" title={event.errorMessage}>
                      {event.errorMessage ?? '-'}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-xs" title={event.userAgent}>
                      {event.userAgent}
                    </td>
                  </tr>
                ))}
                {failed.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No failures recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
