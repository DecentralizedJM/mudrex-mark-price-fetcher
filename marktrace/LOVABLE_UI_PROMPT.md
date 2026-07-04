# Lovable UI Prompt: MarkTrace

Copy everything below the line into Lovable. Use mock data for preview; keep components prop-driven so they can be wired to an existing React/Vite backend.

---

## PROMPT START

Build **MarkTrace**: an internal support dashboard for Mudrex Futures historical **LTP** (Last Traded Price) and **Mark Price** lookup. Support staff are non-technical. The UI must be dead simple: enter symbol + time range → submit → see results → download CSV.

**Important:** Build **UI only**. Do NOT implement API calls, auth, or backend. Use realistic mock data. Every component must be **controlled via props** so an engineer can plug in existing logic later.

### Tech stack (must match)
- React 18 + TypeScript
- Tailwind CSS (`darkMode: 'class'`)
- lucide-react icons
- No auth, no router, single page
- Component files should mirror this structure:

```
src/
  components/
    Header.tsx
    LookupForm.tsx
    SummaryCards.tsx
    AnalysisPanel.tsx
    ResultsTable.tsx
    ThemeToggle.tsx
    ui/          # Button, Input, Select, Card
  types.ts       # shared interfaces (copy exactly)
  mockData.ts    # demo data for Lovable preview only
  App.tsx        # composes everything with local state + mock handlers
```

---

### Brand & copy
- **App name:** MarkTrace
- **Subtitle:** Mudrex LTP & Mark Price Lookup
- **Header variant:** "MarkTrace" with small muted "by Mudrex"
- **Browser title:** MarkTrace: Mudrex Price Lookup
- **Primary CTA:** Fetch prices
- **Footer:** Internal tool · Public market data · No auth

---

### Design system: premium minimal (NOT faded/washed out)

Vibe: Bloomberg-terminal clarity meets modern SaaS. High contrast, confident typography, generous whitespace.

**Avoid:** low-opacity grays, washed-out pastels, generic purple gradients, cluttered borders, oversized hero text.

#### Light mode
| Token | Value |
|-------|-------|
| Page background | `#FAFAFA` |
| Card background | `#FFFFFF` |
| Text primary | `#0A0A0A` |
| Text secondary | `#525252` |
| Border | `#E5E5E5` |
| Accent (buttons, links, focus) | `#0066FF` |
| Success | `#059669` |
| Warning | `#D97706` |

#### Dark mode
| Token | Value |
|-------|-------|
| Page background | `#0A0A0A` |
| Card background | `#141414` |
| Text primary | `#FAFAFA` |
| Text secondary | `#A3A3A3` |
| Border | `#262626` |
| Accent | `#3B82F6` |

#### Typography & layout
- Font: **Inter** (Google Fonts)
- Headings: `font-semibold`, tight tracking
- Table numbers: `font-mono` or `tabular-nums`
- Max width: `max-w-6xl` centered
- Cards: `rounded-xl`, `shadow-sm` in light, border-only in dark
- Primary button: solid accent, `rounded-lg`, hover brighten: no ghost primary
- Theme toggle: sun/moon in header, persist `marktrace-theme` in localStorage
- Smooth theme transition: 150ms

#### Micro-interactions
- Button hover/active states
- Table row hover (`hover:bg-neutral-50` / `hover:bg-neutral-900`)
- Sticky first column (Time) on horizontal scroll

---

### Page layout

```
┌─────────────────────────────────────────────────────┐
│  MarkTrace  by Mudrex          [subtitle]    [🌙/☀️] │
├─────────────────────────────────────────────────────┤
│  ┌─ Lookup ─────────────────────────────────────┐   │
│  │ Symbol  [ ESPORTS/USDT          ▼]           │   │
│  │ Date    [ 2026-06-18 ]  TZ [ IST ▼ ]        │   │
│  │ From    [ 15:59 ]   To  [ 16:01 ]            │   │
│  │ Interval [ 1m ▼ ]   Buffer [ 5 ] min        │   │
│  │ Reference time (T) [ optional ]              │   │
│  │                    [ Fetch prices ]          │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ Results ──────────────── [ Download CSV ] ──┐   │
│  │ [4 summary stat cards]                         │   │
│  │ [Price movement analysis panel]                │   │
│  │ [data table]                                   │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  Internal tool · Public market data · No auth       │
└─────────────────────────────────────────────────────┘
```

Mobile: single column, table horizontally scrollable.

---

### TypeScript interfaces (use exactly: engineer will wire these)

```ts
export type Aggregation = '1m' | '3t' | '5t' | '15t' | '30t' | '1h';
export type TimezoneId = 'Asia/Kolkata' | 'UTC';

export interface LookupParams {
  symbol: string;
  date: string;           // YYYY-MM-DD
  startTime: string;      // HH:mm
  endTime: string;        // HH:mm
  timezone: TimezoneId;
  aggregation: Aggregation;
  bufferMinutes: number;
  referenceTime?: string; // HH:mm, optional: shows T/T+1/T-1 labels
}

export interface MergedRow {
  openTime: number;       // epoch seconds UTC
  ltp?: { open: number; high: number; low: number; close: number; volume: number };
  mark?: { open: number; high: number; low: number; close: number };
  isBuffer: boolean;
  label?: string;         // "T", "T+1", "T-1" etc.
}

export interface FetchSummary {
  rowCount: number;
  ltpMinLow: number | null;
  ltpMaxHigh: number | null;
  markMinLow: number | null;
  markMaxHigh: number | null;
  maxMarkLtpGap: number | null;
  maxMarkLtpGapPct: number | null;
  maxMarkLtpGapTime: number | null;
}

export interface PriceAnalysis {
  headline: string;
  paragraphs: string[];
  bullets: string[];
  severity: 'neutral' | 'warning' | 'critical';
}
```

---

### Component contracts (props-driven, no fetch inside components)

#### `Header`
- Theme toggle on the right
- Title + subtitle + muted "by Mudrex"

#### `LookupForm`
```ts
interface LookupFormProps {
  params: LookupParams;
  onChange: (params: LookupParams) => void;
  onSubmit: () => void;
  loading: boolean;
  rangeWarning?: string | null;  // amber inline banner
}
```
Fields:
| Field | Type | Notes |
|-------|------|-------|
| Symbol | text + autocomplete dropdown | e.g. ESPORTS/USDT |
| Date | date picker | default today |
| Timezone | select | IST (Asia/Kolkata), UTC |
| Start / End time | time pickers | local time |
| Interval | select | 1m, 3m, 5m, 15m, 30m, 1h |
| Buffer | number stepper | minutes, 0 default |
| Reference time (T) | optional time | for T labels |

Submit disabled while `loading`.

#### `SummaryCards`
```ts
interface SummaryCardsProps {
  summary: FetchSummary;
  timezone: TimezoneId;
}
```
Four compact stat cards:
1. Row count
2. LTP range (min low → max high)
3. Mark range (min low → max high)
4. Max Mark−LTP close gap (value + time)

#### `AnalysisPanel`
```ts
interface AnalysisPanelProps {
  analysis: PriceAnalysis;
}
```
Rule-based support copy for liquidation disputes. Severity styling:
- `neutral`: info icon, subtle border
- `warning`: amber, AlertTriangle
- `critical`: red, AlertTriangle

Show headline, paragraphs, bullet list. This is the "explain with data" section for support tickets.

#### `ResultsTable`
```ts
interface ResultsTableProps {
  rows: MergedRow[];
  timezone: TimezoneId;
  showLabel: boolean;
  loading?: boolean;
}
```

Columns: Time | Label (if ref time set) | LTP Open/High/Low/Close/Volume | Mark Open/High/Low/Close | Mark−LTP Close

Rules:
- Sort ascending by time
- Missing LTP or Mark → show em dash `-`, keep row
- Buffer rows: subtle amber tint + small "buffer" badge
- Mark−LTP gap: highlight amber if |gap| > 1% of LTP close
- Loading: skeleton rows (6 rows)
- Empty: friendly message + example "ESPORTS/USDT · 18 Jun 2026 · 15:59–16:01 IST"

#### `App.tsx` states to demonstrate with mock data
1. **Empty**: form only, empty table placeholder
2. **Loading**: skeleton table, disabled submit
3. **Error**: red/amber alert banner with Retry button
4. **Success**: summary + analysis + full table + Download CSV visible

Error banner + Retry button sits between Lookup and Results cards.

Download CSV button: top-right of Results card header, icon + label. Only visible when results exist.

---

### Mock data for preview (use in `mockData.ts`)

**Scenario:** ESPORTS/USDT, 2026-06-18, 15:54–16:04 IST, 1m interval, buffer 0

Include ~11 rows with realistic prices around 0.12–0.17. One row should have Mark close ~0.165 (spike at 16:01). Show Mark−LTP gap >1% on at least one row.

Example analysis (warning severity):
- Headline: "ESPORTS/USDT: LTP moved up 8.42%; Mark moved up 12.15% over the selected window."
- Mention max Mark−LTP gap and that liquidations use Mark price, not LTP
- Bullets: lowest/highest LTP and Mark with timestamps

Symbol autocomplete suggestions: BTC/USDT, ETH/USDT, ESPORTS/USDT, EVAA/USDT, SOL/USDT

---

### UI polish checklist
- [ ] Premium contrast: nothing looks washed out
- [ ] Dark mode fully styled (not inverted light mode)
- [ ] Table sticky Time column on mobile scroll
- [ ] All numeric columns right-aligned or tabular-nums
- [ ] Form validation hints (end after start) as inline text, not alert()
- [ ] Range warning banner (amber) when range is large
- [ ] Accessible labels on all inputs
- [ ] Focus rings on accent color

### Out of scope (do NOT build)
- API integration / fetch calls
- WebSocket streaming
- Multi-symbol batch
- User accounts / login
- Charts (table only for v1)
- Vercel-specific config

### Integration note for engineer
Components must accept data via props only. `App.tsx` in Lovable should use `mockData.ts` + `setTimeout` to simulate loading. The production app will replace mock handlers with `fetchPriceData(params)` from `lib/api.ts` and `analyzePriceMovement()` from `lib/analysis.ts`: **do not delete or inline business logic into UI components**.

## PROMPT END

---

## Follow-up prompts for Lovable (iterate after v1)

Use these one at a time to scale polish without breaking prop contracts:

1. **"Refine the Results table: add column group headers (LTP | Mark | Gap), zebra striping in dark mode, and a compact density toggle."**

2. **"Improve the Analysis panel: add a copy-to-clipboard button for the full analysis text (for pasting into support tickets)."**

3. **"Add a collapsible 'Advanced' section in LookupForm for Reference time (T) and Buffer: keep defaults simple for first-time users."**

4. **"Design an empty-state illustration (minimal SVG chart icon) and a loading state with pulsing skeleton that matches the 4 summary cards + table layout."**

5. **"Mobile pass: stack summary cards 2x2, make Download CSV a full-width button below the Results title on small screens."**
