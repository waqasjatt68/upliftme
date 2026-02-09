import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudinary Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads an image to Cloudinary
 * @param {string} imageName - JUST the filename (not full path)
 * @returns {Promise<string>} - The Cloudinary URL
 */
const uploadToCloudinary = async (imageName) => {
  try {
    // ✅ Build the full path here
    const imagePath = path.join(__dirname, '../public/temp/', imageName);

    console.log("☁️ Uploading to Cloudinary...");
    console.log("   File:", imageName);
    console.log("   Full path:", imagePath);

    // Check file exists
    await fs.access(imagePath);
    console.log("✅ File exists");

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(imagePath, {
      folder: 'upliftme/avatars',
      public_id: `avatar_${Date.now()}`,
      overwrite: true,
      resource_type: 'image',
      transformation: [
        { width: 500, height: 500, crop: 'limit' },
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    });

    console.log("✅ Uploaded successfully!");
    console.log("   URL:", uploadResult.secure_url);
    console.log("   Public ID:", uploadResult.public_id);

    // Delete temp file
    await fs.unlink(imagePath);
    console.log("🗑️ Temp file deleted");

    return uploadResult.secure_url;
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

export default uploadToCloudinary;

/**
 * Deletes an image from Cloudinary
 * @param {string} imageUrl - The Cloudinary URL
 */
export const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
      console.log("⚠️ Not a Cloudinary URL, skipping");
      return { result: 'ok' };
    }

    console.log("🗑️ Deleting from Cloudinary:", imageUrl);

    // Extract public_id from URL
    // Example: https://res.cloudinary.com/demo/image/upload/v123/upliftme/avatars/avatar_123.jpg
    const urlParts = imageUrl.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    
    if (uploadIndex === -1) {
      throw new Error('Invalid Cloudinary URL');
    }

    // Get path after upload/v123/
    let pathAfterUpload = urlParts.slice(uploadIndex + 2).join('/');
    
    // Remove extension
    const publicId = pathAfterUpload.substring(0, pathAfterUpload.lastIndexOf('.'));
    
    console.log("   Public ID:", publicId);

    // Delete
    const result = await cloudinary.uploader.destroy(publicId);
    console.log("✅ Deleted:", result);

    return result;
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error.message);
    throw error;
  }
};