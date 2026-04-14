import { useState, useEffect } from "react";
import { fetchFavorites, fetchServers } from "../api";

export default function ServerSelector({ value, onChange }) {
  const [favorites, setFavorites] = useState([]);
  const [allServers, setAllServers] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFavorites().then(setFavorites).catch(() => {});
  }, []);

  const handleBrowse = async () => {
    if (allServers.length === 0) {
      setLoading(true);
      try {
        const servers = await fetchServers();
        setAllServers(servers);
      } catch {
        // silently fail
      }
      setLoading(false);
    }
    setShowAll(true);
  };

  return (
    <div className="flex-1 relative">
      <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1">
        Server
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 appearance-none cursor-pointer focus:outline-none focus:border-sky-500"
      >
        <option value="">Auto (Best Server)</option>
        {favorites.length > 0 && (
          <optgroup label="Favorites">
            {favorites.map((s) => (
              <option key={s.server_id} value={s.server_id}>
                {s.name} — {s.location}
              </option>
            ))}
          </optgroup>
        )}
        {showAll && allServers.length > 0 && (
          <optgroup label="All Servers">
            {allServers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.location}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {!showAll && (
        <button
          onClick={handleBrowse}
          disabled={loading}
          className="mt-2 text-xs text-sky-400 hover:text-sky-300 transition-colors"
        >
          {loading ? "Loading servers..." : "Browse all servers..."}
        </button>
      )}
    </div>
  );
}
