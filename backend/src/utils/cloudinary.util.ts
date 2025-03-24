import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import path from 'path';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_SECRET_KEY
});

// Define storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    let folder = 'damps';
    
    // Determine folder based on the route or file type
    if (req.originalUrl.includes('/register/customer') || req.originalUrl.includes('profile-image')) {
      folder = 'damps/profiles';
    } else if (req.originalUrl.includes('/register/vendor') || req.originalUrl.includes('business-logo')) {
      folder = 'damps/businesses';
    } else if (req.originalUrl.includes('/register/driver')) {
      folder = 'damps/driver-documents';
    } else if (req.originalUrl.includes('/parts')) {
      folder = 'damps/parts';
    } else if (file.mimetype.startsWith('image')) {
      folder = 'damps/images';
    } else {
      folder = 'damps/documents';
    }
    
    return {
      folder: folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'],
      public_id: `${Date.now()}-${path.basename(file.originalname, path.extname(file.originalname))}`
    };
  }
});

// Create multer upload instance
export const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept images, PDFs, DOCs
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

/**
 * Uploads a file to Cloudinary
 * @param file File to upload
 * @returns URL of the uploaded file
 */
export async function uploadToCloudinary(file?: Express.Multer.File): Promise<string> {
  if (!file) {
    throw new Error('No file provided');
  }
  
  try {
    // For multer with CloudinaryStorage, the file already has a path property
    // with the Cloudinary URL, so we just need to return it
    return file.path;
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`File upload failed: ${error.message || 'Unknown error'}`);
  }
}