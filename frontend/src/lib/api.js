import axios from "axios";

// On Vercel, frontend and backend share the same domain, so BACKEND_URL is empty.
// For local development, set REACT_APP_BACKEND_URL=http://localhost:8000 in frontend/.env.local
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

export const listPayments = (params = {}) =>
  api.get("/payments", { params }).then((r) => r.data);

export const getStats = () => api.get("/payments/stats").then((r) => r.data);

export const createPayment = (data) =>
  api.post("/payments", data).then((r) => r.data);

export const updatePayment = (id, data) =>
  api.patch(`/payments/${id}`, data).then((r) => r.data);

export const deletePayment = (id) =>
  api.delete(`/payments/${id}`).then((r) => r.data);

export const uploadScreenshot = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api
    .post("/screenshots", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

/**
 * Return the display URL for a screenshot.
 * New uploads store a full Vercel Blob URL in screenshot_path.
 * This function passes those through directly.
 */
export const screenshotUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path; // Vercel Blob public URL — use directly
  }
  return `${API}/screenshots/${path}`; // legacy Emergent proxy path
};

export default api;
