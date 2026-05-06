import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { useChannelProfile } from '../hooks/useProfile';
import { useVideoList } from '../hooks/useVideos';
import { profileApi } from '../services/api';
import VideoCard from '../components/VideoCard';

function DeleteChannelModal({ channelName, onConfirm, onClose }) {
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-red-500/20 rounded-2xl max-w-md w-full p-8 shadow-2xl animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-red-500 dark:text-red-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Delete Channel</h2>
        </div>

        <p className="text-slate-500 dark:text-gray-400 text-sm mt-3 leading-relaxed">
          You are about to permanently delete <span className="text-slate-900 dark:text-white font-semibold">"{channelName}"</span>.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-400 dark:text-gray-500">
          <li className="flex items-center gap-2">
            <span className="text-emerald-500 dark:text-emerald-400">✓</span> Your videos will <span className="text-slate-900 dark:text-white mx-1">not</span> be deleted
          </li>
          <li className="flex items-center gap-2">
            <span className="text-red-500 dark:text-red-400">✗</span> Your channel name, bio, and avatar will be removed
          </li>
          <li className="flex items-center gap-2">
            <span className="text-red-500 dark:text-red-400">✗</span> This cannot be undone
          </li>
        </ul>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={confirming}
            className="btn-ghost flex-1 justify-center"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={confirming}
            className="flex-1 justify-center px-4 py-2.5 rounded-xl bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/25 text-sm font-medium transition-all"
          >
            {confirming ? 'Deleting…' : 'Delete Channel'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditProfileModal({ profile, onSave, onClose }) {
  const [channelName, setChannelName] = useState(profile.channelName || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) { toast.error('Channel name is required.'); return; }
    setSaving(true);
    try {
      const updated = await profileApi.update({ channelName, bio, avatarUrl });
      toast.success('Channel updated!');
      onSave(updated);
    } catch (err) {
      toast.error(err.message || 'Failed to update channel.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-8 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Channel</h2>
          <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Channel name <span className="text-brand-500">*</span>
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="input"
              maxLength={60}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="input resize-none"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Avatar URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="input"
            />
            <p className="text-xs text-slate-400 dark:text-gray-600 mt-1.5">Leave empty to use your account's profile picture.</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center" disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !channelName.trim()} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Channel() {
  const { userId } = useParams();
  const { user: currentUser } = useUser();
  const navigate = useNavigate();
  const isOwn = currentUser?.id === userId;

  const { profile, loading: profileLoading, error: profileError } = useChannelProfile(userId);
  const [localProfile, setLocalProfile] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (profile) setLocalProfile(profile);
  }, [profile]);

  const { videos, loading: videosLoading } = useVideoList({ uploaderId: userId, limit: 24 });

  const displayProfile = localProfile || profile;
  const avatarSrc = displayProfile?.avatarUrl || displayProfile?.clerkImageUrl;

  if (profileLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 animate-pulse space-y-6">
        <div className="h-36 bg-slate-100 dark:bg-gray-900 rounded-2xl" />
        <div className="flex items-end gap-5 -mt-12 px-6">
          <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-gray-800 ring-4 ring-white dark:ring-gray-950" />
          <div className="space-y-2 pb-2">
            <div className="h-6 bg-slate-200 dark:bg-gray-800 rounded w-40" />
            <div className="h-4 bg-slate-200 dark:bg-gray-800 rounded w-60" />
          </div>
        </div>
      </div>
    );
  }

  if (!displayProfile) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-slate-400 dark:text-gray-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No channel here yet</h2>
        <p className="text-slate-500 dark:text-gray-500 text-sm mb-6">
          {isOwn
            ? 'You haven\'t set up your channel profile yet.'
            : 'This creator hasn\'t set up their channel yet.'}
        </p>
        {isOwn ? (
          <Link to="/upload" className="btn-primary inline-flex">
            Upload a video to get started
          </Link>
        ) : (
          <Link to="/" className="btn-ghost inline-flex">← Back to Library</Link>
        )}
      </div>
    );
  }

  const handleDeleteChannel = async () => {
    try {
      await profileApi.deleteMyChannel();
      toast.success('Channel deleted.');
      navigate('/library');
    } catch (err) {
      toast.error(err.message || 'Failed to delete channel.');
      throw err;
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-slide-up">
      {showEdit && (
        <EditProfileModal
          profile={displayProfile}
          onSave={(updated) => { setLocalProfile(updated); setShowEdit(false); }}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showDelete && (
        <DeleteChannelModal
          channelName={displayProfile.channelName}
          onConfirm={handleDeleteChannel}
          onClose={() => setShowDelete(false)}
        />
      )}

      {/* Banner */}
      <div className="h-36 sm:h-44 bg-gradient-to-br from-brand-100/80 via-slate-100 to-slate-50 dark:from-brand-900/50 dark:via-gray-900 dark:to-gray-900 rounded-b-2xl" />

      {/* Profile header */}
      <div className="px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 -mt-12 sm:-mt-14">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayProfile.channelName}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white dark:ring-gray-950 shadow-xl"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center ring-4 ring-white dark:ring-gray-950 shadow-xl">
                <span className="text-white font-bold text-3xl">
                  {displayProfile.channelName?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>

          {/* Name + bio + actions */}
          <div className="flex-1 min-w-0 pb-1 sm:pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{displayProfile.channelName}</h1>
              {isOwn && (
                <>
                  <button
                    onClick={() => setShowEdit(true)}
                    className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Channel
                  </button>
                  <button
                    onClick={() => setShowDelete(true)}
                    className="text-sm px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-red-500/70 dark:text-red-400/70 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-400/10 border border-transparent hover:border-red-400/20 transition-all"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                    Delete Channel
                  </button>
                </>
              )}
            </div>

            {displayProfile.bio && (
              <p className="text-slate-500 dark:text-gray-400 text-sm mt-1.5 leading-relaxed">{displayProfile.bio}</p>
            )}

            <p className="text-xs text-slate-400 dark:text-gray-600 mt-2">
              Joined {new Date(displayProfile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              {!videosLoading && (
                <span> · {videos.length} video{videos.length !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 dark:border-gray-800/60 mx-4 sm:mx-6 mt-6 mb-8" />

      {/* Videos grid */}
      <div className="px-4 sm:px-6 pb-12">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">Videos</h2>

        {videosLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-video bg-slate-100 dark:bg-gray-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-gray-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-gray-700">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="font-medium">No videos yet</p>
            {isOwn && (
              <Link to="/upload" className="mt-4 btn-primary inline-flex text-sm">
                Upload your first video
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
