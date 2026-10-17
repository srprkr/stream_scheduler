import { Link } from "react-router";

/**
 * How the app works, in Sean's words: a placeholder until he writes it.
 *
 * Topics he's asked it to cover (from his notes, 2026-10-08 on):
 * - "Free" services that show ads - Tubi, Pluto, Plex - and the trade-off:
 *   no money, paid for in time. Say plainly the app doesn't cover them yet,
 *   and that it's a future feature.
 * - The plan and its costs: one service a month, keeping everything vs the
 *   rotation, what the saving is measured against.
 */
export function HowItWorksPage() {
  return (
    <>
      <header className="masthead">
        <h1>How it works</h1>
      </header>
      {/* Each part of the page in its own box: two to a row on a desktop,
          one above the other on a phone. */}
      <div className="how-it-works">
        <section className="panel purposes__box" aria-labelledby="site-tour">
          <h2 id="site-tour" className="panel__title">
            What does each part do?
          </h2>
          <ol>
            <li>
              Own/Library - Shows the physical copies the user owns. They can look up titles in the search box and mark it as owned
            </li>
            <li>
              Want - From any search result or content tile you can mark an item as wanted. This will then be added to the insights page to get the ball rolling on getting you savings to purchase this (and other) media below a savings ceiling in order to replace a streaming "rental" with watchtime that you'll now own forever. 
            </li>
            <li>
              Watchlist - Helps you plan "binge months" for streaming exclusive content or stuff that you don't necessarily want to own but would watch when the service it happens to be on resumes for that month.
            </li>
          </ol>
        </section>

        <section className="panel purposes__box" aria-labelledby="how-purposes">
          <h2 id="how-purposes" className="panel__title">
            This web app has three purposes.
          </h2>
          <ol>
            <li>
              Empower users to outright <Link to="/">own the content</Link> they consume. This means
              DVD purchases, because digital copy licenses run out and can get revoked.
            </li>
            <li>
              Serve as a one-stop shop that allows users to{" "}
              <Link to="/whats-on">intentionally search and choose</Link> which content they{" "}
              <Link to="/coming-soon">want to watch</Link> (instead of relying on algorithms to make
              them watch mediocre content).
            </li>
            <li>
              Help users <Link to="/insights">curate plans to pause streaming services</Link> they
              won't be using for the month and use the savings to fill the missing watch time with
              physical content they actually own (whose future ownership cannot be revoked). Insights shows a ceiling on what to spend on discs and still come out ahead.
            </li>
          </ol>
        </section>

        {/* Title is a placeholder for Sean to rename. */}
        <section className="panel how-it-works__box" aria-labelledby="how-why">
          <h2 id="how-why" className="panel__title">
            Why
          </h2>
          <p>
            Streaming used to be a refuge from high cable bills and content saturated with ads. As
            streaming services got more of a stranglehold on the market share (and intellectual
            property), this sector became plagued with the same issues the medium they replaced
            (cable/satellite tv) had.
          </p>
          <p>
            Rent seeking throught subscriptions diminishes the quality of product. If more users have the tools to make a plan and vote with their dollars, companies will be required to improve their product.
          </p>
          <p>
            Sources: The Movie DataBase supplies titles, runtimes, scores, and genres. JustWatch gives streaming sources. Currently only the US is covered on the 8 major streaming services (more to come).
          </p>
        </section>

        <section className="panel how-it-works__box" aria-labelledby="how-rules">
          <h2 id="how-rules" className="panel__title">
            Ground rules (the app handles most of these for you)
          </h2>
          <ul>
            <li>No tracking, no affiliate links, if ads are used any user data won't be served to the sponsoring company.</li>
            <li>Cancellation terms for each streaming service change. Such changes are periodically checked but users are advised to look that over before hitting "pause" themselves.</li>
            <li>Only subscribe to one service per month</li>
            <li>
              Cancel the day you subscribe. This prevents monthly autorenewal and you keep access
              until that month ends
            </li>
            <li>
              Plan waits for the entire season to be available for streaming before paying for it.
            </li>
            <li>The monthly watch time you set sizes everything</li>
            <li><Link to="/watchlist">Renewals give a calendar file</Link> of reminders for the user to manually "pause" subscriptions.</li>
            <li>
              Logins are optional... really. You can export or import your library and watchlist from <Link to="/settings">the settings page</Link>. You have the option of privacy. If the data never leaves your
              browser it can't be read by outside sources.
            </li>
          </ul>
        </section>

        <section className="panel how-it-works__box" aria-labelledby="how-soon">
          <h2 id="how-soon" className="panel__title">
            Coming soon
          </h2>
          <ul>
            <li>
              Optional login for cross device saves. Currently you can hand copy exported settings
              to the various devices and browsers you want to use. The private option will remain
              available.
            </li>
            <li>
              Search content offered by the free streaming services (which require ads) like Tubi,
              Plex, and Pluto TV
            </li>
            <li>Feature voting for the community to decide what features get built.</li>
            <li>
              "Done" status - often an app gets too complicated to be especially useful. While this
              app will have minor support, I want to hit a stopping point on new features and use
              donations to pursue other product lines that promote the same goals of tech user
              privacy and autonomy. If you like this app, you'll love the other apps I have in the
              works.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
