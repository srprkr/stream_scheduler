import { NavLink, Route, Routes } from "react-router";

import { ComingSoonPage } from "./ComingSoonPage";
import { Footer } from "./Footer";
import { HomePage } from "./HomePage";

export function App() {
  return (
    <div className="page">
      <nav className="nav" aria-label="Main">
        <NavLink to="/" end className="nav__link">
          Home
        </NavLink>
        <NavLink to="/coming-soon" className="nav__link">
          Coming Soon
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/coming-soon" element={<ComingSoonPage />} />
      </Routes>
      <Footer />
    </div>
  );
}
