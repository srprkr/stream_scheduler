import { MyServices } from "../components/MyServices";

/**
 * The planning side of the app, apart from browsing. For now it holds the
 * services the user pays for and on which plans; the stats views and paths
 * forward come later.
 */
export function InsightsPage() {
  return (
    <>
      <header className="masthead">
        <h1>Insights</h1>
        <p>
          The services you pay for and what they cost. Browse's All Subscribed filter, the renewal
          advice and the cost estimates all start here.
        </p>
      </header>
      {/* The page's one box for now, so there's nothing to fold it away for. */}
      <MyServices collapsible={false} />
    </>
  );
}
