import { useState, useEffect } from "react";
import {
  fetchFavorites,
  removeFavorite,
  fetchServers,
  addFavorite,
  fetchScheduler,
  updateScheduler,
  fetchResults,
} from "../api";

export default function Settings() {
  const [favorites, setFavorites] = useState([]);
  const [scheduler, setScheduler] = useState({
    enabled: false,
    interval_minutes: 360,
    server_id: null,
  });
  const [allServers, setAllServers] = useState([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [showServerPicker, setShowServerPicker] = useState(false);

  useEffect(() => {
    fetchFavorites().then(setFavorites).catch(() => {});
    fetchScheduler().then(setScheduler).catch(() => {});
  }, []);

  const handleRemoveFavorite = async (serverId) => {
    await removeFavorite(serverId);
    setFavorites(favorites.filter((f) => f.server_id !== serverId));
  };

  const handleAddServer = async () => {
    if (allServers.length === 0) {
      setLoadingServers(true);
      try {
        const servers = await fetchServers();
        setAllServers(servers);
      } catch {
        // ignore
      }
      setLoadingServers(false);
    }
    setShowServerPicker(true);
  };

  const handlePickServer = async (server) => {
    await addFavorite({
      server_id: server.id,
      name: server.name,
      location: server.location,
    });
    const updated = await fetchFavorites();
    setFavorites(updated);
    setShowServerPicker(false);
  };

  const handleSchedulerChange = async (changes) => {
    const newConfig = { ...scheduler, ...changes };
    const result = await updateScheduler(newConfig);
    setScheduler(result);
  };

  const handleExportCSV = async () => {
    const results = await fetchResults({ limit: 10000 });
    if (results.length === 0) return;

    const headers = [
      "timestamp",
      "download_mbps",
      "upload_mbps",
      "ping_ms",
      "jitter_ms",
      "server_name",
      "server_location",
      "isp",
      "triggered_by",
    ];
    const csv = [
      headers.join(","),
      ...results.map((r) =>
        headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `speedtest-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const intervalOptions = [
    { label: "1 hour", value: 60 },
    { label: "3 hours", value: 180 },
    { label: "6 hours", value: 360 },
    { label: "12 hours", value: 720 },
    { label: "24 hours", value: 1440 },
  ];

  return (
    <div className="space-y-8">
      {/* Favorites */}
      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">
          Favorite Servers
        </h2>
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {favorites.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-500 text-center">
              No favorite servers yet.
            </div>
          )}
          {favorites.map((f) => (
            <div
              key={f.server_id}
              className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50"
            >
              <div>
                <span className="text-sm text-slate-200">{f.name}</span>
                <span className="text-xs text-slate-500 ml-2">
                  {f.location}
                </span>
              </div>
              <button
                onClick={() => handleRemoveFavorite(f.server_id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddServer}
          disabled={loadingServers}
          className="mt-3 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-sky-400 hover:border-sky-500 transition-colors"
        >
          {loadingServers ? "Loading..." : "Add Server"}
        </button>

        {/* Server picker modal */}
        {showServerPicker && (
          <div className="mt-3 bg-slate-800 border border-slate-700 rounded-xl max-h-64 overflow-y-auto">
            {allServers.map((s) => (
              <div
                key={s.id}
                onClick={() => handlePickServer(s)}
                className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50 cursor-pointer hover:bg-slate-750 transition-colors"
              >
                <div>
                  <span className="text-sm text-slate-200">{s.name}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {s.location}
                  </span>
                </div>
                {s.latency && (
                  <span className="text-xs text-slate-500">
                    {s.latency.toFixed(1)} ms
                  </span>
                )}
              </div>
            ))}
            <div className="px-4 py-2">
              <button
                onClick={() => setShowServerPicker(false)}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Scheduler */}
      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">
          Scheduled Tests
        </h2>
        <div className="bg-slate-800 rounded-xl p-5 space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">
              Run tests automatically
            </span>
            <button
              onClick={() =>
                handleSchedulerChange({ enabled: !scheduler.enabled })
              }
              className={`relative w-11 h-6 rounded-full transition-colors ${
                scheduler.enabled ? "bg-sky-500" : "bg-slate-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  scheduler.enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {/* Interval */}
          {scheduler.enabled && (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Run every
                </label>
                <select
                  value={scheduler.interval_minutes}
                  onChange={(e) =>
                    handleSchedulerChange({
                      interval_minutes: Number(e.target.value),
                    })
                  }
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  {intervalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Server for scheduled tests */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Test server
                </label>
                <select
                  value={scheduler.server_id || ""}
                  onChange={(e) =>
                    handleSchedulerChange({
                      server_id: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="">Auto (Best Server)</option>
                  {favorites.map((f) => (
                    <option key={f.server_id} value={f.server_id}>
                      {f.name} — {f.location}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Data Management */}
      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">
          Data Management
        </h2>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 hover:border-sky-500 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </section>
    </div>
  );
}
