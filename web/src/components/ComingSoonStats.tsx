import { useQuery } from "@apollo/client/react";

import { graphql } from "../generated";
import { useStored } from "../hooks/useStored";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { useWatchlist } from "../hooks/useWatchlist";
import { comingSoonStats, costByMonth, monthName } from "../lib/comingSoon";
import { formatDollars } from "../lib/money";
import { listTitles } from "../lib/replaces";
import { localToday, readyLine } from "../lib/seasons";
import { formatHours } from "../lib/stats";
import { monthlyCents, monthlySpend } from "../lib/subscriptions";
import { ServiceLogo } from "./ServiceLogo";

// The same plan fields as MyServices selects. Plans are cached inside their
// provider (see apollo.ts), so a narrower list here would overwrite that one
// and send each page back to the network for the fields it lost.
const SERVICE_PRICES = graphql(`
  query ServicePrices {
    providers {
      id
      slug
      plans {
        id
        leaveOutByDefault
        name
        monthlyCents
        hasAds
        isDefault
        note
      }
    }
  }
`);

const VIEWS = [
  { id: "hours", label: "Hours" },
  { id: "services", label: "By service" },
  { id: "cost", label: "Cost" },
] as const;
type View = (typeof VIEWS)[number]["id"];

/**
 * The Coming Soon page's numbers, from the user's watchlist only: how many
 * hours become watchable each month, which service each month needs, and
 * what paying for just those would cost against what they pay now. Every
 * title counts in the month it's all out - a weekly season at its finale.
 */
export function ComingSoonStats() {
  const today = localToday();
  const { titles, serviceInfo, loading } = useWatchlist();
  const mine = useSubscriptions();
  const providers = useQuery(SERVICE_PRICES).data?.providers ?? [];
  const [view, setView] = useStored<View>("stream-scheduler:coming-stats-view", "hours", (saved) =>
    VIEWS.some((v) => v.id === saved) ? (saved as View) : undefined,
  );

  if (loading) return <p className="panel coming-stats coming-stats--loading">Adding up…</p>;

  const subscribed = new Set(mine.map((s) => s.slug));
  const stats = comingSoonStats([...titles.values()], subscribed, today);
  const empty = stats.months.length === 0 && stats.undated.length === 0;

  if (empty) {
    return (
      <section className="panel coming-stats" aria-label="Your watchlist, coming soon">
        <p className="coming-stats__empty">
          Add titles to your watchlist with + Watchlist, and this box adds up when they arrive,
          month by month.
        </p>
      </section>
    );
  }

  const plansFor = (slug: string) => providers.find((p) => p.slug === slug)?.plans ?? [];
  // The user's own plan for a service they pay for; otherwise its default.
  const priceOf = (key: string) => {
    const sub = mine.find((s) => s.slug === key);
    if (sub) return monthlyCents(sub, plansFor(key));
    return plansFor(key).find((p) => p.isDefault)?.monthlyCents ?? null;
  };
  const nameOf = (key: string) => serviceInfo.get(key)?.name ?? key;
  const maxMinutes = Math.max(1, ...stats.months.map((m) => m.minutes));

  return (
    <section className="panel coming-stats" aria-label="Your watchlist, coming soon">
      <h2 className="coming-stats__title">Your watchlist, coming soon</h2>
      <div className="coming-stats__tabs" role="group" aria-label="View">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`tag${view === v.id ? " tag--on" : ""}`}
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "hours" && (
        <ul className="coming-stats__list">
          {stats.months.map((m) => (
            <li key={m.month} className="coming-stats__month">
              <span className="coming-stats__label">{monthName(m.month, today)}</span>
              <span className="coming-stats__figure">
                {m.minutes > 0 ? `${m.estimated ? "~" : ""}${formatHours(m.minutes)}` : "–"}
              </span>
              {/* Relative to the busiest month, so the months compare at a glance. */}
              <span className="coming-stats__bar" aria-hidden="true">
                <span style={{ width: `${(m.minutes / maxMinutes) * 100}%` }} />
              </span>
              <span className="coming-stats__titles">{listTitles(m.titles, 3)}</span>
            </li>
          ))}
        </ul>
      )}

      {view === "services" && (
        <ul className="coming-stats__list">
          {stats.services.map((s) => (
            <li key={s.key} className="coming-stats__service">
              <ServiceLogo
                name={nameOf(s.key)}
                logoUrl={serviceInfo.get(s.key)?.logoUrl}
                active={s.subscribed}
                count={s.titles.length}
                size="row"
              />
              <span className="coming-stats__label">
                {nameOf(s.key)}
                <span className="coming-stats__when">{readyLine(s.ready, today)}</span>
              </span>
              <span className="coming-stats__figure">
                {s.minutes > 0 ? `${s.estimated ? "~" : ""}${formatHours(s.minutes)}` : "–"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {view === "cost" && costView()}

      {notes()}
    </section>
  );

  // Render helpers rather than components: they read this render's values,
  // and a component defined inside another would remount on every render.
  function costView() {
    const { months, waiting } = costByMonth(stats.services, priceOf);
    const now = monthlySpend(mine, plansFor).cents;
    return (
      <>
        <p className="coming-stats__lede">
          One month of each service, in the month its titles are all out
          {now > 0 && <>, against the {formatDollars(now)} a month you pay now</>}.
        </p>
        <ul className="coming-stats__list">
          {months.map((m) => (
            <li key={m.month} className="coming-stats__month">
              <span className="coming-stats__label">{monthName(m.month, today)}</span>
              <span className="coming-stats__figure">
                {formatDollars(m.cents)}
                {m.unpriced > 0 && "+"}
              </span>
              {now > 0 && (
                <span
                  className={`coming-stats__diff${now - m.cents < 0 ? " coming-stats__diff--over" : ""}`}
                >
                  {now - m.cents >= 0
                    ? `${formatDollars(now - m.cents)} less`
                    : `${formatDollars(m.cents - now)} more`}
                </span>
              )}
              <span className="coming-stats__titles">
                {m.services
                  .map(
                    (s) =>
                      `${nameOf(s.key)} ${s.cents === null ? "(no price)" : formatDollars(s.cents)}`,
                  )
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
        {waiting.length > 0 && (
          <p className="coming-stats__note">
            Not counted yet, waiting on dates: {listTitles(waiting.map(nameOf))}.
          </p>
        )}
      </>
    );
  }

  function notes() {
    const untimed = stats.months.reduce((n, m) => n + m.untimed, 0);
    return (
      <>
        {stats.undated.length > 0 && (
          <p className="coming-stats__note">No date yet: {listTitles(stats.undated)}.</p>
        )}
        {view !== "cost" && untimed > 0 && (
          <p className="coming-stats__note">
            {untimed} {untimed === 1 ? "title has" : "titles have"} no runtime yet.
          </p>
        )}
        {view !== "cost" && (
          <p className="coming-stats__note">
            ~ marks an estimate: an unannounced finale, or a season timed from its last one.
          </p>
        )}
      </>
    );
  }
}
