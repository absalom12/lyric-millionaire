import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import AdminPreviews from "./pages/admin/AdminPreviews";
import AdminPlaylists from "./pages/admin/AdminPlaylists";
import AdminSnippets2 from "./pages/admin/AdminSnippets2";

console.error("[DEBUG App] All imports loaded successfully");
console.error("[DEBUG App] AdminSnippetGen:", typeof AdminSnippetGen);
console.error("[DEBUG App] AdminPreviews:", typeof AdminPreviews);
console.error("[DEBUG App] AdminPlaylists:", typeof AdminPlaylists);
console.error("[DEBUG App] AdminSnippets2:", typeof AdminSnippets2);

function DebugLocation() {
  const loc = useLocation();
  console.error("[DEBUG Router] Current location:", loc.pathname, "| Routes rendered");
  return null;
}

function CatchAll() {
  const loc = useLocation();
  console.error("[DEBUG Router] NO MATCH for:", loc.pathname, "— redirecting to /");
  return <Navigate to="/" replace />;
}

export default function App() {
  console.log("[DEBUG App] App() render called");
  return (
    <ErrorBoundary>
    <LanguageProvider>
      <BrowserRouter>
        <DebugLocation />
        <Routes>
          {/* ── Player routes ── */}
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Navigate to="/" replace />} />
          <Route path="/play/global-hits" element={<Navigate to="/" replace />} />
          <Route path="/play/artist-of-the-day" element={<Navigate to="/" replace />} />
          <Route path="/game/:runId" element={<Game />} />
          <Route path="/result/:runId" element={<Result />} />
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
            <Route path="previews" element={<AdminPreviews />} />
            <Route path="playlists" element={<AdminPlaylists />} />
            <Route path="snippets2" element={<AdminSnippets2 />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<CatchAll />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
    </ErrorBoundary>
  );
}
