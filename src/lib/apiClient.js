const API_BASE = "";

export class ApiError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(res) {
  try {
    const body = await res.json();
    if (body?.detail) {
      return typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    }
  } catch {
    /* ignore */
  }
  return `Erro ${res.status}`;
}

async function request(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body instanceof FormData ? headers : { "Content-Type": "application/json", ...headers },
    body: body instanceof FormData ? body : body == null ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new ApiError(await readError(res));
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

export function todayLabel() {
  return new Date().toLocaleDateString("pt-BR");
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString("pt-BR");
}

export function isExported(p) {
  return p?.exported_pg_id != null || p?.status === "enviada";
}

export function isDeleted(p) {
  return p?.status === "excluida";
}

export function isOpen(p) {
  return p?.status === "em_andamento";
}

export function statusLabel(status) {
  switch (status) {
    case "em_andamento":
      return "Em andamento";
    case "concluida":
      return "Concluída";
    case "excluida":
      return "Excluída";
    case "enviada":
      return "Enviada ao Uniplus";
    default:
      return status || "";
  }
}

export const api = {
  health: () => request("/api/health"),

  listProducts: (q) =>
    request(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createProduct: (payload) => request("/api/products", { method: "POST", body: payload }),
  updateProduct: (id, payload) => request(`/api/products/${id}`, { method: "PUT", body: payload }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: "DELETE" }),
  deleteAllProducts: () => request("/api/products", { method: "DELETE" }),

  listProductions: (includeDeleted = false) =>
    request(`/api/productions${includeDeleted ? "?include_deleted=true" : ""}`),
  getDashboard: (days = 14, asOf) => {
    const params = new URLSearchParams({ days: String(days) });
    if (asOf) params.set("as_of", asOf);
    return request(`/api/productions/dashboard?${params}`);
  },
  createProduction: (payload) => request("/api/productions", { method: "POST", body: payload }),
  getProduction: (id) => request(`/api/productions/${id}`),
  updateProduction: (id, payload) => request(`/api/productions/${id}`, { method: "PUT", body: payload }),
  deleteProduction: (id) => request(`/api/productions/${id}/delete`, { method: "POST" }),
  listItems: (id) => request(`/api/productions/${id}/items`),
  scan: (id, barcode) =>
    request(`/api/productions/${id}/scan`, { method: "POST", body: { barcode } }),
  deleteItem: (productionId, itemId) =>
    request(`/api/productions/${productionId}/items/${itemId}`, { method: "DELETE" }),
  exportProduction: (id) => request(`/api/productions/${id}/export`, { method: "POST" }),

  async downloadProductionPdf(id, label = "producao") {
    const res = await fetch(`${API_BASE}/api/productions/${id}/pdf`);
    if (!res.ok) throw new ApiError(await readError(res));
    const blob = await res.blob();
    const safe = String(label).replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40) || "producao";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `producao-${safe}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getSettings: () => request("/api/settings"),
  saveSettings: (payload) => request("/api/settings", { method: "PUT", body: payload }),
  testConnection: () => request("/api/settings/test-connection", { method: "POST" }),
  importFromPostgres: (table) =>
    request(
      `/api/import/postgresql${table ? `?table=${encodeURIComponent(table)}` : ""}`,
      { method: "POST" }
    ),
  async importFile(file) {
    const form = new FormData();
    form.append("file", file);
    return request("/api/import/file", { method: "POST", body: form });
  },
};
