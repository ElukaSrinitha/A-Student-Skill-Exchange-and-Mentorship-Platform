const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const TOKEN_KEY = "sb_token"; // only the session token lives in the browser; all data lives in the database

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = "GET", body } = {}) {
  const token = getToken();
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Cannot reach the server. Check that the backend is running.");
  }
  if (res.status === 401 && token) onUnauthorized();
  return res;
}

export async function api(path, options) {
  const res = await request(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/** Downloads a file from an authenticated endpoint (used for CSV reports). */
export async function download(path, filename) {
  const res = await request(path);
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Download failed"); }
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== "" && v !== undefined && v !== null && v !== "All") p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : "";
};
