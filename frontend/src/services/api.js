import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: BASE, timeout: 30_000 });

let _tokenGetter = null;
export function setTokenGetter(fn) { _tokenGetter = fn; }

api.interceptors.request.use(async (config) => {
  if (_tokenGetter) {
    try {
      const token = await _tokenGetter();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Network error';
    return Promise.reject(new Error(message));
  }
);

// ── Video API ─────────────────────────────────────────────
export const videoApi = {
  async upload(file, meta, onProgress) {
    const contentType = file.type || 'video/mp4';

    // Step 1: create the DB record and get a presigned S3 PUT URL (tiny JSON — no file data).
    const { videoId, uploadUrl, s3Key } = await api.post('/videos/prepare', {
      filename:    file.name,
      contentType,
      title:       meta?.title,
      description: meta?.description,
      privacy:     meta?.privacy,
    });

    // Step 2: upload the file directly from the browser to S3, bypassing Render entirely.
    await axios.put(uploadUrl, file, {
      headers:          { 'Content-Type': contentType },
      timeout:          0,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });

    // Step 3: tell the backend the S3 upload finished so it can queue processing.
    await api.post(`/videos/${videoId}/finalize`, { s3Key });
    return { videoId };
  },
  list(params = {})        { return api.get('/videos', { params }); },
  get(id)                  { return api.get(`/videos/${id}`); },
  status(id)               { return api.get(`/videos/${id}/status`); },
  update(id, fields)       { return api.patch(`/videos/${id}`, fields); },
  delete(id)               { return api.delete(`/videos/${id}`); },
  getLike(id)                    { return api.get(`/videos/${id}/like`); },
  toggleLike(id)                 { return api.post(`/videos/${id}/like`); },
  getTranscript(id)              { return api.get(`/videos/${id}/transcript`); },
  getProgress(id)                { return api.get(`/videos/${id}/progress`); },
  saveProgress(id, position, duration) {
    return api.post(`/videos/${id}/progress`, { position, duration });
  },
  getHeatmap(id)                 { return api.get(`/videos/${id}/heatmap`); },
  recordHeatmap(id, bucket)      { return api.post(`/videos/${id}/heatmap`, { bucket }); },
  getAnalytics(id)               { return api.get(`/videos/${id}/analytics`); },
  uploadThumbnail(id, file) {
    const form = new FormData();
    form.append('thumbnail', file);
    return api.patch(`/videos/${id}/thumbnail`, form);
  },
};

// ── Profile API ───────────────────────────────────────────
export const profileApi = {
  getMyProfile()           { return api.get('/profile/me'); },
  create(data)             { return api.post('/profile', data); },
  update(data)             { return api.patch('/profile', data); },
  deleteMyChannel()        { return api.delete('/profile'); },
  getByUserId(userId)      { return api.get(`/profile/${userId}`); },
  search(q)                { return api.get('/profile/search', { params: { q } }); },
};

// ── History API ───────────────────────────────────────────
export const historyApi = {
  get() { return api.get('/history'); },
};

// ── Share API (public — no auth needed) ──────────────────
export const shareApi = {
  get(id) {
    return axios.get(`${BASE}/share/${id}`).then((r) => r.data);
  },
};

// ── Admin API ─────────────────────────────────────────────
export const adminApi = {
  getStats()                    { return api.get('/admin/stats'); },
  listVideos(params)            { return api.get('/admin/videos', { params }); },
  deleteVideo(id)               { return api.delete(`/admin/videos/${id}`); },
  deleteAllFailed()             { return api.delete('/admin/videos/failed/all'); },
  uploadVideo(file, meta, onProgress) {
    const form = new FormData();
    form.append('video', file);
    if (meta?.title)       form.append('title',       meta.title);
    if (meta?.description) form.append('description', meta.description);
    return api.post('/admin/videos/upload', form, {
      timeout: 0,
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
  },
  listUsers(params)             { return api.get('/admin/users', { params }); },
  setUserRole(id, role)         { return api.patch(`/admin/users/${id}/role`, { role }); },
  suspendUser(id, data)         { return api.post(`/admin/users/${id}/suspend`, data); },
  liftSuspension(id)            { return api.delete(`/admin/users/${id}/suspend`); },
  getAuditLog(params)           { return api.get('/admin/audit', { params }); },
  listProfiles(params)          { return api.get('/admin/profiles', { params }); },
  updateProfile(userId, data)   { return api.patch(`/admin/profiles/${userId}`, data); },
  deleteProfile(userId)         { return api.delete(`/admin/profiles/${userId}`); },
};

export default api;
