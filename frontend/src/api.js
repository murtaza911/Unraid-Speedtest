const BASE = "/api";

export async function fetchResults(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/results${query ? "?" + query : ""}`);
  return res.json();
}

export async function deleteResult(id) {
  const res = await fetch(`${BASE}/results/${id}`, { method: "DELETE" });
  return res.json();
}

export function runSpeedtest(serverId, onEvent) {
  const url = serverId
    ? `${BASE}/speedtest/run?server_id=${serverId}`
    : `${BASE}/speedtest/run`;

  const eventSource = new EventSource(url);

  eventSource.addEventListener("status", (e) => {
    onEvent({ type: "status", data: JSON.parse(e.data) });
  });

  eventSource.addEventListener("result", (e) => {
    onEvent({ type: "result", data: JSON.parse(e.data) });
    eventSource.close();
  });

  eventSource.addEventListener("error", (e) => {
    if (e.data) {
      onEvent({ type: "error", data: JSON.parse(e.data) });
    }
    eventSource.close();
  });

  return () => eventSource.close();
}

export async function fetchServers() {
  const res = await fetch(`${BASE}/servers`);
  return res.json();
}

export async function fetchFavorites() {
  const res = await fetch(`${BASE}/favorites`);
  return res.json();
}

export async function addFavorite(server) {
  const res = await fetch(`${BASE}/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(server),
  });
  return res.json();
}

export async function removeFavorite(serverId) {
  const res = await fetch(`${BASE}/favorites/${serverId}`, { method: "DELETE" });
  return res.json();
}

export async function fetchScheduler() {
  const res = await fetch(`${BASE}/scheduler`);
  return res.json();
}

export async function updateScheduler(config) {
  const res = await fetch(`${BASE}/scheduler`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
}
