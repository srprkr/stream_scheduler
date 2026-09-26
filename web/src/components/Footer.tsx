import tmdbLogo from "../assets/tmdb.svg";

/**
 * The attribution TMDB's terms require, the JustWatch credit for streaming
 * availability data, and where the user's library lives. The privacy line
 * must stay true: change it the day the library leaves the browser.
 */
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__credits">
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
          <img src={tmdbLogo} alt="TMDB" className="footer__logo" />
        </a>
        <p>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB. Streaming availability data provided by{" "}
          <a href="https://www.justwatch.com/" target="_blank" rel="noreferrer">
            JustWatch
          </a>
          .
        </p>
      </div>
      <p>Your library is saved in this browser only. It isn't shared with outside sources.</p>
    </footer>
  );
}
