/**
 * Google Apps Script - Media Upload Handler for Google Drive
 * Target Folder: https://drive.google.com/drive/folders/14PdF8W3hTww5C1u5gMsl7Z62RHhD8qQt (RUBY_RAMLEELA)
 */

// Your target Google Drive folder ID (Ruby Ramleela)
const TARGET_FOLDER_ID = "14PdF8W3hTww5C1u5gMsl7Z62RHhD8qQt";

/**
 * Handles HTTP GET requests - used for ping/health check
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Google Drive Upload Web App is running smoothly.",
    folderId: TARGET_FOLDER_ID,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles HTTP POST requests - uploads media to the Drive folder
 * Receives JSON payload sent as text/plain to prevent CORS preflight issues on GitHub Pages
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No data payload received in request.");
    }

    // Parse the incoming JSON payload
    const payload = JSON.parse(e.postData.contents);
    const filename = payload.filename;
    const mimeType = payload.mimeType || "application/octet-stream";
    const base64Data = payload.fileData;

    if (!filename || !base64Data) {
      throw new Error("Missing required file parameters: 'filename' or 'fileData'.");
    }

    // Get the destination folder in Google Drive
    const targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    if (!targetFolder) {
      throw new Error("Target folder not found. Please verify the folder ID.");
    }

    // Convert base64 data to blob
    const decodedBytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedBytes, mimeType, filename);

    // Create file inside the destination folder
    const createdFile = targetFolder.createFile(blob);

    // Set file description with upload timestamp
    createdFile.setDescription("Uploaded via Web Upload Portal on " + new Date().toLocaleString());

    // Prepare response
    const result = {
      status: "success",
      message: "File successfully uploaded to Google Drive.",
      fileId: createdFile.getId(),
      fileName: createdFile.getName(),
      fileUrl: createdFile.getUrl(),
      downloadUrl: createdFile.getDownloadUrl(),
      size: createdFile.getSize(),
      uploadedAt: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error in doPost: " + error.toString());
    const errorResult = {
      status: "error",
      message: error.toString() || "Unknown error occurred during file upload."
    };

    return ContentService.createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
