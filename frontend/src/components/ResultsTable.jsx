import { useState } from "react";

const PAGE_SIZE = 25;

export default function ResultsTable({ results, onDelete, onClearAll }) {
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(0);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const pageResults = results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      {/* Header row with title and clear button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <span className="text-sm font-semibold text-slate-200">
          Test History
          <span className="text-xs text-slate-500 font-normal ml-2">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
        </span>
        {results.length > 0 && (
          <div className="flex items-center gap-2">
            {showConfirmClear ? (
              <>
                <span className="text-xs text-slate-400">Clear all results?</span>
                <button
                  onClick={() => {
                    onClearAll();
                    setShowConfirmClear(false);
                    setPage(0);
                  }}
                  className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                >
                  Yes, clear
                </button>
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="text-xs px-2 py-1 text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowConfirmClear(true)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Clear History
              </button>
            )}
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_0.8fr] px-4 py-2 text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
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
      {pageResults.map((r) => (
        <div key={r.id}>
          <div
            onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_0.8fr] px-4 py-3 text-sm border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/30 transition-colors"
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
            <div className="px-4 py-3 bg-slate-700/20 border-b border-slate-700/50 flex items-center gap-6 text-sm">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className={`text-xs px-3 py-1 rounded ${
              page === 0
                ? "text-slate-600 cursor-not-allowed"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ← Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className={`text-xs px-3 py-1 rounded ${
              page >= totalPages - 1
                ? "text-slate-600 cursor-not-allowed"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
