const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

function buildHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function streamFetch(url, body, onChunk, token) {
  const response = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
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
        try { onChunk(JSON.parse(line.slice(6))); }
        catch { /* ignore malformed chunks */ }
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
