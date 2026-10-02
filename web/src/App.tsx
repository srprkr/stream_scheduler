import { Link, Navigate, NavLink, Route, Routes, useMatch } from "react-router";

import { Footer } from "./components/Footer";
import { Nav } from "./Nav";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { HomePage } from "./pages/HomePage";
import { InsightsPage } from "./pages/InsightsPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { WhatsOnPage } from "./pages/WhatsOnPage";

export function App() {
  // "Browse" is a section, not a page: it is current on any of its tabs.
  const onWhatsOn = useMatch("/whats-on");
  const onComingSoon = useMatch("/coming-soon");
  const onWatchlist = useMatch("/watchlist");
  const browsing = Boolean(onWhatsOn || onComingSoon || onWatchlist);

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="brand">
          StreamHopper
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end className="nav__link">
            Home
          </NavLink>
          <Link
            to="/whats-on"
            className="nav__link"
            aria-current={onWhatsOn ? "page" : browsing ? "true" : undefined}
          >
            Browse
          </Link>
          <NavLink to="/insights" className="nav__link">
            Insights
          </NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/insights" element={<InsightsPage />} />

        <Route element={<Nav />}>
          <Route path="/whats-on" element={<WhatsOnPage />} />
          <Route path="/coming-soon" element={<ComingSoonPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </div>
  );
}
