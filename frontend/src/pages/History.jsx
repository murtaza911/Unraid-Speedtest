import { useState, useEffect } from "react";
import { fetchResults, deleteResult } from "../api";
import SpeedChart from "../components/SpeedChart";
import ResultsTable from "../components/ResultsTable";

export default function History() {
  const [results, setResults] = useState([]);
  const [serverFilter, setServerFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("30");

  const loadResults = async () => {
    const params = { limit: 500 };
    if (serverFilter) params.server_id = serverFilter;
    if (typeFilter) params.triggered_by = typeFilter;
    if (dateFilter) {
      const d = new Date();
      d.setDate(d.getDate() - Number(dateFilter));
      params.start_date = d.toISOString();
    }
    try {
      const data = await fetchResults(params);
      setResults(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadResults();
  }, [serverFilter, typeFilter, dateFilter]);

  const handleDelete = async (id) => {
    await deleteResult(id);
    loadResults();
  };

  const uniqueServers = [
    ...new Map(results.map((r) => [r.server_id, { id: r.server_id, name: r.server_name }])).values(),
  ];

  return (
    <div>
      <SpeedChart data={results} />

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={serverFilter}
          onChange={(e) => setServerFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-sky-500"
        >
          <option value="">All Servers</option>
          {uniqueServers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-sky-500"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="">All time</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-sky-500"
        >
          <option value="">All Types</option>
          <option value="manual">Manual</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>

      <ResultsTable results={results} onDelete={handleDelete} />
    </div>
  );
}
