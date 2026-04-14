import { useState } from "react";

export default function ResultsTable({ results, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_0.8fr] px-4 py-3 text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
        <span>Date</span>
        <span>Server</span>
        <span>Download</span>
        <span>Upload</span>
        <span>Ping</span>
        <span>Type</span>
      </div>

      {/* Rows */}
      {results.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          No results yet. Run a speed test to get started.
        </div>
      )}
      {results.map((r) => (
        <div key={r.id}>
          <div
            onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_0.8fr] px-4 py-3 text-sm border-b border-slate-700/50 cursor-pointer hover:bg-slate-750 transition-colors"
          >
            <span className="text-slate-400">
              {new Date(r.timestamp).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span className="text-slate-200 truncate">
              {r.server_name}
            </span>
            <span className="text-sky-400">{r.download_mbps.toFixed(1)} Mbps</span>
            <span className="text-violet-400">{r.upload_mbps.toFixed(1)} Mbps</span>
            <span className="text-emerald-400">{r.ping_ms.toFixed(1)} ms</span>
            <span className="text-[11px] text-slate-500 capitalize">
              {r.triggered_by}
            </span>
          </div>
          {expandedId === r.id && (
            <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/50 flex items-center gap-6 text-sm">
              <span className="text-slate-400">
                ISP: <span className="text-slate-200">{r.isp}</span>
              </span>
              <span className="text-slate-400">
                Jitter: <span className="text-amber-400">{r.jitter_ms.toFixed(1)} ms</span>
              </span>
              <span className="text-slate-400">
                Location: <span className="text-slate-200">{r.server_location}</span>
              </span>
              {r.result_url && (
                <a
                  href={r.result_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300"
                >
                  Ookla Result →
                </a>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(r.id);
                }}
                className="ml-auto text-red-400 hover:text-red-300 text-xs"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
