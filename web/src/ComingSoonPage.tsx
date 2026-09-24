import { ReleaseFeed } from "./ReleaseFeed";

export function ComingSoonPage() {
  return (
    <>
      <header className="masthead">
        <h1>Coming Soon</h1>
        <p>
          Season drops in the next 90 days. Time your subscription around them to optimize savings.
        </p>
      </header>
      <ReleaseFeed />
    </>
  );
}
