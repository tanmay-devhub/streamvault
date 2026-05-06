import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { profileApi } from '../services/api';

export default function ProfileSetupModal({ onComplete }) {
  const { user } = useUser();
  const defaultName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '';

  const [channelName, setChannelName] = useState(defaultName);
  const [bio, setBio]                 = useState('');
  const [avatarUrl, setAvatarUrl]     = useState('');
  const [saving, setSaving]           = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) { toast.error('Channel name is required.'); return; }
    setSaving(true);
    try {
      const profile = await profileApi.create({ channelName: channelName.trim(), bio, avatarUrl });
      toast.success('Channel created!');
      onComplete(profile);
    } catch (err) {
      toast.error(err.message || 'Failed to create channel.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md">
      <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-8 shadow-2xl animate-scale-in">

        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 dark:bg-brand-500/15 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-brand-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Set up your channel</h2>
          <p className="text-slate-500 dark:text-gray-500 text-sm mt-1">Create a channel profile so viewers can learn about you.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
              Channel name <span className="text-brand-500">*</span>
            </label>
            <input type="text" value={channelName} onChange={(e) => setChannelName(e.target.value)}
              placeholder="My Awesome Channel" className="input" maxLength={60} autoFocus/>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
              Bio <span className="text-slate-400 dark:text-gray-600">(optional)</span>
            </label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)}
              placeholder="Tell viewers about your channel…" rows={3}
              className="input resize-none" maxLength={500}/>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
              Avatar URL <span className="text-slate-400 dark:text-gray-600">(optional)</span>
            </label>
            <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg" className="input"/>
            <p className="text-xs text-slate-400 dark:text-gray-600 mt-1.5">Leave empty to use your account picture.</p>
          </div>

          {(channelName || avatarUrl || user?.imageUrl) && (
            <div className="card-inset p-4 flex items-center gap-3">
              <img src={avatarUrl || user?.imageUrl || ''} alt="" onError={(e) => { e.target.style.display = 'none'; }}
                className="w-10 h-10 rounded-full object-cover bg-slate-200 dark:bg-gray-700 flex-shrink-0"/>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">{channelName || 'Your Channel'}</p>
                {bio && <p className="text-xs text-slate-400 dark:text-gray-500 truncate mt-0.5">{bio}</p>}
              </div>
            </div>
          )}

          <button type="submit" disabled={saving || !channelName.trim()} className="btn-primary w-full justify-center py-3">
            {saving ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Creating…</>
            ) : 'Create Channel'}
          </button>
        </form>
      </div>
    </div>
  );
}
