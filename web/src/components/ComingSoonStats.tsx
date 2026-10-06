import { useRotationPlan } from "../hooks/useRotationPlan";
import { useStored } from "../hooks/useStored";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { useWatchlist } from "../hooks/useWatchlist";
import { comingSoonStats, monthName } from "../lib/comingSoon";
import { formatDollars } from "../lib/money";
import { listTitles } from "../lib/replaces";
import { localToday, readyLine, when } from "../lib/seasons";
import { formatHours } from "../lib/stats";
import { MaxWait } from "./MaxWait";
import { ServiceLogo } from "./ServiceLogo";

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
  const { titles, loading } = useWatchlist();
  const mine = useSubscriptions();
  const rotation = useRotationPlan();
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

  const { nameOf, logoOf } = rotation;
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
                logoUrl={logoOf(s.key)}
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
    const { plan, priceOf, payingNow } = rotation;
    return (
      <>
        <p className="coming-stats__lede">
          One service a month, each taking its turn when it has a month of your watchlist ready
          {payingNow > 0 && <>, against the {formatDollars(payingNow)} a month you pay now</>}.
        </p>
        <ul className="coming-stats__list">
          {plan.months.map((m) => {
            const cents = m.service ? priceOf(m.service) : 0;
            const saving = payingNow - (cents ?? 0);
            return (
              <li key={m.start} className="coming-stats__month">
                <span className="coming-stats__label">
                  {m.service ? nameOf(m.service) : "Pause everything"}
                  <span className="coming-stats__when">from {when(m.start, today)}</span>
                </span>
                <span className="coming-stats__figure">
                  {cents === null ? "?" : formatDollars(cents)}
                </span>
                {payingNow > 0 && (
                  <span
                    className={`coming-stats__diff${saving < 0 ? " coming-stats__diff--over" : ""}`}
                  >
                    {saving >= 0
                      ? `${formatDollars(saving)} less`
                      : `${formatDollars(-saving)} more`}
                  </span>
                )}
                {m.watched.length > 0 && (
                  <span className="coming-stats__titles">
                    {listTitles(
                      m.watched.map((w) => w.title),
                      3,
                    )}
                    {m.minutes > 0 && ` · ${formatHours(m.minutes)}`}
                    {m.reason === "waited" && " · waited long enough"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {rotation.anyTime.map(
          (a) =>
            a.titles.length > 0 && (
              <p key={a.key} className="coming-stats__note">
                Watch any time on {nameOf(a.key)}, which you always keep:{" "}
                {listTitles(a.titles.map((t) => t.title))}.
              </p>
            ),
        )}
        {plan.unplaced.length > 0 && (
          <p className="coming-stats__note">
            Waiting for a fuller month or a date: {listTitles(plan.unplaced.map((u) => u.title))}.
          </p>
        )}
        <MaxWait rotation={rotation} />
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
