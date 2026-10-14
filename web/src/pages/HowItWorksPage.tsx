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
      <section>
        <h2>This web app has three purposes.</h2>
        <ol>
          <li>Empower users to outright <Link to="/">own the content</Link> they consume.</li>
          <li>Serve as a one-stop shop that allows users to <Link to="/whats-on">intentionally search and choose</Link> which content they <Link to="/coming-soon">want to watch</Link> (instead of relying on algorithms to make them watch mediocre content).</li>
          <li>Help users <Link to="/insights">curate plans to pause streaming services</Link> they won't be using for the month and use the savings to fill the missing watch time with physical content they actually own (whose future ownership cannot be revoked).</li>
        </ol>
        <p>
          Streaming used to be a refuge from high cable bills and content saturated with ads. As streaming services got more of a stranglehold on the market share (and intellectual property), this sector became plagued with the same issues the medium they replaced (cable/satellite tv) had.
        </p>
        <p>
          These tech companies feel entitled to our money and data. It's time to prove to them (and ourselves) that this is not the case.
        </p>

        <h2>Ground rules (the app handles these for you)</h2>
          <ul>
            <li>One service per month</li>
            <li>Cancel the day you subscribe. This prevents monthly autorenewal and you keep access until that month ends</li>
            <li>Plan waits for the entire season to be available for streaming before paying for it.</li>
            <li>The monthly watch time you set sizes everything</li>
            <li>Renewals give reminders in a calendar file</li>
          </ul>


        <h2>Coming soon</h2>
          <ul>
            <li>
              Search content offered by the free streaming services (which require ads) like Tubi, Plex, and Pluto TV
            </li>
            <li>
              Feature voting for the community to decide what features get built.
            </li>
            <li>
              "Done" status - often an app gets too complicated to be especially useful. While this app will have minor support, I want to hit a stopping point on new features and use donations to pursue other product lines that promote the same goals of tech user privacy and autonomy. If you like this app, you'll love the other apps I have in the works.
            </li>
        </ul>
        
      </section>
    </>
  );
}
