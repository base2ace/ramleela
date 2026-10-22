/**
 * DriveDrop - Mobile Photo & Video Uploader
 * Zero-configuration direct upload interface for smartphones
 */

(function () {
  'use strict';

  // Application State
  const state = {
    queue: [],
    isUploading: false,
    uploadedCount: 0
  };

  // DOM Elements
  const DOM = {
    // Hidden native file input
    fileInput: document.getElementById('mobileFileInput'),

    // Views
    emptyState: document.getElementById('emptyState'),
    queueState: document.getElementById('queueState'),
    successState: document.getElementById('successState'),

    // Touch Trigger Cards & Buttons
    selectMediaBtn: document.getElementById('selectMediaBtn'),
    addMoreMediaBtn: document.getElementById('addMoreMediaBtn'),
    clearQueueBtn: document.getElementById('clearQueueBtn'),
    uploadMoreBtn: document.getElementById('uploadMoreBtn'),

    // Queue Elements
    queueCountText: document.getElementById('queueCountText'),
    queueTotalSizeText: document.getElementById('queueTotalSizeText'),
    mediaGrid: document.getElementById('mediaGrid'),

    // Sticky Bottom Bar
    stickyBottomBar: document.getElementById('stickyBottomBar'),
    startUploadBtn: document.getElementById('startUploadBtn'),
    uploadBtnText: document.getElementById('uploadBtnText'),
    uploadProgressContainer: document.getElementById('uploadProgressContainer'),
    progressStatusText: document.getElementById('progressStatusText'),
    progressPercentageText: document.getElementById('progressPercentageText'),
    progressFill: document.getElementById('progressFill'),

    // Success Screen
    successMessage: document.getElementById('successMessage'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  /**
   * Initialize App
   */
  function init() {
    setupEventListeners();
    renderViewState();
  }

  /**
   * Attach Touch & Click Listeners
   */
  function setupEventListeners() {
    // Primary "Tap to Select" button
    DOM.selectMediaBtn.addEventListener('click', () => {
      DOM.fileInput.click();
    });

    // "Add More" row
    DOM.addMoreMediaBtn.addEventListener('click', () => {
      DOM.fileInput.click();
    });

    // Native file input selection (triggers iOS / Android Camera & Library sheet)
    DOM.fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      DOM.fileInput.value = ''; // Reset input to permit re-selection
    });

    // Clear queue button
    DOM.clearQueueBtn.addEventListener('click', clearQueue);

    // Primary sticky "Upload [N] Files" button
    DOM.startUploadBtn.addEventListener('click', startUpload);

    // "Upload More" button on Success screen
    DOM.uploadMoreBtn.addEventListener('click', () => {
      clearQueue();
      DOM.fileInput.click();
    });
  }

  /**
   * Handle selected files from phone picker
   */
  function handleFiles(files) {
    if (!files || files.length === 0) return;

    let addedCount = 0;
    let rejectedCount = 0;
    let oversizedCount = 0;
    const maxSizeBytes = CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024;

    Array.from(files).forEach(file => {
      const isImage = file.type.startsWith('image/') || hasExtension(file.name, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp']);
      const isVideo = file.type.startsWith('video/') || hasExtension(file.name, ['mp4', 'webm', 'mov', 'mkv', 'avi']);

      if (!isImage && !isVideo) {
        rejectedCount++;
        return;
      }

      if (file.size > maxSizeBytes) {
        oversizedCount++;
        return;
      }

      // Check duplicates
      const isDuplicate = state.queue.some(item => item.name === file.name && item.size === file.size);
      if (isDuplicate) return;

      const item = {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        file: file,
        name: file.name,
        size: file.size,
        formattedSize: formatFileSize(file.size),
        isImage: isImage,
        isVideo: isVideo,
        previewUrl: null,
        status: 'pending', // 'pending' | 'uploading' | 'completed' | 'failed'
        progress: 0
      };

      try {
        item.previewUrl = URL.createObjectURL(file);
      } catch (e) {
        console.warn('Could not create preview for', file.name, e);
      }

      state.queue.push(item);
      addedCount++;
    });

    if (addedCount > 0) {
      renderViewState();
      renderMediaGrid();
      showToast(`${addedCount} file${addedCount > 1 ? 's' : ''} added`, 'info');
    }

    if (rejectedCount > 0) {
      showToast('Please select only photos and videos.', 'warning');
    }

    if (oversizedCount > 0) {
      showToast(`Files over ${CONFIG.MAX_FILE_SIZE_MB}MB cannot be uploaded.`, 'warning');
    }
  }

  /**
   * Render View State (Empty vs Queue vs Success)
   */
  function renderViewState() {
    if (state.isUploading) {
      DOM.emptyState.classList.add('hidden');
      DOM.queueState.classList.remove('hidden');
      DOM.successState.classList.add('hidden');
      DOM.stickyBottomBar.classList.remove('hidden');
      DOM.startUploadBtn.classList.add('hidden');
      DOM.uploadProgressContainer.classList.remove('hidden');
      return;
    }

    if (state.queue.length === 0) {
      // Show Empty view
      DOM.emptyState.classList.remove('hidden');
      DOM.queueState.classList.add('hidden');
      DOM.successState.classList.add('hidden');
      DOM.stickyBottomBar.classList.add('hidden');
      return;
    }

    // Show Queue view
    DOM.emptyState.classList.add('hidden');
    DOM.queueState.classList.remove('hidden');
    DOM.successState.classList.add('hidden');
    DOM.stickyBottomBar.classList.remove('hidden');
    DOM.startUploadBtn.classList.remove('hidden');
    DOM.uploadProgressContainer.classList.add('hidden');

    // Update counts & sizes
    const totalBytes = state.queue.reduce((acc, item) => acc + item.size, 0);
    const count = state.queue.length;
    DOM.queueCountText.textContent = `${count} ${count === 1 ? 'File' : 'Files'} Selected`;
    DOM.queueTotalSizeText.textContent = `${formatFileSize(totalBytes)} total`;
    DOM.uploadBtnText.textContent = `Upload ${count} ${count === 1 ? 'File' : 'Files'}`;
  }

  /**
   * Render 2-Column Mobile Media Grid
   */
  function renderMediaGrid() {
    DOM.mediaGrid.innerHTML = '';

    state.queue.forEach(item => {
      const card = document.createElement('div');
      card.className = 'media-item-card';
      card.id = `card_${item.id}`;

      let mediaHtml = '';
      if (item.isImage && item.previewUrl) {
        mediaHtml = `<img src="${item.previewUrl}" alt="${escapeHtml(item.name)}" loading="lazy">`;
      } else if (item.isVideo && item.previewUrl) {
        mediaHtml = `
          <video src="${item.previewUrl}#t=0.5" preload="metadata"></video>
          <div class="media-video-badge">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            VIDEO
          </div>
        `;
      } else {
        mediaHtml = `
          <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#818cf8;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        `;
      }

      card.innerHTML = `
        ${mediaHtml}
        ${!state.isUploading ? `
          <button type="button" class="media-remove-btn" data-id="${item.id}" aria-label="Remove file">✕</button>
        ` : ''}
        <div class="media-meta-overlay">
          <span class="media-size-text">${item.formattedSize}</span>
        </div>
      `;

      // Remove listener
      const removeBtn = card.querySelector('.media-remove-btn');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeFile(item.id);
        });
      }

      DOM.mediaGrid.appendChild(card);
    });
  }

  /**
   * Remove single file from queue
   */
  function removeFile(id) {
    const index = state.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = state.queue[index];
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      state.queue.splice(index, 1);
      renderViewState();
      renderMediaGrid();
    }
  }

  /**
   * Clear all files in queue
   */
  function clearQueue() {
    state.queue.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    state.queue = [];
    state.isUploading = false;
    renderViewState();
  }

  /**
   * Start Upload Process
   */
  async function startUpload() {
    if (state.queue.length === 0 || state.isUploading) return;

    if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.trim() === "") {
      showToast("Cannot upload: Google Apps Script URL not configured in config.js.", "error");
      alert("To upload directly to your Google Drive folder (1pS3g7wmOS0ZjxPx61zy3lOjLNDG2AACz), paste your deployed Web App URL into 'js/config.js'.");
      return;
    }

    state.isUploading = true;
    renderViewState();

    const totalFiles = state.queue.length;
    let completed = 0;

    for (let i = 0; i < state.queue.length; i++) {
      const item = state.queue[i];
      DOM.progressStatusText.textContent = `Uploading ${i + 1} of ${totalFiles}...`;

      try {
        await uploadToGoogleDrive(item, (p) => {
          const overall = Math.round(((i + p) / totalFiles) * 100);
          updateProgress(overall);
        });
        item.status = 'completed';
        completed++;
      } catch (err) {
        console.error('Upload error for', item.name, err);
        showToast(`Could not upload ${item.name}: ${err.message}`, 'error');
      }
    }

    state.isUploading = false;
    updateProgress(100);

    if (completed > 0) {
      setTimeout(() => {
        showSuccessView(completed);
      }, 400);
    } else {
      renderViewState();
    }
  }

  /**
   * Send file to Google Drive (direct for <=25MB, chunked resumable for >25MB up to 100MB)
   */
  async function uploadToGoogleDrive(item, onProgress) {
    const CHUNKED_THRESHOLD = 25 * 1024 * 1024; // 25 MB

    if (item.file.size > CHUNKED_THRESHOLD) {
      await uploadLargeFileInChunks(item, onProgress);
    } else {
      await uploadSmallFileDirect(item, onProgress);
    }
  }

  /**
   * Direct single-request upload for files under 25MB
   */
  async function uploadSmallFileDirect(item, onProgress) {
    onProgress(0.2);

    const base64Data = await readBlobAsBase64(item.file);
    onProgress(0.5);

    const payload = {
      filename: item.name,
      mimeType: item.type || (item.isImage ? 'image/jpeg' : 'video/mp4'),
      fileData: base64Data
    };

    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Upload failed (${response.status})`);
    }

    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.message || 'Server reported an error.');
    }

    onProgress(1.0);
  }

  /**
   * Chunked resumable upload for files > 25MB up to 100MB
   */
  async function uploadLargeFileInChunks(item, onProgress) {
    onProgress(0.05);

    // 1. Initialize Resumable Upload Session
    const initPayload = {
      action: 'init_resumable',
      filename: item.name,
      mimeType: item.type || (item.isImage ? 'image/jpeg' : 'video/mp4')
    };

    const initResp = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(initPayload)
    });

    if (!initResp.ok) {
      throw new Error(`Could not initiate upload session (${initResp.status})`);
    }

    const initData = await initResp.json();
    if (initData.status !== 'session_ready' || !initData.sessionUrl) {
      throw new Error(initData.message || 'Google Drive session URL not received.');
    }

    const sessionUrl = initData.sessionUrl;
    const totalSize = item.file.size;
    // 8 MB chunk size (exact multiple of 256 KiB)
    const CHUNK_SIZE = 8 * 1024 * 1024;
    let startByte = 0;

    // 2. Upload chunks sequentially
    while (startByte < totalSize) {
      const endByte = Math.min(startByte + CHUNK_SIZE, totalSize);
      const chunkBlob = item.file.slice(startByte, endByte);
      const chunkBase64 = await readBlobAsBase64(chunkBlob);

      const chunkPayload = {
        action: 'upload_chunk',
        sessionUrl: sessionUrl,
        range: `bytes ${startByte}-${endByte - 1}/${totalSize}`,
        chunkData: chunkBase64
      };

      let retries = 3;
      let chunkSuccess = false;
      let lastError = null;

      while (retries > 0 && !chunkSuccess) {
        try {
          const chunkResp = await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(chunkPayload)
          });

          if (!chunkResp.ok) {
            throw new Error(`Chunk transfer failed (${chunkResp.status})`);
          }

          const chunkResult = await chunkResp.json();

          if (chunkResult.status === 'chunk_received' || chunkResult.status === 'success') {
            chunkSuccess = true;
          } else {
            throw new Error(chunkResult.message || 'Chunk transfer error');
          }
        } catch (e) {
          lastError = e;
          retries--;
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      }

      if (!chunkSuccess) {
        throw new Error(lastError ? lastError.message : 'Chunk transfer failed after multiple attempts.');
      }

      startByte = endByte;
      const progressFraction = Math.min(0.98, startByte / totalSize);
      onProgress(progressFraction);
    }

    onProgress(1.0);
  }

  /**
   * Helper to convert Blob or slice to Base64
   */
  function readBlobAsBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('File slice read failed'));
      reader.readAsDataURL(blob);
    });
  }



  /**
   * Update Progress Bar UI
   */
  function updateProgress(percentage) {
    DOM.progressPercentageText.textContent = `${percentage}%`;
    DOM.progressFill.style.width = `${percentage}%`;
  }

  /**
   * Show Success Screen
   */
  function showSuccessView(count) {
    DOM.emptyState.classList.add('hidden');
    DOM.queueState.classList.add('hidden');
    DOM.successState.classList.remove('hidden');
    DOM.stickyBottomBar.classList.add('hidden');

    DOM.successMessage.textContent = `${count} ${count === 1 ? 'file has' : 'files have'} been uploaded directly to Google Drive.`;
    showToast('Upload Complete! 🎉', 'success');
  }

  /**
   * Helpers
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function hasExtension(filename, extensions) {
    const ext = filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
    return extensions.includes(ext);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `mobile-toast toast-${type}`;
    toast.textContent = message;

    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
  }

  // Run on ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
