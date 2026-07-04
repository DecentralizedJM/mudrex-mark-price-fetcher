import { useEffect, useId, useRef, useState } from 'react';
import { CircleHelp, X } from 'lucide-react';

export function AboutButton() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-input px-3 text-sm font-medium text-foreground transition-colors duration-theme hover:bg-muted"
      >
        <CircleHelp size={18} aria-hidden />
        About
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="surface-panel flex max-h-[min(90vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl shadow-panel"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4 ">
              <h2
                id={titleId}
                className="text-base font-semibold text-foreground"
              >
                About PriceFetcher
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close about"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-muted-foreground">
              <section className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  What this tool is for
                </h3>
                <p>
                  PriceFetcher is an internal support tool for Mudrex futures tickets. It helps you
                  look up historical prices and check whether a reported liquidation matches Mudrex
                  mark price data, without API keys, terminals, or converting times to epoch
                  yourself.
                </p>
                <p>
                  Use it when a user says they were liquidated incorrectly, saw a wrong price, or
                  needs confirmation of what Mark and LTP did around a specific time.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  Mark price vs LTP (important)
                </h3>
                <p>
                  <strong className="text-foreground">LTP</strong> (last
                  traded price) is the last trade on the market. It can spike or wick when one large
                  order hits or liquidity is thin for a few seconds.
                </p>
                <p>
                  <strong className="text-foreground">Mark price</strong> is
                  Mudrex&apos;s fair reference price for unrealized P&amp;L and liquidation checks.
                  It is designed to be steadier than LTP so users are not punished by brief wicks or
                  thin-book prints. On Mudrex, liquidation is triggered by Mark price, not LTP.
                </p>
                <p>
                  That means a user can see LTP never touch their level on a chart, and still be
                  liquidated if Mark price reached their liquidation price. When you explain a
                  liquidation, always cite Mark price and its timestamp, not LTP alone.
                </p>
                <p>
                  Official product explainers:{' '}
                  <a
                    href="https://mudrex.com/blog/understanding-mark-price-on-mudrex-futures/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Understanding Mark Price
                  </a>
                  {' · '}
                  <a
                    href="https://mudrex.com/blog/liquidation-price-on-mudrex-futures/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Liquidation Price on Mudrex Futures
                  </a>
                  .
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  How liquidation works on Mudrex
                </h3>
                <p>
                  Liquidation starts when Mark price falls to the liquidation price (longs) or rises
                  to the liquidation price (shorts). At that point the position no longer has enough
                  margin to meet maintenance margin, so the system closes it.
                </p>
                <p>
                  The close is executed at the <strong className="text-foreground">bankruptcy price</strong>{' '}
                  (the level where initial margin is fully used). Mark price is the fair yardstick,
                  liquidation price is the &quot;start liquidating&quot; line, and bankruptcy price
                  is the &quot;margin fully used&quot; line.
                </p>
                <p>
                  Liquidation price depends on entry, margin posted, maintenance margin, position
                  size, and any extra margin added later. Adding margin moves liquidation farther
                  from Mark (safer). Funding fees or charges that reduce position margin move
                  liquidation closer to Mark.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  Tool 1: Lookup
                </h3>
                <p>
                  Lookup loads LTP and Mark candles side by side for a symbol and time range (up to
                  24 hours). You pick the interval (for example 1 minute or 15 minutes) and timezone
                  (IST or UTC).
                </p>
                <p className="font-medium text-foreground">How to use it</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Enter the futures symbol (for example ESPORTS/USDT or BTCUSDT).</li>
                  <li>Set start and end date/time in 24-hour format.</li>
                  <li>Choose interval and timezone, then click Fetch prices.</li>
                  <li>
                    Review the summary, price movement analysis, and table. Download CSV if you need
                    it for the ticket.
                  </li>
                </ol>
                <p className="font-medium text-foreground">
                  Typical use cases
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    User claims a bad fill or wrong price at a given time. Check LTP and Mark around
                    that window.
                  </li>
                  <li>
                    User reports a sudden spike or drop. See whether Mark moved with LTP or only LTP
                    wicked (a common unfair-liquidation complaint).
                  </li>
                  <li>
                    You need a clear timeline for L2 or engineering. Export CSV with timestamps in
                    the user&apos;s timezone.
                  </li>
                  <li>
                    You want a short written summary of how price moved (highs, lows, Mark vs LTP
                    gap) for ticket notes.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  Tool 2: Liquidation Check
                </h3>
                <p>
                  Liquidation Check answers: given what the user reported, did Mudrex Mark price
                  actually reach their liquidation level around that time?
                </p>
                <p>
                  You enter side (Long/Short), symbol, leverage, entry price, liquidation price, and
                  the exact reported liquidation time (including seconds). The app validates inputs
                  against Mudrex asset rules and mark-price history, then shows a verdict and a
                  movement analysis you can use when talking to the user.
                </p>
                <p className="font-medium text-foreground">How to use it</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Open the Liquidation Check tab.</li>
                  <li>
                    Copy values from the user&apos;s position or ticket: symbol, side, leverage,
                    entry, liquidation price, and liquidation time.
                  </li>
                  <li>Pick the timezone that matches how the user reported the time (usually IST).</li>
                  <li>Run Liquidation Check and read the verdict plus analysis.</li>
                </ol>
                <p className="font-medium text-foreground">
                  What the verdict means
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong className="text-foreground">
                      Valid liquidation:
                    </strong>{' '}
                    Mudrex Mark price in the window reached the liquidation level in the direction
                    that would liquidate that side (Mark fell to liq for longs, or rose to liq for
                    shorts). Consistent with how Mudrex triggers liquidation.
                  </li>
                  <li>
                    <strong className="text-foreground">
                      No liquidation wick found:
                    </strong>{' '}
                    Mark did not reach the reported liquidation price in that window. Ask the user
                    to confirm price and timestamp, or escalate if they still show a liquidation.
                  </li>
                  <li>
                    <strong className="text-foreground">
                      Check rejected:
                    </strong>{' '}
                    Inputs do not match Mudrex (wrong leverage range, prices far from market,
                    impossible Long/Short levels, future time, and so on). Fix the inputs and run
                    again.
                  </li>
                </ul>
                <p className="font-medium text-foreground">
                  Typical use cases
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    &quot;I was liquidated but price never hit my liq level.&quot; Verify with Mark
                    data (LTP alone is not enough).
                  </li>
                  <li>
                    User sends a screenshot with entry, liq price, and time. Validate in one step
                    and use the suggested reply wording if it helps.
                  </li>
                  <li>
                    Training or QA: walk through a known incident and confirm Mark crossed the
                    level.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  Tips for support
                </h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Prefer the user&apos;s reported timezone when entering times.</li>
                  <li>
                    For liquidations, use the exact time from the app or ticket (seconds matter for
                    the check window).
                  </li>
                  <li>
                    Always explain Mark vs LTP when the user only looks at the last traded price
                    chart. A brief LTP wick does not by itself prove or disprove liquidation.
                  </li>
                  <li>
                    This tool uses Mudrex market data and asset specs. It does not look up a
                    specific user&apos;s account or position ID.
                  </li>
                  <li>
                    Lookup is limited to a 24-hour range. Narrow the window around the incident for
                    clearer candles.
                  </li>
                </ul>
              </section>
            </div>

            <div className="border-t border-border px-5 py-3 ">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 sm:w-auto"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
