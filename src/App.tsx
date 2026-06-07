import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageContext";
import AuthGuard from "./components/AuthGuard";

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

export default function App() {
  return (
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
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
