import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function SpeedChart({ data }) {
  const chartData = [...data].reverse().map((r) => ({
    date: new Date(r.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    time: new Date(r.timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    download: r.download_mbps,
    upload: r.upload_mbps,
    ping: r.ping_ms,
  }));

  return (
    <div className="bg-slate-800 rounded-xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">
        Speed Over Time
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 13,
            }}
            labelFormatter={(label, payload) => {
              if (payload?.[0]?.payload?.time) {
                return `${label} ${payload[0].payload.time}`;
              }
              return label;
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
          />
          <Line
            type="monotone"
            dataKey="download"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            name="Download (Mbps)"
          />
          <Line
            type="monotone"
            dataKey="upload"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={false}
            name="Upload (Mbps)"
          />
          <Line
            type="monotone"
            dataKey="ping"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
            name="Ping (ms)"
            yAxisId="right"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
