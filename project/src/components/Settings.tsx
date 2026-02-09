import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, User, Code } from 'lucide-react';
import { useSessionStore } from '../store/session';
import { toast } from 'sonner';

interface Profile {
  username: string;
  bio: string;
  avatar_url: string;
}

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'developer'>('profile');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { isDevelopment, toggleDevelopmentMode } = useSessionStore();

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadProfile = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/user/me', {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to load profile');

      const data = await res.json();
      
      setProfile({
          username: data.userName || data.username || '',
          bio: data.profile?.bio || '',
          avatar_url: data.profile?.avatar || '', // ✅ CORRECT - Use data.profile.avatar
        });
    } catch (err) {
      console.error('Error loading profile:', err);
      toast.error('Failed to load profile');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("username", profile.username);
      formData.append("bio", profile.bio);

      // ✅ CRITICAL: Append the actual File object, not the blob URL!
      if (avatarFile) {
        formData.append("file", avatarFile);
        console.log("📸 Uploading file:", avatarFile.name);
      }

      console.log("📤 Updating profile...");

      const res = await fetch("http://localhost:4000/api/user/createProfile", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Update failed");
      }

      const data = await res.json();
      console.log("✅ Profile updated:", data);

      // Update profile with new data
      if (data.user || data.profile) {
        setProfile({
          username: data.user?.userName || data.user?.username || profile.username,
          bio: data.user?.bio || data.profile?.bio || profile.bio,
          avatar_url: data.user?.avatar || data.profile?.avatar || profile.avatar_url,
        });
      }

      // Clear file and preview
      setAvatarFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      toast.success("Profile updated successfully! 🎉");

      // Reload profile from server
      setTimeout(() => loadProfile(), 1000);

    } catch (error: any) {
      console.error("❌ Error:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    console.log("📸 Image selected:", file.name);

    // Clean up old preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    // Create preview
    const newPreviewUrl = URL.createObjectURL(file);
    
    setAvatarFile(file);
    setPreviewUrl(newPreviewUrl);

    toast.success('Image selected. Click "Save Changes" to upload.');
  };

  const tabs = [
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      content: profile && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold mb-6 dark:text-white">Edit Profile</h3>

          <form onSubmit={handleProfileUpdate} className="space-y-6">
            {/* Avatar */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border-2 border-gray-300">
                  {(previewUrl || profile.avatar_url) ? (
                    <img
                      src={previewUrl || profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Camera className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>

                <label className="absolute bottom-0 right-0 bg-purple-500 rounded-full p-2 cursor-pointer hover:bg-purple-600 transition shadow-lg">
                  <Upload className="w-4 h-4 text-white" />
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </label>
              </div>
            </div>

            {/* Selected file info */}
            {avatarFile && (
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Selected: <span className="font-medium">{avatarFile.name}</span>
                </p>
                <p className="text-xs text-gray-500">
                  ({(avatarFile.size / 1024).toFixed(2)} KB)
                </p>
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Username
              </label>
              <input
                type="text"
                value={profile.username}
                onChange={e => setProfile({ ...profile, username: e.target.value })}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                Bio
              </label>
              <textarea
                value={profile.bio}
                onChange={e => setProfile({ ...profile, bio: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none focus:ring-2 focus:ring-purple-500"
                placeholder="Tell us about yourself..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      ),
    },
    {
      id: 'developer',
      label: 'Developer',
      icon: Code,
      content: (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold dark:text-white">Developer Mode</h3>
            </div>
            <button
              onClick={toggleDevelopmentMode}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                isDevelopment 
                  ? 'bg-purple-500 text-white hover:bg-purple-600' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300'
              }`}
            >
              {isDevelopment ? 'Disable' : 'Enable'}
            </button>
          </div>

          {isDevelopment && (
            <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                🎉 Developer mode unlocks all features for testing.
              </p>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-8 dark:text-white">Settings</h2>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                activeTab === tab.id
                  ? 'bg-purple-500 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1">
          {tabs.find(t => t.id === activeTab)?.content}
        </div>
      </div>
    </div>
  );
};

export default Settings;