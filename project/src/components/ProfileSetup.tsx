import React, { useState } from "react";
import { Camera, Upload } from "lucide-react";
import imageCompression from 'browser-image-compression';

interface ProfileSetupProps {
  role: "hero" | "uplifter";
  onComplete: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ role, onComplete }) => {
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(""); // Image preview URL
  const [selectedFile, setSelectedFile] = useState<File | null>(null); // File object
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  
// Utility function to convert base64 string to File object
function base64ToFile(base64Data: string, filename: string): File {
    const arr = base64Data.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch?.[1] ?? 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}


const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];

  if (!file) {
      console.warn('No file selected.');
      return;
  }

  if (!file.type.startsWith('image/')) {
      console.warn('Selected file is not an image.');
      return;
  }

  try {
      let processedFile = file;

      // If using FileReader to get base64 and convert back (optional step if needed)
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64String = reader.result;
          if (typeof base64String !== 'string') return;
          const convertedFile = base64ToFile(base64String, file.name || 'camera.jpg');

          // Compress the file
          const compressedFile = await imageCompression(convertedFile, {
              maxSizeMB: 1,            // Compress to ~1MB or less
              maxWidthOrHeight: 1024,  // Resize dimensions if needed
              useWebWorker: true,
          });

          setSelectedFile(compressedFile);
          setAvatarUrl(URL.createObjectURL(compressedFile));

          console.log('Original size:', convertedFile.size / 1024, 'KB');
          console.log('Compressed size:', compressedFile.size / 1024, 'KB');
      };

      reader.readAsDataURL(processedFile);

  } catch (error) {
      console.error('Error processing image:', error);
  }
};

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create FormData object
      const formData = new FormData();
      formData.append("username", username);
      formData.append("bio", bio);
      formData.append("role", role);
      if (selectedFile) {
        formData.append("file", selectedFile); // Attach the image file
      }
      
      const response = await fetch("http://localhost:4000/api/user/createProfile", {
        method: "POST",
        body: formData,
        credentials: "include"
        // Send as FormData  
      });
      
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      onComplete(); // Call onComplete after success
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="max-w-md w-full space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold">Complete Your Profile</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {role === "hero"
            ? "Tell us a bit about yourself to find the right Uplifters"
            : "Share your story to connect with Heroes who need your support"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar Upload */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-12 h-12 text-gray-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-purple-500 rounded-full p-2 cursor-pointer">
              <Upload className="w-4 h-4 text-white" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Username Field */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
          />
        </div>

        {/* Bio Field */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder={
              role === "hero"
                ? "What kind of motivation are you looking for?"
                : "How do you like to motivate and support others?"
            }
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Saving..." : "Complete Profile"}
        </button>
      </form>
    </div>
  );
};

export default ProfileSetup;
