const express = require('express');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
// Port configuration with multiple options
const PORT = process.argv[2] || process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Session configuration for admin authentication
app.use(session({
  secret: 'birthday-slideshow-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'photos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate temporary filename - we'll rename it after getting guest name
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');

    const datetime = `${year}${month}${day}${hour}${minute}${second}`;
    const extension = path.extname(file.originalname);

    // Store datetime for later use
    file.datetime = datetime;

    // Use temporary filename
    const tempFilename = `temp_${datetime}_${Math.random().toString(36).substr(2, 9)}${extension}`;
    cb(null, tempFilename);
  }
});

// File filter for image types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Generate unique ID for photos
function generateUniqueId(filename) {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(6).toString('hex');
  return `photo_${timestamp}_${randomString}`;
}

// Save photo metadata
function savePhotoMetadata(filename, originalName, guestName, comment, fileSize, mimetype) {
  const uniqueId = generateUniqueId(filename);
  const now = new Date().toISOString();

  const metadata = {
    id: uniqueId,
    filename: filename,
    originalName: originalName,
    guestName: guestName || 'Anonymous',
    comment: comment || '',
    createdOn: now,
    uploadTime: now,
    size: fileSize,
    mimetype: mimetype,
    visible: true // Photos are visible by default
  };

  const metadataFilename = filename.replace(path.extname(filename), '.json');
  const metadataPath = path.join(uploadsDir, metadataFilename);

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  return metadata;
}

// Helper function to read photo metadata
function getPhotoMetadata(filename) {
  const metadataFilename = filename.replace(path.extname(filename), '.json');
  const metadataPath = path.join(uploadsDir, metadataFilename);

  try {
    if (fs.existsSync(metadataPath)) {
      const metadataContent = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(metadataContent);
    }
  } catch (error) {
    console.error(`Error reading metadata for ${filename}:`, error);
  }

  // Return default metadata if file doesn't exist or is corrupted
  return {
    id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    filename: filename,
    originalName: filename,
    guestName: 'Unknown',
    comment: '',
    createdOn: new Date().toISOString(),
    uploadTime: new Date().toISOString(),
    size: 0,
    mimetype: 'image/jpeg',
    visible: true // Default to visible
  };
}

// Routes

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes

// Get photos list with metadata
app.get('/api/photos', (req, res) => {
  try {
    const showAll = req.query.showAll === 'true'; // Admin can request all photos

    // Read all files from uploads directory
    const files = fs.readdirSync(uploadsDir);

    // Filter for image files only
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
    });

    // Get metadata for each image
    let photos = imageFiles.map(filename => {
      const metadata = getPhotoMetadata(filename);
      return {
        id: metadata.id,
        filename: metadata.filename,
        guestName: metadata.guestName,
        comment: metadata.comment,
        createdOn: metadata.createdOn,
        visible: metadata.visible !== false // Default to true if not set
      };
    });

    // Filter by visibility unless admin requests all photos
    if (!showAll) {
      photos = photos.filter(photo => photo.visible === true);
    }

    // Sort photos by creation date (newest first)
    photos.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

    res.json({
      success: true,
      photos: photos
    });

  } catch (error) {
    console.error('Error reading photos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load photos',
      photos: []
    });
  }
});

// Serve uploaded photos
app.get('/uploads/photos/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: 'Photo not found'
    });
  }

  // Set appropriate headers for image serving
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
  res.sendFile(filePath);
});

// Photo upload endpoint
app.post('/api/upload', upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Generate proper filename with guest name
    const guestName = req.body.guestName ? req.body.guestName.replace(/[^a-zA-Z0-9]/g, '') : 'guest';
    const extension = path.extname(req.file.originalname);
    const properFilename = `${req.file.datetime}${guestName}${extension}`;

    // Rename file from temp name to proper name
    const tempPath = req.file.path;
    const properPath = path.join(uploadsDir, properFilename);

    fs.renameSync(tempPath, properPath);

    // Update file object with proper filename
    req.file.filename = properFilename;
    req.file.path = properPath;

    // Save metadata
    const metadata = savePhotoMetadata(
      req.file.filename,
      req.file.originalname,
      req.body.guestName,
      req.body.comment,
      req.file.size,
      req.file.mimetype
    );

    console.log(`Photo uploaded: ${req.file.filename} by ${metadata.guestName}`);

    res.json({
      success: true,
      message: 'Photo uploaded successfully!',
      filename: req.file.filename,
      id: metadata.id
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed. Please try again.'
    });
  }
});

// Admin authentication endpoints

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Check password (hardcoded as per requirements)
    if (password === 'LucasAdmin') {
      // Set session
      req.session.isAdmin = true;
      req.session.loginTime = new Date().toISOString();

      console.log('Admin logged in successfully');

      res.json({
        success: true,
        message: 'Login successful'
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Admin logout endpoint
app.post('/api/admin/logout', (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({
          success: false,
          message: 'Logout failed'
        });
      }

      console.log('Admin logged out successfully');

      res.json({
        success: true,
        message: 'Logout successful'
      });
    });

  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed. Please try again.'
    });
  }
});

// Middleware to check admin authentication
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(401).json({
      success: false,
      message: 'Admin authentication required'
    });
  }
  next();
}

// Check admin session status
app.get('/api/admin/status', (req, res) => {
  res.json({
    success: true,
    isAuthenticated: !!req.session.isAdmin,
    loginTime: req.session.loginTime || null
  });
});

// QR Code URL management
let qrCodeUrl = `http://localhost:${PORT}/upload.html`; // Default URL

// Get current QR code URL
app.get('/api/qr-url', (req, res) => {
  res.json({
    success: true,
    url: qrCodeUrl
  });
});

// Set QR code URL (admin only)
app.post('/api/admin/qr-url', requireAdmin, (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format'
      });
    }

    qrCodeUrl = url;
    console.log(`QR Code URL updated to: ${qrCodeUrl}`);

    res.json({
      success: true,
      message: 'QR Code URL updated successfully',
      url: qrCodeUrl
    });

  } catch (error) {
    console.error('QR URL update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update QR Code URL'
    });
  }
});

// Helper function to find photo by ID
function findPhotoById(photoId) {
  try {
    const files = fs.readdirSync(uploadsDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
    });

    for (const filename of imageFiles) {
      const metadata = getPhotoMetadata(filename);
      if (metadata.id === photoId) {
        return {
          id: metadata.id,
          filename: metadata.filename,
          metadata: metadata
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding photo by ID:', error);
    return null;
  }
}

// Update photo metadata endpoint (admin only)
app.put('/api/admin/photos/:id', requireAdmin, (req, res) => {
  try {
    const photoId = req.params.id;
    const { guestName, comment } = req.body;

    if (!photoId) {
      return res.status(400).json({
        success: false,
        message: 'Photo ID is required'
      });
    }

    // Find the photo by ID
    const photo = findPhotoById(photoId);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Read current metadata
    const metadataFilename = photo.filename.replace(path.extname(photo.filename), '.json');
    const metadataPath = path.join(uploadsDir, metadataFilename);

    let metadata;
    try {
      if (fs.existsSync(metadataPath)) {
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } else {
        // Create new metadata if it doesn't exist
        metadata = {
          id: photoId,
          filename: photo.filename,
          originalName: photo.filename,
          guestName: 'Unknown',
          comment: '',
          createdOn: new Date().toISOString(),
          uploadTime: new Date().toISOString(),
          size: 0,
          mimetype: 'image/jpeg',
          visible: true
        };
      }
    } catch (error) {
      console.error('Error reading metadata:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to read photo metadata'
      });
    }

    // Update metadata with new values
    if (guestName !== undefined) {
      metadata.guestName = guestName.trim() || 'Anonymous';
    }
    if (comment !== undefined) {
      metadata.comment = comment.trim();
    }

    // Add update timestamp
    metadata.lastUpdated = new Date().toISOString();

    // Save updated metadata
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`Photo metadata updated by admin: ${photo.filename} (ID: ${photoId})`);

      res.json({
        success: true,
        message: 'Photo updated successfully',
        photo: {
          id: metadata.id,
          filename: metadata.filename,
          guestName: metadata.guestName,
          comment: metadata.comment,
          createdOn: metadata.createdOn,
          lastUpdated: metadata.lastUpdated,
          visible: metadata.visible
        }
      });

    } catch (error) {
      console.error('Error saving metadata:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save photo updates'
      });
    }

  } catch (error) {
    console.error('Photo update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update photo. Please try again.'
    });
  }
});

// Toggle photo visibility endpoint (admin only)
app.patch('/api/admin/photos/:id/visibility', requireAdmin, (req, res) => {
  try {
    const photoId = req.params.id;
    const { visible } = req.body;

    if (!photoId) {
      return res.status(400).json({
        success: false,
        message: 'Photo ID is required'
      });
    }

    if (typeof visible !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Visibility must be true or false'
      });
    }

    // Find the photo by ID
    const photo = findPhotoById(photoId);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Read current metadata
    const metadataFilename = photo.filename.replace(path.extname(photo.filename), '.json');
    const metadataPath = path.join(uploadsDir, metadataFilename);

    let metadata;
    try {
      if (fs.existsSync(metadataPath)) {
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
      } else {
        // Create new metadata if it doesn't exist
        metadata = {
          id: photoId,
          filename: photo.filename,
          originalName: photo.filename,
          guestName: 'Unknown',
          comment: '',
          createdOn: new Date().toISOString(),
          uploadTime: new Date().toISOString(),
          size: 0,
          mimetype: 'image/jpeg',
          visible: true
        };
      }
    } catch (error) {
      console.error('Error reading metadata:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to read photo metadata'
      });
    }

    // Update visibility
    metadata.visible = visible;
    metadata.lastUpdated = new Date().toISOString();

    // Save updated metadata
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`Photo visibility ${visible ? 'enabled' : 'disabled'} by admin: ${photo.filename} (ID: ${photoId})`);

      res.json({
        success: true,
        message: `Photo ${visible ? 'shown' : 'hidden'} successfully`,
        photo: {
          id: metadata.id,
          filename: metadata.filename,
          visible: metadata.visible,
          lastUpdated: metadata.lastUpdated
        }
      });

    } catch (error) {
      console.error('Error saving metadata:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update photo visibility'
      });
    }

  } catch (error) {
    console.error('Photo visibility toggle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle photo visibility. Please try again.'
    });
  }
});

// Delete photo endpoint (admin only)
app.delete('/api/admin/photos/:id', requireAdmin, (req, res) => {
  try {
    const photoId = req.params.id;

    if (!photoId) {
      return res.status(400).json({
        success: false,
        message: 'Photo ID is required'
      });
    }

    // Find the photo by ID
    const photo = findPhotoById(photoId);

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    const photoPath = path.join(uploadsDir, photo.filename);
    const metadataFilename = photo.filename.replace(path.extname(photo.filename), '.json');
    const metadataPath = path.join(uploadsDir, metadataFilename);

    // Delete photo file
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
      console.log(`Deleted photo file: ${photo.filename}`);
    }

    // Delete metadata file
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
      console.log(`Deleted metadata file: ${metadataFilename}`);
    }

    console.log(`Photo deleted by admin: ${photo.filename} (ID: ${photoId})`);

    res.json({
      success: true,
      message: 'Photo deleted successfully',
      deletedPhoto: {
        id: photo.id,
        filename: photo.filename
      }
    });

  } catch (error) {
    console.error('Photo deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete photo. Please try again.'
    });
  }
});

// Error handling middleware for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
  }

  if (error.message === 'Invalid file type. Only JPEG, PNG, and GIF are allowed.') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  res.status(500).json({
    success: false,
    message: 'An error occurred during upload.'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Birthday Photo Slideshow server started!`);
  console.log(`📡 Running on HTTP port: ${PORT}`);
  console.log(`🌐 Network access: http://0.0.0.0:${PORT}`);
  console.log(`\n📱 Access URLs:`);
  console.log(`   Slideshow: http://localhost:${PORT}`);
  console.log(`   Upload:    http://localhost:${PORT}/upload.html`);
  console.log(`   Admin:     http://localhost:${PORT}/admin.html`);
  console.log(`\n🔧 To change port: npm run start:80 or set PORT=80 && npm start`);
});
