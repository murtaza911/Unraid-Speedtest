export default function ResultCards({ result }) {
  if (!result) return null;

  const cards = [
    { label: "Download", value: result.download_mbps, unit: "Mbps", color: "text-sky-400" },
    { label: "Upload", value: result.upload_mbps, unit: "Mbps", color: "text-violet-400" },
    { label: "Ping", value: result.ping_ms, unit: "ms", color: "text-emerald-400" },
    { label: "Jitter", value: result.jitter_ms, unit: "ms", color: "text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-slate-800 rounded-xl p-5 text-center"
        >
          <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-2">
            {card.label}
          </div>
          <div className={`text-4xl font-bold ${card.color} leading-none`}>
            {typeof card.value === "number" ? card.value.toFixed(1) : "—"}
          </div>
          <div className="text-sm text-slate-500 mt-1">{card.unit}</div>
        </div>
      ))}
    </div>
  );
}
