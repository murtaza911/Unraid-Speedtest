import { useState, useEffect, useCallback } from "react";
import { runSpeedtest, stopSpeedtest, fetchResults, deleteResult, deleteAllResults } from "../api";
import ServerSelector from "../components/ServerSelector";
import TestProgress from "../components/TestProgress";
import ResultCards from "../components/ResultCards";
import SpeedChart from "../components/SpeedChart";
import ResultsTable from "../components/ResultsTable";

export default function Dashboard() {
  const [serverId, setServerId] = useState(null);
  const [testing, setTesting] = useState(false);
  const [phase, setPhase] = useState(null);
  const [progress, setProgress] = useState(0);
  const [speedMbps, setSpeedMbps] = useState(0);
  const [pingMs, setPingMs] = useState(0);
  const [jitterMs, setJitterMs] = useState(0);
  const [completedDownload, setCompletedDownload] = useState(null);
  const [completedUpload, setCompletedUpload] = useState(null);
  const [serverName, setServerName] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [results, setResults] = useState([]);
  const [cancelFn, setCancelFn] = useState(null);

  const loadResults = useCallback(async () => {
    try {
      const data = await fetchResults({ limit: 500 });
      setResults(data);
      if (data.length > 0 && !lastResult) {
        setLastResult(data[0]);
      }
    } catch {
      // ignore
    }
  }, [lastResult]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const handleRunTest = () => {
    setTesting(true);
    setPhase("connecting");
    setProgress(0);
    setSpeedMbps(0);
    setPingMs(0);
    setJitterMs(0);
    setCompletedDownload(null);
    setCompletedUpload(null);
    setServerName("");

    const cancel = runSpeedtest(serverId, (event) => {
      if (event.type === "status") {
        setPhase(event.data.phase);
        if (event.data.server_name) {
          setServerName(
            `${event.data.server_name} — ${event.data.server_location}`
          );
        }
      } else if (event.type === "progress") {
        const d = event.data;
        setPhase(d.phase);
        setProgress(d.progress || 0);

        if (d.phase === "ping") {
          setPingMs(d.latency || 0);
          setJitterMs(d.jitter || 0);
        } else if (d.phase === "download") {
          setSpeedMbps(d.speed_mbps || 0);
          if (d.progress >= 1) {
            setCompletedDownload(d.speed_mbps);
          }
        } else if (d.phase === "upload") {
          setSpeedMbps(d.speed_mbps || 0);
          if (d.progress >= 1) {
            setCompletedUpload(d.speed_mbps);
          }
        }
      } else if (event.type === "result") {
        setLastResult(event.data);
        setTesting(false);
        setPhase(null);
        setCancelFn(null);
        loadResults();
      } else if (event.type === "error" || event.type === "stopped") {
        setTesting(false);
        setPhase(null);
        setCancelFn(null);
      }
    });
    setCancelFn(() => cancel);
  };

  const handleStopTest = async () => {
    if (cancelFn) cancelFn();
    await stopSpeedtest();
    setTesting(false);
    setPhase(null);
    setCancelFn(null);
  };

  const handleDelete = async (id) => {
    await deleteResult(id);
    loadResults();
  };

  const handleClearAll = async () => {
    await deleteAllResults();
    setResults([]);
    setLastResult(null);
  };

  return (
    <div>
      {/* Server selector + Run button */}
      <div className="flex items-end gap-4 mb-8">
        <ServerSelector value={serverId} onChange={setServerId} />
        <button
          onClick={testing ? handleStopTest : handleRunTest}
          className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
            testing
              ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
              : "bg-sky-400 text-slate-900 hover:bg-sky-300"
          }`}
        >
          {testing ? "Stop" : "Run Test"}
        </button>
      </div>

      {/* Animated progress ring */}
      {testing && (
        <TestProgress
          phase={phase}
          progress={progress}
          speedMbps={speedMbps}
          pingMs={pingMs}
          jitterMs={jitterMs}
          completedDownload={completedDownload}
          completedUpload={completedUpload}
          serverName={serverName}
        />
      )}

      {/* Result cards */}
      {!testing && <ResultCards result={lastResult} />}

      {/* History chart + table */}
      {!testing && results.length > 0 && (
        <>
          <SpeedChart data={results} />
          <ResultsTable results={results} onDelete={handleDelete} onClearAll={handleClearAll} />
        </>
      )}
    </div>
  );
}
