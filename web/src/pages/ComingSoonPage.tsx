import { ReleaseFeed } from "../components/ReleaseFeed";

export function ComingSoonPage() {
  return (
    <>
      <header className="masthead">
        <h1>Coming Soon</h1>
        <p>
          Seasons and films arriving on different services in the next 90 days.
          Time your subscriptions around them.
        </p>

      </header>
      <ReleaseFeed />
    </>
  );
}
