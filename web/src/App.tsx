import { Link, Navigate, NavLink, Route, Routes, useMatch } from "react-router";

import { Footer } from "./components/Footer";
import { Nav } from "./Nav";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { HomePage } from "./pages/HomePage";
import { InsightsPage } from "./pages/InsightsPage";
import { SettingsPage } from "./pages/SettingsPage";
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
          {/* Settings sits apart, top right, as a gear. */}
          <NavLink to="/settings" className="nav__settings" aria-label="Settings" title="Settings">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </NavLink>
        </nav>
      </header>

      {/* Grows to fill the window, so on a short page the footer still sits
          at the bottom. Also the main landmark screen readers jump to. */}
      <main className="page__main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route element={<Nav />}>
            <Route path="/whats-on" element={<WhatsOnPage />} />
            <Route path="/coming-soon" element={<ComingSoonPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}
