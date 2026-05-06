import { useState, useEffect, useCallback, useRef } from 'react';
import { videoApi } from '../services/api';

/**
 * Hook: fetch & search video list with pagination.
 */
export function useVideoList(initialQuery = {}) {
  const [videos, setVideos]       = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [query, setQuery]         = useState({ search: '', sortBy: 'createdAt', order: 'desc', page: 1, limit: 12, ...initialQuery });

  const fetchVideos = useCallback(async (q) => {
    setLoading(true);
    setError(null);
    try {
      const res = await videoApi.list(q);
      setVideos(res.videos);
      setPagination(res.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVideos(query); }, [query, fetchVideos]);

  const updateQuery = useCallback((updates) => {
    setQuery((prev) => ({ ...prev, ...updates, page: updates.page ?? 1 }));
  }, []);

  return { videos, pagination, loading, error, query, updateQuery, refetch: () => fetchVideos(query) };
}

/**
 * Hook: get a single video and poll its processing status.
 */
export function useVideo(id) {
  const [video, setVideo]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const pollRef             = useRef(null);

  const fetchVideo = useCallback(async () => {
    try {
      const data = await videoApi.get(id);
      setVideo(data);
      // Stop polling when done
      if (data.status === 'ready' || data.status === 'failed') {
        clearInterval(pollRef.current);
      }
    } catch (err) {
      setError(err.message);
      clearInterval(pollRef.current);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVideo();
    pollRef.current = setInterval(fetchVideo, 5000); // poll every 5s
    return () => clearInterval(pollRef.current);
  }, [fetchVideo]);

  return { video, loading, error, refetch: fetchVideo };
}

/**
 * Hook: upload a video with progress tracking.
 */
export function useVideoUpload() {
  const [uploading, setUploading]   = useState(false);
  const [uploadPct, setUploadPct]   = useState(0);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError]           = useState(null);

  const upload = useCallback(async (file, meta) => {
    setUploading(true);
    setUploadPct(0);
    setError(null);
    setProcessingId(null);
    try {
      const res = await videoApi.upload(file, meta, setUploadPct);
      setProcessingId(res.videoId);
      return res;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, uploadPct, processingId, error };
}
