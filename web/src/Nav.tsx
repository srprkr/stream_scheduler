import { NavLink, Outlet } from "react-router";

/**
 * The parent of What's On and Coming Soon: draws the tabs, and <Outlet/>
 * renders whichever child route matched below them. The links are relative
 * ("whats-on", not "/browse/whats-on"), so they resolve against this route
 * and would survive the section moving to a different path.
 */
export function Nav() {
  return (
    <>
      <nav className="tabs" aria-label="Browse">
        <NavLink to="whats-on" className="tabs__link">
          What's On
        </NavLink>
        <NavLink to="coming-soon" className="tabs__link">
          Coming Soon
        </NavLink>
      </nav>
      <Outlet />
    </>
  );
}
