import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Settings from "./pages/Settings";

function NavBar() {
  const linkClass = ({ isActive }) =>
    `px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-slate-800 text-sky-400"
        : "text-slate-500 hover:text-slate-300"
    }`;

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
      <div className="flex items-center gap-6">
        <span className="text-lg font-bold text-slate-100 tracking-tight">
          SpeedTest
        </span>
        <div className="flex gap-1">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            History
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            Settings
          </NavLink>
        </div>
      </div>
      <span className="text-xs text-slate-600">Unraid Server</span>
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <NavBar />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
