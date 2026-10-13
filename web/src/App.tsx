import { Navigate, Route, Routes } from "react-router";

import { Footer } from "./components/Footer";
import { TopBar } from "./components/TopBar";
import { Nav } from "./Nav";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { HomePage } from "./pages/HomePage";
import { InsightsPage } from "./pages/InsightsPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { WhatsOnPage } from "./pages/WhatsOnPage";

export function App() {
  return (
    <div className="page">
      <TopBar />

      {/* Grows to fill the window, so on a short page the footer still sits
          at the bottom. Also the main landmark screen readers jump to. */}
      <main className="page__main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />

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
