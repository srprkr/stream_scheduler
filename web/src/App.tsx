import { ReleaseFeed } from "./ReleaseFeed";

export function App() {
  return (
    <div className="page">
      <header className="masthead">
        <h1>What&rsquo;s coming to Netflix</h1>
        <p>
          Season drops in the next 90 days. Time your subscription around them.
        </p>
      </header>
      <ReleaseFeed />
    </div>
  );
}