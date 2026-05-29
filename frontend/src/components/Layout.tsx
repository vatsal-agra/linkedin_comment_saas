import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { cx } from "./ui";

const NAV = [
  { to: "/app", label: "Dashboard", end: true },
  { to: "/app/profiles", label: "Tracked profiles" },
  { to: "/app/profile", label: "My profile" },
  { to: "/app/schedule", label: "Schedule" },
  { to: "/app/keys", label: "API keys" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside className="lg:w-64 lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-6 py-5">
          <Logo />
          <span className="font-extrabold tracking-tight">Replier</span>
        </div>
        <nav className="px-3 pb-4 flex lg:flex-col gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  "whitespace-nowrap rounded-lg px-3.5 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 backdrop-blur px-6 py-3">
          <div className="text-sm text-slate-500">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Log out
          </button>
        </header>
        <main className="flex-1 px-6 py-8">
          <div className="mx-auto w-full max-w-3xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white text-sm font-bold">
      in
    </span>
  );
}
