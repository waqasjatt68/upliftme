import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudinary Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads an image from local storage to Cloudinary.
 * param {string} imageName - The name of the image file in ../public/temp/
 * returns {Promise<string>} - The Cloudinary URL of the uploaded image.
 */
const uploadToCloudinary = async (imageName) => {
  try {
    const imagePath = path.join(__dirname, '../public/temp/', imageName);

    // Check file exists
    await fs.access(imagePath);

    const uploadResult = await cloudinary.uploader.upload(imagePath, {
      folder: 'upliftme/avatars',
      public_id: `avatar_${Date.now()}`, // ✅ FORCE NEW FILE
      overwrite: true,
      resource_type: 'image'
    });

    // delete temp file
    await fs.unlink(imagePath);

    return uploadResult.secure_url;
  } catch (error) {
    throw error;
  }
};

export default uploadToCloudinary;

export const deleteFromCloudinary = async (imageUrl) => {
    try {
        if (!imageUrl) {
            throw new Error('Image URL is required.');
        }

        // 1. Extract public_id from the URL
        const urlParts = imageUrl.split('/');
        const fileNameWithExtension = urlParts[urlParts.length - 1]; // e.g., "abc-123.jpg"
        
        // Remove only the last extension (.jpg, .png, etc)
        const publicIdWithoutExtension = fileNameWithExtension.substring(0, fileNameWithExtension.lastIndexOf('.'));

        // Optional: If uploaded inside folder (like "upliftme/temp")
        const folderPath = 'upliftme/temp'; 
        const publicId = `${folderPath}/${publicIdWithoutExtension}`;

        console.log(`Deleting from Cloudinary public_id: ${publicId}`);
        
        // 2. Call Cloudinary delete API
        const result = await cloudinary.uploader.destroy(publicId);

        console.log(result);
        return result;

    } catch (error) {
        console.error('Cloudinary Delete Error:', error.message);
        throw error;
    }
};
