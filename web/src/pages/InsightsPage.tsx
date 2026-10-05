import { CostChart } from "../components/CostChart";
import { InsightsSummary } from "../components/InsightsSummary";
import { MyServices } from "../components/MyServices";

/**
 * The planning side of the app, apart from browsing: the figures at a
 * glance, the paths forward, what the rotation plan saves against keeping
 * everything, and the services and prices behind it all.
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
      {/* The figures and the steps to take first, then the chart that shows
          the plan's saving over time, then the services and prices it's all
          worked out from. */}
      <InsightsSummary />
      <CostChart />
      <MyServices collapsible={false} />
    </>
  );
}
