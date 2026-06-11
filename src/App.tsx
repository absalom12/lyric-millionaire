import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Component, type ReactNode } from "react";
import { LanguageProvider } from "./i18n/LanguageContext";
import AuthGuard from "./components/AuthGuard";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: "red", background: "#111", minHeight: "100vh" }}>
          <h2>Erreur de rendu</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{(this.state.error as Error).message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#aaa" }}>{(this.state.error as Error).stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Player pages
import Home from "./pages/Home";
import Game from "./pages/Game";
import Result from "./pages/Result";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminImport from "./pages/admin/AdminImport";
import AdminSnippets from "./pages/admin/AdminSnippets";
import AdminDaily from "./pages/admin/AdminDaily";
import AdminSnippetGen from "./pages/admin/AdminSnippetGen";
import AdminSongs from "./pages/admin/AdminSongs";

export default function App() {
  return (
    <ErrorBoundary>
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Player routes ── */}
          <Route path="/" element={<Home />} />

          {/* /play and /play/* both redirect to home — mode selection lives there */}
          <Route path="/play" element={<Navigate to="/" replace />} />
          <Route path="/play/global-hits" element={<Navigate to="/" replace />} />
          <Route path="/play/artist-of-the-day" element={<Navigate to="/" replace />} />

          {/* Active game */}
          <Route path="/game/:runId" element={<Game />} />

          {/* Result screen */}
          <Route path="/result/:runId" element={<Result />} />

          {/* ── Admin routes ── */}
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route
            path="/admin"
            element={
              <AuthGuard>
                <AdminLayout />
              </AuthGuard>
            }
          >
            {/* Index → dashboard */}
            <Route index element={<AdminDashboard />} />
            <Route path="import" element={<AdminImport />} />
            <Route path="snippets" element={<AdminSnippets />} />
            <Route path="daily" element={<AdminDaily />} />
            <Route path="maker" element={<AdminSnippetGen />} />
            <Route path="songs" element={<AdminSongs />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
    </ErrorBoundary>
  );
}
