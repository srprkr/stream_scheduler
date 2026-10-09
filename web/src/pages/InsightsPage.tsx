import { CostChart } from "../components/CostChart";
import { DiscPlan } from "../components/DiscPlan";
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
          The services you pay for and what they cost. Browse's My Services filter, the renewal
          advice and the cost estimates all start here.
        </p>
      </header>
      {/* The figures; the services and prices it's all worked out from; the
          steps to take first; then the chart that shows the plan's saving
          over time, and the discs that carry the user through its pause
          months. */}
      <InsightsSummary>
        <MyServices collapsible={false} />
      </InsightsSummary>
      <CostChart />
      <DiscPlan />
    </>
  );
}
