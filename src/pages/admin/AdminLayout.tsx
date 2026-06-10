import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../lib/firebase";

type AdminNavItem = {
  label: string;
  path: string;
  icon: string;
  description: string;
};

const navItems: AdminNavItem[] = [
  { label: "Dashboard",    path: "/admin",          icon: "📊", description: "KPIs & analytics" },
  { label: "Import",       path: "/admin/import",   icon: "📥", description: "CSV / Excel" },
  { label: "Snippets",     path: "/admin/snippets", icon: "🎵", description: "Modération catalogue" },
  { label: "Daily Artist", path: "/admin/daily",    icon: "⭐", description: "Artiste du jour" },
  { label: "Snippets auto", path: "/admin/maker",   icon: "🤖", description: "Génération auto" },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-[#050509] text-white">
      <div className="flex min-h-screen">

        {/* ── Desktop sidebar ── */}
        <aside className="hidden lg:flex lg:w-64 xl:w-72 shrink-0 flex-col border-r border-white/[0.07]"
          style={{ background: "linear-gradient(180deg, #0a0a12 0%, #07070e 100%)" }}>

          {/* Brand */}
          <div className="px-5 py-5 border-b border-white/[0.07]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-yellow-400 text-black flex items-center justify-center font-black text-base shadow-lg shadow-yellow-400/30 shrink-0">
                L
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black tracking-tight truncate">Lyric Millionaire</p>
                <p className="text-[11px] text-gray-600 font-medium">Admin Console</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-700">
              Navigation
            </p>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/admin"}
                className={({ isActive }) => [
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150",
                  isActive
                    ? "bg-yellow-400/[0.12] text-yellow-300 border border-yellow-400/20"
                    : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent",
                ].join(" ")}
              >
                {({ isActive }) => (
                  <>
                    <span className={["text-base shrink-0 transition-transform duration-150", isActive ? "scale-110" : "group-hover:scale-105"].join(" ")}>
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={["block text-sm font-bold truncate", isActive ? "text-yellow-300" : ""].join(" ")}>
                        {item.label}
                      </span>
                      <span className="block text-[11px] text-gray-600 truncate group-hover:text-gray-500 transition-colors">
                        {item.description}
                      </span>
                    </span>
                    {isActive && (
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-3 py-4 border-t border-white/[0.07] space-y-2">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-600 hover:text-gray-300 hover:bg-white/[0.04] transition group border border-transparent"
            >
              <span className="text-sm">🌐</span>
              <span className="font-medium">Voir le site</span>
              <span className="ml-auto text-gray-700 group-hover:text-gray-500">↗</span>
            </a>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-600 hover:text-red-400 hover:bg-red-500/[0.06] transition border border-transparent hover:border-red-500/20"
            >
              <span className="text-sm">🚪</span>
              <span className="font-medium">Se déconnecter</span>
            </button>
          </div>
        </aside>

        {/* ── Main area ── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Mobile topbar */}
          <header className="lg:hidden sticky top-0 z-40 border-b border-white/[0.07] bg-[#050509]/90 backdrop-blur-xl">
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-yellow-400 text-black flex items-center justify-center font-black text-sm">L</div>
                <span className="text-sm font-black">Admin</span>
              </div>
              <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-red-400 transition font-medium">
                Déco
              </button>
            </div>
            <div className="px-3 pb-3 overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/admin"}
                    className={({ isActive }) => [
                      "rounded-lg px-3 py-1.5 text-xs font-bold border transition whitespace-nowrap flex items-center gap-1.5",
                      isActive
                        ? "bg-yellow-400/15 text-yellow-300 border-yellow-400/25"
                        : "bg-white/[0.03] text-gray-500 border-white/[0.07] hover:text-gray-300",
                    ].join(" ")}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </header>

          {/* Desktop header */}
          <header className="hidden lg:flex sticky top-0 z-30 border-b border-white/[0.07] bg-[#050509]/80 backdrop-blur-xl items-center justify-between px-8 xl:px-10 py-4">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-medium text-gray-500">Admin</span>
              <span>/</span>
              <span className="text-gray-400">Console</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-600 hover:text-gray-300 transition font-medium flex items-center gap-1"
              >
                Voir le site ↗
              </a>
              <span className="h-4 w-px bg-white/10" />
              <button
                onClick={handleLogout}
                className="bg-white/[0.04] text-gray-400 border border-white/[0.07] rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-red-500/[0.08] hover:text-red-400 hover:border-red-500/20 transition"
              >
                Déconnecter
              </button>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
            <div className="mx-auto w-full max-w-[1800px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
