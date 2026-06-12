import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

// Player pages
import Home from "./pages/Home";
import Game from "./pages/Game";
import Result from "./pages/Result";
import { Navigate } from "react-router-dom";

// Admin pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminImport from "./pages/admin/AdminImport";
import AdminSnippets from "./pages/admin/AdminSnippets";
import AdminDaily from "./pages/admin/AdminDaily";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminSnippetGen from "./pages/admin/AdminSnippetGen";
import AdminPreviews from "./pages/admin/AdminPreviews";
import AdminPlaylists from "./pages/admin/AdminPlaylists";

// Auth guard
import AuthGuard from "./components/AuthGuard";

// Localization
import { LanguageProvider } from "./i18n/LanguageContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* Player */}
          <Route path="/" element={<Home />} />
          <Route path="/game/:runId" element={<Game />} />
          <Route path="/result/:runId" element={<Result />} />
          <Route path="/play" element={<Navigate to="/" replace />} />
          <Route path="/play/global-hits" element={<Navigate to="/" replace />} />
          <Route path="/play/artist-of-the-day" element={<Navigate to="/" replace />} />
          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AuthGuard><AdminLayout /></AuthGuard>}>
            <Route index element={<AdminDashboard />} />
            <Route path="import" element={<AdminImport />} />
            <Route path="snippets" element={<AdminSnippets />} />
            <Route path="daily" element={<AdminDaily />} />
            <Route path="maker" element={<AdminSnippetGen />} />
            <Route path="previews" element={<AdminPreviews />} />
            <Route path="playlists" element={<AdminPlaylists />} />
          </Route>
          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>
);
