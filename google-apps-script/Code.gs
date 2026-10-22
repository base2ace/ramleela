/**
 * Google Apps Script - Media Upload Handler for Google Drive
 * Target Folder: https://drive.google.com/drive/folders/14PdF8W3hTww5C1u5gMsl7Z62RHhD8qQt (RUBY_RAMLEELA)
 * Supports files up to 100MB via chunked resumable uploads
 */

// Your target Google Drive folder ID (Ruby Ramleela)
const TARGET_FOLDER_ID = "14PdF8W3hTww5C1u5gMsl7Z62RHhD8qQt";

/**
 * Handles HTTP GET requests - used for ping/health check
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Ruby Ramleela upload service is active.",
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

    const payload = JSON.parse(e.postData.contents);

    // =========================================================================
    // 1. Chunked Resumable Upload - Step A: Initialize Session
    // =========================================================================
    if (payload.action === "init_resumable") {
      const initUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";
      const metadata = {
        name: payload.filename,
        mimeType: payload.mimeType || "application/octet-stream",
        parents: [TARGET_FOLDER_ID],
        description: "Uploaded via DriveDrop on " + new Date().toLocaleString()
      };

      const initResponse = UrlFetchApp.fetch(initUrl, {
        method: "post",
        contentType: "application/json",
        headers: {
          Authorization: "Bearer " + ScriptApp.getOAuthToken()
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true
      });

      const responseCode = initResponse.getResponseCode();
      if (responseCode !== 200 && responseCode !== 201) {
        throw new Error("Failed to initialize resumable session: " + initResponse.getContentText());
      }

      const headers = initResponse.getHeaders();
      const sessionUrl = headers["Location"] || headers["location"];
      if (!sessionUrl) {
        throw new Error("Google Drive API did not return session URL.");
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "session_ready",
        sessionUrl: sessionUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 2. Chunked Resumable Upload - Step B: Upload Chunk
    // =========================================================================
    if (payload.action === "upload_chunk") {
      const chunkBytes = Utilities.base64Decode(payload.chunkData);
      const sessionUrl = payload.sessionUrl;
      const range = payload.range; // e.g. "bytes 0-8388607/104857600"

      const chunkResponse = UrlFetchApp.fetch(sessionUrl, {
        method: "put",
        headers: {
          "Content-Range": range
        },
        payload: chunkBytes,
        muteHttpExceptions: true
      });

      const statusCode = chunkResponse.getResponseCode();

      // HTTP 308 (Resume Incomplete) = chunk successfully stored by Google Drive
      if (statusCode === 308) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "chunk_received",
          statusCode: 308
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // HTTP 200 / 201 = all chunks received and file is assembled!
      if (statusCode === 200 || statusCode === 201) {
        const fileInfo = JSON.parse(chunkResponse.getContentText());
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          fileId: fileInfo.id,
          fileName: fileInfo.name,
          fileUrl: "https://drive.google.com/file/d/" + fileInfo.id + "/view"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      throw new Error("Chunk transfer failed (" + statusCode + "): " + chunkResponse.getContentText());
    }

    // =========================================================================
    // 3. Direct Single Upload (for files <= 25MB)
    // =========================================================================
    const filename = payload.filename;
    const mimeType = payload.mimeType || "application/octet-stream";
    const base64Data = payload.fileData;

    if (!filename || !base64Data) {
      throw new Error("Missing required file parameters: 'filename' or 'fileData'.");
    }

    const targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    if (!targetFolder) {
      throw new Error("Target folder not found. Please verify the folder ID.");
    }

    const decodedBytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedBytes, mimeType, filename);
    const createdFile = targetFolder.createFile(blob);

    createdFile.setDescription("Uploaded from mobile on " + new Date().toLocaleString());

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      fileId: createdFile.getId(),
      fileName: createdFile.getName(),
      fileUrl: createdFile.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error in doPost: " + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString() || "Unknown error occurred during file upload."
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
