export default function TestProgress({ phase }) {
  if (!phase) return null;

  const phases = ["connecting", "download", "upload"];
  const currentIdx = phases.indexOf(phase);

  return (
    <div className="bg-slate-800 rounded-xl p-6 mb-8">
      <div className="flex items-center gap-8">
        {phases.map((p, i) => (
          <div key={p} className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                i < currentIdx
                  ? "bg-emerald-400"
                  : i === currentIdx
                  ? "bg-sky-400 animate-pulse"
                  : "bg-slate-600"
              }`}
            />
            <span
              className={`text-sm capitalize ${
                i === currentIdx
                  ? "text-slate-200 font-medium"
                  : "text-slate-500"
              }`}
            >
              {p === "connecting" ? "Connecting" : `Testing ${p}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
