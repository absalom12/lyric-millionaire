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
  {
    label: "Dashboard",
    path: "/admin",
    icon: "📊",
    description: "KPIs & santé du jeu",
  },
  {
    label: "Import",
    path: "/admin/import",
    icon: "📥",
    description: "CSV / Excel",
  },
  {
    label: "Snippets",
    path: "/admin/snippets",
    icon: "🎵",
    description: "Modération catalogue",
  },
  {
    label: "Daily Artist",
    path: "/admin/daily",
    icon: "⭐",
    description: "Artiste du jour",
  },
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
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-72 xl:w-80 shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="flex h-screen w-full flex-col sticky top-0">
            {/* Brand */}
            <div className="px-6 py-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-yellow-400 text-black flex items-center justify-center font-black text-xl shadow-lg shadow-yellow-400/20">
                  L
                </div>

                <div>
                  <h1 className="text-lg font-black tracking-tight">
                    Lyric Millionaire
                  </h1>
                  <p className="text-xs text-gray-500">
                    Admin Console
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-5 space-y-2 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/admin"}
                  className={({ isActive }) =>
                    [
                      "group flex items-center gap-3 rounded-2xl px-4 py-3 transition border",
                      isActive
                        ? "bg-yellow-400 text-black border-yellow-300 shadow-lg shadow-yellow-400/10"
                        : "bg-white/[0.03] text-gray-300 border-white/10 hover:bg-white/[0.07] hover:text-white",
                    ].join(" ")
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="text-xl shrink-0">{item.icon}</span>

                      <span className="flex flex-col min-w-0">
                        <span className="text-sm font-black truncate">
                          {item.label}
                        </span>

                        <span
                          className={[
                            "text-[11px] truncate",
                            isActive ? "text-black/60" : "text-gray-500",
                          ].join(" ")}
                        >
                          {item.description}
                        </span>
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Bottom */}
            <div className="p-4 border-t border-white/10">
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-3">
                <p className="text-xs text-gray-500">
                  Environnement
                </p>
                <p className="text-sm font-bold text-white mt-1">
                  MVP Admin
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex-1 min-w-0">
          {/* Mobile / tablet topbar */}
          <header className="lg:hidden sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
            <div className="px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-yellow-400 text-black flex items-center justify-center font-black">
                  L
                </div>

                <div>
                  <p className="text-sm font-black">
                    Lyric Millionaire
                  </p>
                  <p className="text-xs text-gray-500">
                    Admin Console
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="bg-red-500/10 text-red-300 border border-red-500/30 rounded-xl px-3 py-2 text-xs font-bold"
              >
                Logout
              </button>
            </div>

            <div className="px-4 pb-4 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/admin"}
                    className={({ isActive }) =>
                      [
                        "rounded-xl px-3 py-2 text-xs font-bold border transition whitespace-nowrap",
                        isActive
                          ? "bg-yellow-400 text-black border-yellow-300"
                          : "bg-white/[0.03] text-gray-300 border-white/10",
                      ].join(" ")
                    }
                  >
                    <span className="mr-1">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </header>

          {/* Desktop header */}
          <header className="hidden lg:block sticky top-0 z-30 border-b border-white/10 bg-[#050509]/80 backdrop-blur-xl">
            <div className="px-8 xl:px-10 py-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-yellow-400 font-black">
                  Admin Panel
                </p>
                <h2 className="text-2xl font-black tracking-tight mt-1">
                  Console de pilotage
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden xl:block text-right">
                  <p className="text-xs text-gray-500">
                    Connecté
                  </p>
                  <p className="text-sm font-bold text-gray-300">
                    Administrateur
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className="bg-white/[0.04] text-gray-300 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold hover:bg-white/[0.08] hover:text-white transition"
                >
                  Se déconnecter
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="px-4 py-5 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
            <div className="mx-auto w-full max-w-[1800px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}