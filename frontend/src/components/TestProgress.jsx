import { useEffect, useRef } from "react";

const CIRCUMFERENCE = 2 * Math.PI * 100; // radius=100

export default function TestProgress({
  phase,
  progress = 0,
  speedMbps = 0,
  pingMs = 0,
  jitterMs = 0,
  completedDownload = null,
  completedUpload = null,
  serverName = "",
}) {
  if (!phase) return null;

  const displaySpeed = speedMbps > 0 ? speedMbps.toFixed(1) : "—";
  const ringOffset = CIRCUMFERENCE - (progress * CIRCUMFERENCE);

  const phaseLabel =
    phase === "connecting"
      ? "Connecting..."
      : phase === "ping"
      ? "Testing Ping"
      : phase === "download"
      ? "Download"
      : phase === "upload"
      ? "Upload"
      : phase;

  const ringColor =
    phase === "download"
      ? "#38bdf8"
      : phase === "upload"
      ? "#a78bfa"
      : phase === "ping"
      ? "#34d399"
      : "#64748b";

  const glowColor =
    phase === "download"
      ? "rgba(56, 189, 248, 0.4)"
      : phase === "upload"
      ? "rgba(167, 139, 250, 0.4)"
      : phase === "ping"
      ? "rgba(52, 211, 153, 0.4)"
      : "transparent";

  const showSpeed = phase === "download" || phase === "upload";

  return (
    <div className="flex flex-col items-center mb-8">
      {/* Server name */}
      {serverName && (
        <div className="text-xs text-slate-500 mb-4 tracking-wide">
          {serverName}
        </div>
      )}

      {/* Ring */}
      <div className="relative w-[260px] h-[260px] mb-6">
        <svg
          className="w-[260px] h-[260px]"
          viewBox="0 0 260 260"
          style={{ transform: "rotate(-90deg)" }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Track */}
          <circle
            cx="130"
            cy="130"
            r="100"
            fill="none"
            stroke="#334155"
            strokeWidth="3"
          />
          {/* Background ring */}
          <circle
            cx="130"
            cy="130"
            r="100"
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
          />
          {/* Progress ring */}
          <circle
            cx="130"
            cy="130"
            r="100"
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={ringOffset}
            filter="url(#glow)"
            style={{
              transition: "stroke-dashoffset 0.3s ease-out, stroke 0.3s ease",
              filter: `drop-shadow(0 0 8px ${glowColor})`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showSpeed ? (
            <>
              <div
                className="text-5xl font-extrabold leading-none tabular-nums"
                style={{ color: ringColor }}
              >
                {displaySpeed}
              </div>
              <div className="text-sm text-slate-500 mt-1">Mbps</div>
            </>
          ) : phase === "ping" ? (
            <>
              <div className="text-5xl font-extrabold leading-none text-emerald-400 tabular-nums">
                {pingMs > 0 ? pingMs.toFixed(1) : "—"}
              </div>
              <div className="text-sm text-slate-500 mt-1">ms</div>
            </>
          ) : (
            <div className="w-6 h-6 border-2 border-slate-500 border-t-sky-400 rounded-full animate-spin" />
          )}
          <div
            className="text-[11px] uppercase tracking-[3px] mt-3 font-medium"
            style={{ color: ringColor }}
          >
            {phaseLabel}
          </div>
        </div>
      </div>

      {/* Completed metrics below the ring */}
      <div className="flex gap-8">
        <div className="text-center min-w-[80px]">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            Ping
          </div>
          <div className="text-lg font-bold text-emerald-400 tabular-nums">
            {pingMs > 0 ? `${pingMs.toFixed(1)} ms` : "—"}
          </div>
        </div>
        <div className="text-center min-w-[80px]">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            Download
          </div>
          <div className="text-lg font-bold text-sky-400 tabular-nums">
            {completedDownload !== null
              ? `${completedDownload.toFixed(1)} Mbps`
              : "—"}
          </div>
        </div>
        <div className="text-center min-w-[80px]">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            Upload
          </div>
          <div className="text-lg font-bold text-violet-400 tabular-nums">
            {completedUpload !== null
              ? `${completedUpload.toFixed(1)} Mbps`
              : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
