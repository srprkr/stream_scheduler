import { listTitles } from "../lib/replaces";
import { readyLine, seasonLine, when } from "../lib/seasons";
import { formatHours, formatMonths } from "../lib/stats";
import type { WatchlistSummary } from "../lib/watchlist";
import { Panel } from "./Panel";
import { ServiceLogo } from "./ServiceLogo";

/** How a row names its service. */
export interface ServiceInfo {
  name: string;
  logoUrl?: string | null;
}

/**
 * "Where to watch it": the watchlist by service, each with when everything
 * on it is out - the day a month of that service covers it all - and its
 * titles underneath, soonest first. Renders nothing until a title has a
 * service, current or coming.
 */
export function WatchServices({
  services,
  unhosted,
  missing,
  hoursPerMonth,
  today,
  serviceInfo,
  onOpen,
}: WatchlistSummary & {
  /** Titles left out of the hours for want of a runtime. */
  missing: number;
  hoursPerMonth: number;
  today: string;
  /** Name and logo by the rollup's key: a slug, or an untracked service's id. */
  serviceInfo: ReadonlyMap<string, ServiceInfo>;
  onOpen: (id: string) => void;
}) {
  if (services.length === 0) return null;

  return (
    <Panel id="watch-services" className="watch-services" title="Where to watch it">
      <p className="panel__lede">
        Each service with your watchlist titles on it or coming to it, and when they're all out -
        the day a month of that service covers everything. Greyed services are ones you don't pay
        for.
      </p>
      <ul className="watch-services__list">
        {services.map((s) => {
          const info = serviceInfo.get(s.key);
          const name = info?.name ?? s.key;
          const months = s.minutes / 60 / hoursPerMonth;
          return (
            <li key={s.key} className="watch-services__row">
              <ServiceLogo
                name={name}
                logoUrl={info?.logoUrl}
                active={s.subscribed}
                count={s.titles.length}
                size="row"
              />
              <div className="watch-services__head">
                <p className="watch-services__name">
                  {name}
                  {s.subscribed && <span className="watch-services__tag">Subscribed</span>}
                </p>
                {/* The badge shows the count; this says it aloud. */}
                <p className="watch-services__figures">
                  <span className="sr-only">
                    {s.titles.length} {s.titles.length === 1 ? "title" : "titles"}
                    {s.minutes > 0 ? ", " : ""}
                  </span>
                  {s.minutes > 0 && (
                    <>
                      {s.estimated ? "about " : ""}
                      {formatHours(s.minutes)} · {formatMonths(months)}
                    </>
                  )}
                </p>
              </div>
              <p className="watch-services__ready" data-state={s.ready.state}>
                {readyLine(s.ready, today)}
              </p>
              {/* Soonest first, so the list reads as a timeline. */}
              <ul className="watch-services__titles">
                {s.titles.map((t) => (
                  <li key={t.id}>
                    {/* Mouse shortcut to the dialog; keyboard users have the
                        poster below. */}
                    <span className="opens-dialog" onClick={() => onOpen(t.id)}>
                      {t.title}
                    </span>
                    <span className="watch-services__when">
                      {t.arrivesOn
                        ? `Arrives ${when(t.arrivesOn, today)}`
                        : t.ready.state === "now" || !t.nextSeason
                          ? "Out now"
                          : seasonLine(t.nextSeason, today)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {unhosted.length > 0 && (
        <p className="watch-services__unhosted">
          <strong>No service announced yet:</strong> {listTitles(unhosted)}.
        </p>
      )}
      {missing > 0 && (
        <p className="watch-services__note">
          {missing} {missing === 1 ? "title has" : "titles have"} no runtime data yet and{" "}
          {missing === 1 ? "isn't" : "aren't"} counted in the hours.
        </p>
      )}
    </Panel>
  );
}
