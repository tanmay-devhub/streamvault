import { useState, useEffect, useCallback } from 'react';
import { profileApi } from '../services/api';

/**
 * Get the currently signed-in user's own profile.
 * Returns: profile (object | null), loading, error, refresh
 * null = authenticated but no profile set up yet
 */
export function useMyProfile() {
  const [profile, setProfile] = useState(undefined); // undefined = still loading, null = confirmed no profile
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await profileApi.getMyProfile();
      setProfile(data); // null = server confirmed no profile; object = has profile
    } catch (err) {
      setError(err.message);
      // Leave profile as undefined (unknown) so callers can distinguish
      // "confirmed no profile" (null) from "fetch failed" (undefined + error).
      setProfile(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { profile, loading, error, refresh: fetch };
}

/**
 * Fetch a channel profile by Clerk userId.
 * Used on Watch and Channel pages.
 */
export function useChannelProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    profileApi.getByUserId(userId)
      .then(setProfile)
      .catch((err) => {
        // 404 = no profile yet, not an error worth surfacing
        if (!err.message?.toLowerCase().includes('not found')) {
          setError(err.message);
        }
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  return { profile, loading, error };
}
