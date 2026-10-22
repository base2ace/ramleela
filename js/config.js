/**
 * Client Configuration for Google Drive Upload Web App
 */
const CONFIG = {
  // Target Google Drive Folder details (Ruby Ramleela)
  FOLDER_ID: "14PdF8W3hTww5C1u5gMsl7Z62RHhD8qQt",
  FOLDER_URL: "https://drive.google.com/drive/folders/14PdF8W3hTww5C1u5gMsl7Z62RHhD8qQt?usp=sharing",
  EVENT_NAME: "Ruby Ramleela",

  // Google Apps Script Web App Deployment URL
  // You can set it here or configure it in the web app settings modal (saved to localStorage)
  APPS_SCRIPT_URL: "",

  // Maximum recommended file size for Apps Script uploads (in Megabytes)
  // Apps Script has a payload limit (~50MB), so 45MB is a safe cap.
  MAX_FILE_SIZE_MB: 45,

  // Allowed file extensions and MIME patterns
  ALLOWED_IMAGE_TYPES: [
    "image/jpeg", "image/png", "image/gif", "image/webp", 
    "image/svg+xml", "image/bmp", "image/heic", "image/heif"
  ],
  ALLOWED_VIDEO_TYPES: [
    "video/mp4", "video/webm", "video/quicktime", 
    "video/x-msvideo", "video/x-matroska", "video/ogg"
  ],

  // Storage key for local settings
  STORAGE_KEYS: {
    SCRIPT_URL: "gdrive_uploader_script_url",
    SIMULATION_MODE: "gdrive_uploader_simulation_mode",
    THEME: "gdrive_uploader_theme"
  }
};
