import { Link, Navigate, NavLink, Route, Routes, useMatch } from "react-router";

import { Footer } from "./components/Footer";
import { Nav } from "./Nav";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { HomePage } from "./pages/HomePage";
import { WhatsOnPage } from "./pages/WhatsOnPage";

export function App() {
  // "Browse" is a section, not a page: it is current on either of its tabs.
  const onWhatsOn = useMatch("/whats-on");
  const onComingSoon = useMatch("/coming-soon");
  const browsing = Boolean(onWhatsOn || onComingSoon);

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
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route element={<Nav />}>
          <Route path="/whats-on" element={<WhatsOnPage />} />
          <Route path="/coming-soon" element={<ComingSoonPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </div>
  );
}
