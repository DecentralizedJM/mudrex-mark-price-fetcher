export type ChartThemeColors = {
  background: string;
  text: string;
  grid: string;
  border: string;
  crosshair: string;
  up: string;
  down: string;
  primary: string;
  warning: string;
  destructive: string;
};

const DARK_THEME: ChartThemeColors = {
  background: '#2a2d3a',
  text: '#f5f5f7',
  grid: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.14)',
  crosshair: '#b8bcc8',
  up: '#5eead4',
  down: '#f87171',
  primary: '#9d8cff',
  warning: '#fbbf24',
  destructive: '#f87171',
};

const LIGHT_THEME: ChartThemeColors = {
  background: '#ffffff',
  text: '#1a1a2e',
  grid: 'rgba(0, 0, 0, 0.08)',
  border: 'rgba(0, 0, 0, 0.12)',
  crosshair: '#6b7280',
  up: '#059669',
  down: '#dc2626',
  primary: '#6366f1',
  warning: '#d97706',
  destructive: '#dc2626',
};

/** Chart colors as hex/rgba — lightweight-charts cannot parse oklch CSS variables. */
export function getChartTheme(): ChartThemeColors {
  if (typeof document === 'undefined') return DARK_THEME;
  return document.documentElement.classList.contains('dark') ? DARK_THEME : LIGHT_THEME;
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
