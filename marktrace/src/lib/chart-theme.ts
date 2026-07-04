/** Read Midnight Indigo CSS variables for lightweight-charts theming. */
export function getChartTheme() {
  if (typeof document === 'undefined') {
    return defaultChartTheme();
  }

  const root = document.documentElement;
  const style = getComputedStyle(root);

  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;

  return {
    background: read('--card', 'oklch(0.19 0.045 275)'),
    text: read('--foreground', 'oklch(0.96 0.01 265)'),
    grid: read('--border', 'oklch(1 0 0 / 8%)'),
    border: read('--border-strong', 'oklch(1 0 0 / 14%)'),
    crosshair: read('--muted-foreground', 'oklch(0.7 0.03 265)'),
    up: read('--success', 'oklch(0.72 0.19 155)'),
    down: read('--destructive', 'oklch(0.62 0.24 25)'),
    primary: read('--color-primary', 'oklch(0.62 0.22 275)'),
    warning: read('--warning', 'oklch(0.78 0.16 75)'),
    destructive: read('--destructive', 'oklch(0.62 0.24 25)'),
  };
}

function defaultChartTheme() {
  return {
    background: 'oklch(0.19 0.045 275)',
    text: 'oklch(0.96 0.01 265)',
    grid: 'oklch(1 0 0 / 8%)',
    border: 'oklch(1 0 0 / 14%)',
    crosshair: 'oklch(0.7 0.03 265)',
    up: 'oklch(0.72 0.19 155)',
    down: 'oklch(0.62 0.24 25)',
    primary: 'oklch(0.62 0.22 275)',
    warning: 'oklch(0.78 0.16 75)',
    destructive: 'oklch(0.62 0.24 25)',
  };
}

export function buildChartOptions(theme = getChartTheme()) {
  return {
    layout: {
      background: { color: theme.background },
      textColor: theme.text,
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    crosshair: {
      vertLine: { color: theme.crosshair, labelBackgroundColor: theme.primary },
      horzLine: { color: theme.crosshair, labelBackgroundColor: theme.primary },
    },
    rightPriceScale: {
      borderColor: theme.border,
    },
    timeScale: {
      borderColor: theme.border,
      timeVisible: true,
      secondsVisible: false,
    },
  };
}

export function buildCandlestickSeriesOptions(theme = getChartTheme()) {
  return {
    upColor: theme.up,
    downColor: theme.down,
    borderUpColor: theme.up,
    borderDownColor: theme.down,
    wickUpColor: theme.up,
    wickDownColor: theme.down,
  };
}
