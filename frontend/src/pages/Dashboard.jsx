import { useState, useEffect, useCallback } from "react";
import { runSpeedtest, fetchResults } from "../api";
import ServerSelector from "../components/ServerSelector";
import TestProgress from "../components/TestProgress";
import ResultCards from "../components/ResultCards";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const [serverId, setServerId] = useState(null);
  const [testing, setTesting] = useState(false);
  const [phase, setPhase] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [recentResults, setRecentResults] = useState([]);

  const loadRecent = useCallback(async () => {
    try {
      const results = await fetchResults({ limit: 10 });
      setRecentResults(results);
      if (results.length > 0 && !lastResult) {
        setLastResult(results[0]);
      }
    } catch {
      // ignore
    }
  }, [lastResult]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleRunTest = () => {
    setTesting(true);
    setPhase("connecting");

    runSpeedtest(serverId, (event) => {
      if (event.type === "status") {
        setPhase(event.data.phase);
      } else if (event.type === "result") {
        setLastResult(event.data);
        setTesting(false);
        setPhase(null);
        loadRecent();
      } else if (event.type === "error") {
        setTesting(false);
        setPhase(null);
      }
    });
  };

  const chartData = [...recentResults]
    .reverse()
    .map((r) => ({
      date: new Date(r.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      download: r.download_mbps,
    }));

  return (
    <div>
      {/* Server selector + Run button */}
      <div className="flex items-end gap-4 mb-8">
        <ServerSelector value={serverId} onChange={setServerId} />
        <button
          onClick={handleRunTest}
          disabled={testing}
          className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
            testing
              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
              : "bg-sky-400 text-slate-900 hover:bg-sky-300"
          }`}
        >
          {testing ? "Running..." : "Run Test"}
        </button>
      </div>

      {/* Progress indicator */}
      {testing && <TestProgress phase={phase} />}

      {/* Result cards */}
      <ResultCards result={lastResult} />

      {/* Mini history chart */}
      {chartData.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-slate-200">
              Recent History
            </span>
            <a
              href="/history"
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              View All →
            </a>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="date"
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#e2e8f0",
                  fontSize: 13,
                }}
                formatter={(val) => [`${val} Mbps`, "Download"]}
              />
              <Bar
                dataKey="download"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
