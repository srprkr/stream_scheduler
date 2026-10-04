import { CostChart } from "../components/CostChart";
import { MyServices } from "../components/MyServices";

/**
 * The planning side of the app, apart from browsing: what the rotation plan
 * saves against keeping everything, and the services and prices behind it.
 * More stats views and paths forward come later.
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
      {/* The headline first: what the plan saves. Then the services and
          prices it's worked out from. */}
      <CostChart />
      <MyServices collapsible={false} />
    </>
  );
}
