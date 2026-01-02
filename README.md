# Birthday Photo Slideshow

A local web application for birthday party photo sharing and slideshow, designed to run on a Raspberry Pi.

## Features

- QR code access for easy photo uploads from mobile devices
- Guest photo uploads with name and comments
- Automatic slideshow with 10-second transitions
- Admin interface for photo management
- Local storage - no internet required
- Mobile-responsive design

## Installation

1. Make sure you have Node.js installed on your Raspberry Pi
2. Clone or download this project
3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the server:
   ```bash
   npm start
   ```
   
2. The application will be available at:
   - Main slideshow: `http://[your-pi-ip]:3000`
   - Photo upload: `http://[your-pi-ip]:3000/upload.html`
   - Admin panel: `http://[your-pi-ip]:3000/admin.html`

3. Find your Raspberry Pi's IP address:
   ```bash
   hostname -I
   ```

## Usage

### For Guests
1. Scan the QR code displayed on the slideshow screen
2. Upload photos with your name and a comment
3. Watch your photos appear in the slideshow!

### For Admin
1. Go to `/admin.html`
2. Enter password: `LucasAdmin`
3. Manage uploaded photos (view and delete)

## Development Mode

For development with auto-restart (requires nodemon):
```bash
npm install -g nodemon
npm run dev
```

## File Structure

```
birthday-photo-slideshow/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── README.md             # This file
├── public/               # Static web files
│   ├── index.html       # Slideshow interface
│   ├── upload.html      # Photo upload interface
│   ├── admin.html       # Admin interface
│   ├── css/
│   │   └── styles.css   # Application styles
│   └── js/
│       ├── slideshow.js # Slideshow functionality
│       ├── upload.js    # Upload handling
│       └── admin.js     # Admin functionality
└── uploads/
    └── photos/          # Uploaded photos storage
```

## Technical Details

- **Backend**: Node.js with Express.js
- **Frontend**: HTML5, CSS3, jQuery
- **File Upload**: Multer middleware
- **Authentication**: Express sessions
- **Storage**: Local filesystem

## Troubleshooting

- Make sure port 3000 is available
- Check that the `uploads/photos` directory has write permissions
- Ensure your device is connected to the same network as the Raspberry Pi
- For QR code issues, verify the IP address is correct

## Admin Password

Default admin password: `youradminpass`
