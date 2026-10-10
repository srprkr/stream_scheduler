import { useEffect, useRef, useState } from "react";

import { useRotationPlan } from "../hooks/useRotationPlan";
import {
  cumulativeCosts,
  monthlyCosts,
  niceTicks,
  stepPath,
  type CostPoint,
} from "../lib/costChart";
import { formatDollars } from "../lib/money";
import { listTitles } from "../lib/replaces";
import { formatDate } from "../lib/format";
import { when } from "../lib/seasons";
import { MaxWait } from "./MaxWait";

const HEIGHT = 260;

type CostView = "total" | "month";

const VIEWS: { id: CostView; label: string }[] = [
  { id: "total", label: "Running total" },
  { id: "month", label: "Per month" },
];
// Room for the y-axis labels on the left and the end-of-line labels on the right.
const MARGIN = { top: 16, right: 132, bottom: 40, left: 56 };

/** Whole dollars on the axis: "$40", never "$40.00". */
const axisDollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;

/**
 * What keeping every current subscription costs against following the
 * rotation plan, as two running totals over the plan's months. The red,
 * dotted line is the do-nothing cost; the solid blue one is the plan; the
 * gap between them is the saving, which leads above the chart.
 *
 * Colours are validated against the page's surface (dataviz skill's
 * validator: red #ef4444 / blue #3b82f6, colour-blind separation dE 27);
 * the dotted stroke and the end labels mean colour is never the only cue.
 * A crosshair reads both totals at any month, and a table shows every
 * number without hovering.
 */
export function CostChart() {
  const rotation = useRotationPlan();
  const { plan, priceOf, payingNow, alwaysOn, alwaysOnSlugs, nameOf, today, billing } = rotation;
  const { points, unpriced } = cumulativeCosts(
    plan,
    priceOf,
    billing.monthly,
    billing.alwaysOn,
    billing.yearly,
  );

  const [showTable, setShowTable] = useState(false);
  // Running totals show the saving build up; per month shows each month's
  // bill - the paused months as valleys, a yearly renewal as a spike.
  const [view, setView] = useState<CostView>("total");
  const shownPoints = view === "total" ? points : monthlyCosts(points);
  const last = points.at(-1);
  const saved = last ? last.keep - last.plan : 0;
  const months = last?.index ?? 0;

  return (
    <section className="panel cost-chart" aria-labelledby="cost-chart-title">
      <h2 id="cost-chart-title" className="panel__title">
        Keeping everything vs your plan
      </h2>

      {!last ? (
        <p className="panel__lede">
          Add titles to your watchlist and the plan appears here: one service a month, against
          keeping everything you pay for now.
        </p>
      ) : (
        <>
          {/* The headline: the one number the chart is about. */}
          <p className="cost-chart__headline">
            {saved >= 0 ? (
              <>
                <strong>{formatDollars(saved)}</strong> saved over the next {months}{" "}
                {months === 1 ? "month" : "months"}
              </>
            ) : (
              <>
                <strong>{formatDollars(-saved)}</strong> more than you pay now, over {months}{" "}
                {months === 1 ? "month" : "months"}
              </>
            )}
          </p>
          <p className="panel__lede">
            {view === "total" ? "Running totals from today." : "What each month costs."}
            {payingNow + alwaysOn === 0 &&
              " You haven't said which services you pay for, so keeping everything costs nothing here."}
            {alwaysOn > 0 &&
              ` Both lines include ${formatDollars(alwaysOn)} a month for ${listTitles(
                alwaysOnSlugs.map(nameOf),
              )}, which you keep either way.`}
            {unpriced > 0 &&
              ` ${unpriced} plan ${unpriced === 1 ? "month has" : "months have"} no price yet and ${
                unpriced === 1 ? "isn't" : "aren't"
              } counted.`}
          </p>

          <div className="cost-chart__views" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`tag${view === v.id ? " tag--on" : ""}`}
                data-label={v.label}
                aria-pressed={view === v.id}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>

          <ul className="cost-chart__legend">
            <li>
              <svg width="24" height="8" aria-hidden="true">
                <line className="cost-chart__keep" x1="2" y1="4" x2="22" y2="4" />
              </svg>
              Keep everything ({formatDollars(payingNow + alwaysOn)}/month)
            </li>
            <li>
              <svg width="24" height="8" aria-hidden="true">
                <line className="cost-chart__plan" x1="2" y1="4" x2="22" y2="4" />
              </svg>
              Your plan
            </li>
          </ul>

          <CostLines points={shownPoints} view={view} today={today} nameOf={nameOf} />

          <button
            type="button"
            className="cost-chart__toggle"
            aria-expanded={showTable}
            onClick={() => setShowTable(!showTable)}
          >
            {showTable ? "Hide table" : "Show as a table"}
          </button>
          {showTable && (
            <CostTable points={shownPoints} view={view} today={today} nameOf={nameOf} />
          )}
        </>
      )}

      <MaxWait rotation={rotation} />
    </section>
  );
}

/** The SVG itself, sized to its container's width. Exported for a render check. */
export function CostLines({
  points,
  view = "total",
  today,
  nameOf,
}: {
  /** Running totals (one more point than months), or one point a month. */
  points: CostPoint[];
  view?: CostView;
  today: string;
  nameOf: (key: string) => string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  // Redraw at the container's width, so text stays its real size on any screen.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = points.length - 1;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const top = Math.max(...points.map((p) => Math.max(p.keep, p.plan)));
  const ticks = niceTicks(top);
  const yMax = ticks.at(-1) || 1;
  const x = (i: number) => MARGIN.left + (n === 0 ? 0 : (i / n) * innerW);
  const y = (cents: number) => MARGIN.top + innerH - (cents / yMax) * innerH;
  // Running totals as steps - each month's charge lands at once (stepPath).
  // Per month, a line through each month's bill: its hills and valleys.
  const path = (key: "keep" | "plan") =>
    view === "total"
      ? stepPath(points, key, x, y)
      : points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.index)},${y(p[key])}`).join(" ");

  // End labels, nudged apart if the lines finish close together.
  const end = points[n] as CostPoint;
  let keepY = y(end.keep);
  let planY = y(end.plan);
  if (Math.abs(keepY - planY) < 16) {
    const mid = (keepY + planY) / 2;
    const up = end.keep >= end.plan;
    keepY = mid + (up ? -8 : 8);
    planY = mid + (up ? 8 : -8);
  }

  // Date labels along the bottom, spaced so they never touch: every month
  // if there's room, else every second or third, always ending on the last
  // - and dropping one that would crowd it.
  const LABEL_PX = 64;
  const perMonth = innerW / Math.max(n, 1);
  const every = Math.max(1, Math.ceil(LABEL_PX / perMonth));
  const labelled = points.filter(
    (p) => p.index === n || (p.index % every === 0 && (n - p.index) * perMonth >= LABEL_PX),
  );

  const pick = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const i = Math.round(((clientX - rect.left - MARGIN.left) / innerW) * n);
    setActive(Math.min(n, Math.max(0, i)));
  };

  const shown = active === null ? null : points[active];

  return (
    <div ref={box} className="cost-chart__plot">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={
          view === "total"
            ? `Running cost over ${n} months: keeping everything reaches ${formatDollars(end.keep)}, your plan ${formatDollars(end.plan)}.`
            : `Cost each month over ${points.length} months: keeping everything up to ${formatDollars(Math.max(...points.map((p) => p.keep)))}, your plan up to ${formatDollars(Math.max(...points.map((p) => p.plan)))}.`
        }
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        // Arrow keys walk the crosshair along the months.
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const step = e.key === "ArrowRight" ? 1 : -1;
          setActive((i) => Math.min(n, Math.max(0, (i ?? (step > 0 ? -1 : n + 1)) + step)));
        }}
      >
        {/* Recessive grid and y-axis labels. */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              className="cost-chart__grid"
              x1={MARGIN.left}
              x2={MARGIN.left + innerW}
              y1={y(t)}
              y2={y(t)}
            />
            <text
              className="cost-chart__axis"
              x={MARGIN.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
            >
              {axisDollars(t)}
            </text>
          </g>
        ))}
        {labelled.map((p, i) => {
          // The year once, under the first label of each new year - not
          // repeated on every date, which is what crowds a long axis.
          const year = p.date.slice(0, 4);
          const prev =
            i === 0 ? today.slice(0, 4) : (labelled[i - 1] as CostPoint).date.slice(0, 4);
          const anchor = p.index === 0 ? "start" : p.index === n ? "end" : "middle";
          return (
            <text
              key={p.index}
              className="cost-chart__axis"
              x={x(p.index)}
              y={HEIGHT - 16}
              textAnchor={anchor}
            >
              {formatDate(p.date)}
              {year !== prev && (
                <tspan x={x(p.index)} dy="1.2em">
                  {year}
                </tspan>
              )}
            </text>
          );
        })}
        <path className="cost-chart__keep" d={path("keep")} />
        <path className="cost-chart__plan" d={path("plan")} />
        {/* Per month, a dot on each month's bill, so a single month reads. */}
        {view === "month" &&
          points.map((p) => (
            <g key={p.index} aria-hidden="true">
              <circle
                className="cost-chart__mark cost-chart__dot--keep"
                cx={x(p.index)}
                cy={y(p.keep)}
                r="2.5"
              />
              <circle
                className="cost-chart__mark cost-chart__dot--plan"
                cx={x(p.index)}
                cy={y(p.plan)}
                r="2.5"
              />
            </g>
          ))}

        {/* Direct labels at the ends, so neither line relies on colour. */}
        <text className="cost-chart__end" x={x(n) + 8} y={keepY} dy="0.32em">
          Keep {formatDollars(end.keep)}
        </text>
        <text className="cost-chart__end" x={x(n) + 8} y={planY} dy="0.32em">
          Plan {formatDollars(end.plan)}
        </text>

        {shown && (
          <g aria-hidden="true">
            <line
              className="cost-chart__crosshair"
              x1={x(shown.index)}
              x2={x(shown.index)}
              y1={MARGIN.top}
              y2={MARGIN.top + innerH}
            />
            <circle
              className="cost-chart__dot cost-chart__dot--keep"
              cx={x(shown.index)}
              cy={y(shown.keep)}
              r="4"
            />
            <circle
              className="cost-chart__dot cost-chart__dot--plan"
              cx={x(shown.index)}
              cy={y(shown.plan)}
              r="4"
            />
          </g>
        )}
      </svg>

      {/* One tooltip, both lines: values first, labels after. */}
      {shown && (
        <div
          className="cost-chart__tooltip"
          role="status"
          style={{
            left: Math.min(x(shown.index) + 12, width - 200),
            top: MARGIN.top,
          }}
        >
          <p className="cost-chart__tip-date">{when(shown.date, today)}</p>
          <p>
            <svg width="16" height="6" aria-hidden="true">
              <line className="cost-chart__keep" x1="1" y1="3" x2="15" y2="3" />
            </svg>
            <strong>{formatDollars(shown.keep)}</strong> keeping everything
            {view === "month" && " this month"}
          </p>
          <p>
            <svg width="16" height="6" aria-hidden="true">
              <line className="cost-chart__plan" x1="1" y1="3" x2="15" y2="3" />
            </svg>
            <strong>{formatDollars(shown.plan)}</strong> on the plan
            {view === "month" && " this month"}
          </p>
          {(view === "month" || shown.index < n) && (
            <p className="cost-chart__tip-note">
              {shown.service ? `This month: ${nameOf(shown.service)}` : "This month: nothing"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Every number in the chart, readable without hovering. */
function CostTable({
  points,
  view,
  today,
  nameOf,
}: {
  points: CostPoint[];
  view: CostView;
  today: string;
  nameOf: (key: string) => string;
}) {
  // Each row is a month: its bill, or the running total once it's paid.
  const rows =
    view === "month"
      ? points
      : points.slice(0, -1).map((p, i) => {
          const after = points[i + 1] as CostPoint;
          return { ...p, keep: after.keep, plan: after.plan };
        });
  return (
    <table className="cost-chart__table">
      <thead>
        <tr>
          <th scope="col">From</th>
          <th scope="col">Plan pays for</th>
          <th scope="col">Keep everything</th>
          <th scope="col">Your plan</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.index}>
            <td>{when(p.date, today)}</td>
            <td>{p.service ? nameOf(p.service) : "Nothing"}</td>
            <td>{formatDollars(p.keep)}</td>
            <td>{formatDollars(p.plan)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
