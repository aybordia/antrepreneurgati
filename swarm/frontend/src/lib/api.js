const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

function buildHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function streamFetch(url, body, onChunk, token, signal) {
  const response = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 401) {
    localStorage.removeItem("google_id_token");
    window.location.reload();
    throw new Error("Session expired — please sign in again");
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        try { onChunk(JSON.parse(raw)); }
        catch (e) { console.error("[sse parse error]", e, "raw:", raw.slice(0, 200)); }
      }
    }
  }
}

export async function postJSON(url, body, token) {
  const response = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function getJSON(url, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}${url}`, { headers });
  if (response.status === 401) {
    localStorage.removeItem("google_id_token");
    window.location.reload();
    throw new Error("Session expired");
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
