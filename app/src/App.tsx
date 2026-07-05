import { HowItWorks } from "./components/about/HowItWorks";
import { DraftScreen } from "./components/draft/DraftScreen";
import { DriveScreen } from "./components/drive/DriveScreen";
import { ResultScreen } from "./components/result/ResultScreen";
import { DataProvider } from "./data/dataContext";
import { LeaderboardUIProvider, useLeaderboardUI } from "./leaderboard/LeaderboardUI";
import { isLeaderboardEnabled } from "./leaderboard/supabaseClient";
import { GhostProvider, useGhost } from "./share/GhostProvider";
import { useSharedLineupDeepLink } from "./share/useSharedLineupDeepLink";
import { GameStateProvider, useGameState } from "./state/GameStateProvider";
import { ModeProvider, useMode } from "./state/ModeProvider";
import "./App.css";
import "./daily/daily.css";

function Screens() {
  const state = useGameState();
  switch (state.phase) {
    case "draft":
      return <DraftScreen />;
    case "driving":
      return <DriveScreen />;
    case "result":
      return <ResultScreen />;
  }
}

function ModeToggle() {
  const { mode, setMode } = useMode();
  return (
    <div className="mode-toggle" role="tablist" aria-label="Game mode">
      <button type="button" className={mode === "daily" ? "active" : ""} onClick={() => setMode("daily")}>
        Daily
      </button>
      <button type="button" className={mode === "free" ? "active" : ""} onClick={() => setMode("free")}>
        Free
      </button>
    </div>
  );
}

function AppBody() {
  const sharedLineup = useSharedLineupDeepLink();
  const { ghost } = useGhost();
  const { open: openLeaderboard } = useLeaderboardUI();
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            🏈
          </span>
          <span className="brand-name">
            Four Minute <span className="brand-accent">Drill</span>
          </span>
        </div>
        <div className="app-header-right">
          <ModeToggle />
          {isLeaderboardEnabled && (
            <button type="button" className="header-leaderboard-button" onClick={openLeaderboard}>
              🏆 <span className="header-lb-text">Leaderboard</span>
            </button>
          )}
          <span className="brand-tagline">Draft. Drive. Win.</span>
        </div>
      </header>
      {sharedLineup && (
        <div className="shared-banner" role="status">
          {ghost
            ? `👻 Racing ${ghost.name ?? "a ghost"}'s drive — ${ghost.score} pts to beat.`
            : "🔗 You’re running a shared lineup — beat their score!"}
        </div>
      )}
      <main className="app-main">
        <Screens />
      </main>
      <footer className="app-footer">
        <HowItWorks />
        <span className="app-footer-sep">·</span>
        <a className="how-it-works-link" href="/privacy.html">
          Privacy
        </a>
        <span className="app-footer-sep">·</span>
        <span>Data via nflverse / nflfastR</span>
      </footer>
    </div>
  );
}

function App() {
  return (
    <DataProvider>
      <GameStateProvider>
        <ModeProvider>
          <GhostProvider>
            <LeaderboardUIProvider>
              <AppBody />
            </LeaderboardUIProvider>
          </GhostProvider>
        </ModeProvider>
      </GameStateProvider>
    </DataProvider>
  );
}

export default App;
