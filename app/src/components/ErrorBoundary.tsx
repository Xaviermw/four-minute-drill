import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureError } from "../analytics/sentry";

/**
 * Top-level safety net: without this, one render exception blanks the whole
 * app with no recovery. Catches render/lifecycle errors and offers a reload.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught error in Four Minute Drill:", error, info.componentStack);
    captureError(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          background: "var(--bg-0)",
          color: "var(--text)",
        }}
      >
        <div
          style={{
            maxWidth: "26rem",
            padding: "2rem",
            background: "var(--surface-1)",
            border: "1px solid var(--line-2)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <h1 style={{ fontFamily: "var(--font-display)", color: "var(--loss)", margin: "0 0 0.5rem" }}>
            Something broke
          </h1>
          <p style={{ color: "var(--muted)", margin: "0 0 1.5rem" }}>
            The drive hit a snag. Reload to keep playing.
          </p>
          <button type="button" className="cta-button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
