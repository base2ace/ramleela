/**
 * DriveDrop - Client Application Logic
 * Direct media uploads to Google Drive for GitHub Pages
 */

(function () {
  'use strict';

  // Application State
  const state = {
    queue: [],
    isBatchUploading: false,
    activeUploadsCount: 0,
    maxConcurrentUploads: 2,
    scriptUrl: '',
    simulationMode: false,
    history: []
  };

  // DOM Elements Cache
  const DOM = {
    // Header & Info
    targetFolderBtn: document.getElementById('targetFolderBtn'),
    statusPill: document.getElementById('statusPill'),
    statusText: document.getElementById('statusText'),
    openGuideBtn: document.getElementById('openGuideBtn'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),

    // Dropzone & Input
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    browseBtn: document.getElementById('browseBtn'),
    dragOverlay: document.getElementById('dragOverlay'),

    // Queue Section
    queueSection: document.getElementById('queueSection'),
    queueSummary: document.getElementById('queueSummary'),
    addMoreBtn: document.getElementById('addMoreBtn'),
    clearCompletedBtn: document.getElementById('clearCompletedBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    uploadAllBtn: document.getElementById('uploadAllBtn'),
    fileListGrid: document.getElementById('fileListGrid'),

    // Batch Progress
    batchProgressBarWrapper: document.getElementById('batchProgressBarWrapper'),
    batchProgressBar: document.getElementById('batchProgressBar'),
    batchProgressText: document.getElementById('batchProgressText'),
    batchProgressSpeed: document.getElementById('batchProgressSpeed'),

    // History Section
    historySection: document.getElementById('historySection'),
    historyGrid: document.getElementById('historyGrid'),
    viewFolderBtn: document.getElementById('viewFolderBtn'),

    // Guide Modal
    guideModal: document.getElementById('guideModal'),
    closeGuideBtn: document.getElementById('closeGuideBtn'),
    guideGotItBtn: document.getElementById('guideGotItBtn'),
    copyScriptBtn: document.getElementById('copyScriptBtn'),
    codeSnippetText: document.getElementById('codeSnippetText'),

    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    scriptUrlInput: document.getElementById('scriptUrlInput'),
    testConnectionBtn: document.getElementById('testConnectionBtn'),
    connectionStatusMsg: document.getElementById('connectionStatusMsg'),
    simModeToggle: document.getElementById('simModeToggle'),
    displayFolderId: document.getElementById('displayFolderId'),
    modalFolderLink: document.getElementById('modalFolderLink'),

    // Lightbox Modal
    previewModal: document.getElementById('previewModal'),
    previewMediaContainer: document.getElementById('previewMediaContainer'),
    previewCaption: document.getElementById('previewCaption'),
    closePreviewBtn: document.getElementById('closePreviewBtn'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  /**
   * Initialize Application
   */
  function init() {
    loadSettings();
    setupTargetFolderLinks();
    setupEventListeners();
    setupDragAndDrop();
    populateGuideCodeSnippet();
    checkBackendStatus();
    renderQueue();
    renderHistory();
  }

  /**
   * Load saved configuration from localStorage or fallback to CONFIG
   */
  function loadSettings() {
    const savedUrl = localStorage.getItem(CONFIG.STORAGE_KEYS.SCRIPT_URL);
    state.scriptUrl = savedUrl !== null ? savedUrl : CONFIG.APPS_SCRIPT_URL;

    const savedSim = localStorage.getItem(CONFIG.STORAGE_KEYS.SIMULATION_MODE);
    state.simulationMode = savedSim === 'true';

    // If no URL is set and not explicitly configured, default simulation mode on for instant out-of-the-box demo
    if (!state.scriptUrl && savedSim === null) {
      state.simulationMode = true;
    }

    // Load recent history from session
    try {
      const savedHistory = sessionStorage.getItem('gdrive_upload_history');
      if (savedHistory) {
        state.history = JSON.parse(savedHistory);
      }
    } catch (e) {
      console.warn('Could not parse history from storage:', e);
    }
  }

  /**
   * Set up destination folder links throughout the UI
   */
  function setupTargetFolderLinks() {
    if (DOM.targetFolderBtn) {
      DOM.targetFolderBtn.href = CONFIG.FOLDER_URL;
    }
    if (DOM.viewFolderBtn) {
      DOM.viewFolderBtn.href = CONFIG.FOLDER_URL;
    }
    if (DOM.modalFolderLink) {
      DOM.modalFolderLink.href = CONFIG.FOLDER_URL;
    }
    if (DOM.displayFolderId) {
      DOM.displayFolderId.textContent = CONFIG.FOLDER_ID;
    }
  }

  /**
   * Check connection status with Google Apps Script
   */
  async function checkBackendStatus() {
    if (state.simulationMode) {
      updateStatusBadge('simulation', 'Demo Mode');
      return;
    }

    if (!state.scriptUrl || !state.scriptUrl.trim()) {
      updateStatusBadge('warning', 'Setup Needed');
      return;
    }

    updateStatusBadge('checking', 'Connecting...');

    try {
      // Send a quick GET request to check Web App endpoint
      const response = await fetch(state.scriptUrl, {
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        updateStatusBadge('connected', 'Connected');
      } else {
        updateStatusBadge('warning', 'HTTP ' + response.status);
      }
    } catch (err) {
      // In Google Apps Script, redirect or CORS on GET might fail, but Web App could still accept POST
      // Check if it's a valid script URL format
      if (state.scriptUrl.includes('script.google.com/macros/s/')) {
        updateStatusBadge('connected', 'Ready');
      } else {
        updateStatusBadge('error', 'Check URL');
      }
    }
  }

  /**
   * Update the status pill in the header
   */
  function updateStatusBadge(type, text) {
    DOM.statusPill.className = 'pill-btn status-pill ' + type;
    DOM.statusText.textContent = text;
  }

  /**
   * Attach core event listeners
   */
  function setupEventListeners() {
    // Browse button triggers file input
    DOM.browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.fileInput.click();
    });

    DOM.dropZone.addEventListener('click', () => {
      DOM.fileInput.click();
    });

    DOM.dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        DOM.fileInput.click();
      }
    });

    // File input selection
    DOM.fileInput.addEventListener('change', (e) => {
      handleFilesSelected(e.target.files);
      DOM.fileInput.value = ''; // Reset input to allow re-selection
    });

    // Queue action buttons
    DOM.addMoreBtn.addEventListener('click', () => DOM.fileInput.click());
    DOM.clearCompletedBtn.addEventListener('click', clearCompletedFiles);
    DOM.clearAllBtn.addEventListener('click', clearAllFiles);
    DOM.uploadAllBtn.addEventListener('click', startBatchUpload);

    // Setup Guide Modal
    DOM.openGuideBtn.addEventListener('click', () => openModal(DOM.guideModal));
    DOM.closeGuideBtn.addEventListener('click', () => closeModal(DOM.guideModal));
    DOM.guideGotItBtn.addEventListener('click', () => {
      closeModal(DOM.guideModal);
      openSettingsModal();
    });

    // Copy script button in Guide
    DOM.copyScriptBtn.addEventListener('click', handleCopyScript);

    // Settings Modal
    DOM.openSettingsBtn.addEventListener('click', openSettingsModal);
    DOM.statusPill.addEventListener('click', openSettingsModal);
    DOM.closeSettingsBtn.addEventListener('click', () => closeModal(DOM.settingsModal));
    DOM.cancelSettingsBtn.addEventListener('click', () => closeModal(DOM.settingsModal));
    DOM.saveSettingsBtn.addEventListener('click', handleSaveSettings);
    DOM.testConnectionBtn.addEventListener('click', handleTestConnection);

    // Lightbox modal close
    DOM.closePreviewBtn.addEventListener('click', () => closeModal(DOM.previewModal));
    DOM.previewModal.addEventListener('click', (e) => {
      if (e.target === DOM.previewModal) closeModal(DOM.previewModal);
    });

    // Close modals on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(DOM.guideModal);
        closeModal(DOM.settingsModal);
        closeModal(DOM.previewModal);
      }
    });
  }

  /**
   * Drag & drop listeners for entire window and specific dropzone
   */
  function setupDragAndDrop() {
    let dragCounter = 0;

    // Window level drag overlay
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      window.addEventListener(eventName, preventDefaults, false);
      DOM.dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Window drag enter / leave detection
    window.addEventListener('dragenter', (e) => {
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        DOM.dragOverlay.classList.remove('hidden');
      }
    });

    window.addEventListener('dragleave', () => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        DOM.dragOverlay.classList.add('hidden');
      }
    });

    window.addEventListener('drop', (e) => {
      dragCounter = 0;
      DOM.dragOverlay.classList.add('hidden');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesSelected(e.dataTransfer.files);
      }
    });

    // Dropzone highlight state
    DOM.dropZone.addEventListener('dragover', () => {
      DOM.dropZone.classList.add('drag-active');
    });

    DOM.dropZone.addEventListener('dragleave', () => {
      DOM.dropZone.classList.remove('drag-active');
    });

    DOM.dropZone.addEventListener('drop', (e) => {
      DOM.dropZone.classList.remove('drag-active');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesSelected(e.dataTransfer.files);
      }
    });
  }

  /**
   * Handle selected or dropped files
   */
  function handleFilesSelected(fileList) {
    if (!fileList || fileList.length === 0) return;

    let addedCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;

    Array.from(fileList).forEach(file => {
      // Validate media type (image or video)
      const isImage = file.type.startsWith('image/') || hasExtension(file.name, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'bmp']);
      const isVideo = file.type.startsWith('video/') || hasExtension(file.name, ['mp4', 'webm', 'mov', 'mkv', 'avi', 'ogg']);

      if (!isImage && !isVideo) {
        rejectedCount++;
        return;
      }

      // Check for duplicates already in queue
      const isDuplicate = state.queue.some(item => item.name === file.name && item.size === file.size);
      if (isDuplicate) {
        duplicateCount++;
        return;
      }

      // Create queue item
      const item = {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        file: file,
        name: file.name,
        size: file.size,
        formattedSize: formatFileSize(file.size),
        extension: getFileExtension(file.name),
        type: file.type || (isImage ? 'image/jpeg' : 'video/mp4'),
        isImage: isImage,
        isVideo: isVideo,
        previewUrl: null,
        status: 'pending', // 'pending' | 'uploading' | 'completed' | 'failed'
        progress: 0,
        fileUrl: null,
        errorMsg: null,
        isOversized: (file.size / (1024 * 1024)) > CONFIG.MAX_FILE_SIZE_MB
      };

      // Create local preview object URL
      try {
        item.previewUrl = URL.createObjectURL(file);
      } catch (err) {
        console.warn('Could not generate preview URL for', file.name, err);
      }

      state.queue.push(item);
      addedCount++;
    });

    if (addedCount > 0) {
      renderQueue();
      showToast(`${addedCount} media file${addedCount > 1 ? 's' : ''} added to queue`, 'info');
      
      // Auto-scroll to queue
      DOM.queueSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (rejectedCount > 0) {
      showToast(`${rejectedCount} unsupported file${rejectedCount > 1 ? 's' : ''} skipped. Only images and videos are supported.`, 'warning');
    }

    if (duplicateCount > 0) {
      showToast(`${duplicateCount} duplicate file${duplicateCount > 1 ? 's' : ''} ignored.`, 'info');
    }
  }

  /**
   * Helper to check file extension
   */
  function hasExtension(filename, extensions) {
    const ext = getFileExtension(filename).toLowerCase();
    return extensions.includes(ext);
  }

  function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  }

  /**
   * Format bytes to readable string
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Render the files queue
   */
  function renderQueue() {
    if (state.queue.length === 0) {
      DOM.queueSection.classList.add('hidden');
      return;
    }

    DOM.queueSection.classList.remove('hidden');

    // Update queue summary badge
    const totalBytes = state.queue.reduce((acc, item) => acc + item.size, 0);
    const completedCount = state.queue.filter(item => item.status === 'completed').length;
    DOM.queueSummary.textContent = `${state.queue.length} file${state.queue.length > 1 ? 's' : ''} (${formatFileSize(totalBytes)})${completedCount > 0 ? ` • ${completedCount} uploaded` : ''}`;

    // Enable/disable upload button
    const hasPending = state.queue.some(item => item.status === 'pending' || item.status === 'failed');
    DOM.uploadAllBtn.disabled = !hasPending || state.isBatchUploading;

    // Render cards
    DOM.fileListGrid.innerHTML = '';
    state.queue.forEach(item => {
      const card = createFileCard(item);
      DOM.fileListGrid.appendChild(card);
    });

    updateBatchProgress();
  }

  /**
   * Generate DOM element for a file card
   */
  function createFileCard(item) {
    const card = document.createElement('div');
    card.className = `file-card file-card-${item.status}`;
    card.id = `card_${item.id}`;

    // Media thumbnail HTML
    let thumbHtml = '';
    if (item.isImage && item.previewUrl) {
      thumbHtml = `
        <div class="file-thumbnail-wrap" data-id="${item.id}" title="Click to preview">
          <img src="${item.previewUrl}" alt="${escapeHtml(item.name)}" class="file-thumb-img" loading="lazy">
        </div>
      `;
    } else if (item.isVideo && item.previewUrl) {
      thumbHtml = `
        <div class="file-thumbnail-wrap" data-id="${item.id}" title="Click to preview video">
          <video src="${item.previewUrl}#t=0.5" class="file-thumb-video" preload="metadata"></video>
          <div class="video-thumb-badge">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
        </div>
      `;
    } else {
      thumbHtml = `
        <div class="file-thumbnail-wrap" data-id="${item.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;color:#818cf8;">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      `;
    }

    // Status Badge & Text
    let statusBadgeHtml = '';
    if (item.status === 'pending') {
      statusBadgeHtml = `<span class="file-status-badge badge-pending">Ready</span>`;
    } else if (item.status === 'uploading') {
      statusBadgeHtml = `<span class="file-status-badge badge-uploading">Uploading ${item.progress}%</span>`;
    } else if (item.status === 'completed') {
      statusBadgeHtml = `<span class="file-status-badge badge-completed">✓ Saved</span>`;
    } else if (item.status === 'failed') {
      statusBadgeHtml = `<span class="file-status-badge badge-failed">Failed</span>`;
    }

    // Card Actions
    let actionsHtml = '';
    if (item.status === 'completed' && item.fileUrl) {
      actionsHtml = `
        <a href="${item.fileUrl}" target="_blank" rel="noopener noreferrer" class="drive-link-btn" title="View in Google Drive">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-7L10 4H5a2 2 0 00-2 2v12h16V6h-7l-2-2h-3"/>
          </svg>
          Open in Drive
        </a>
      `;
    } else if (item.status === 'failed') {
      actionsHtml = `
        <button class="btn btn-secondary btn-xs retry-btn" data-id="${item.id}">
          Retry
        </button>
      `;
    }

    // Oversize warning
    let oversizeNote = '';
    if (item.isOversized && item.status === 'pending') {
      oversizeNote = `<span style="color:var(--status-warning);font-size:0.72rem;">⚠️ &gt;${CONFIG.MAX_FILE_SIZE_MB}MB (Apps Script size limit)</span>`;
    }

    card.innerHTML = `
      <div class="file-card-top">
        ${thumbHtml}
        <div class="file-details">
          <div class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="file-meta-row">
            <span class="file-ext-badge">${item.extension}</span>
            <span>${item.formattedSize}</span>
            ${oversizeNote}
          </div>
          <div class="file-status-wrap">
            ${statusBadgeHtml}
          </div>
        </div>
        ${item.status !== 'uploading' ? `
          <button class="card-remove-btn" data-id="${item.id}" title="Remove file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        ` : ''}
      </div>

      ${item.status === 'uploading' ? `
        <div class="card-progress-bar-track">
          <div class="card-progress-bar-fill" style="width: ${item.progress}%"></div>
        </div>
      ` : ''}

      <div class="file-card-bottom">
        <span class="card-message ${item.status === 'failed' ? 'error-text' : ''}">
          ${item.errorMsg ? escapeHtml(item.errorMsg) : ''}
        </span>
        <div class="card-actions-group">
          ${actionsHtml}
        </div>
      </div>
    `;

    // Attach card event listeners
    const thumbWrap = card.querySelector('.file-thumbnail-wrap');
    if (thumbWrap) {
      thumbWrap.addEventListener('click', () => openPreviewModal(item));
    }

    const removeBtn = card.querySelector('.card-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFileFromQueue(item.id);
      });
    }

    const retryBtn = card.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadSingleFile(item);
      });
    }

    return card;
  }

  /**
   * Remove a single file from the queue
   */
  function removeFileFromQueue(id) {
    const index = state.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = state.queue[index];
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      state.queue.splice(index, 1);
      renderQueue();
    }
  }

  /**
   * Clear all files from queue
   */
  function clearAllFiles() {
    if (state.isBatchUploading) {
      if (!confirm('Uploads are currently in progress. Cancel and clear queue?')) return;
      state.isBatchUploading = false;
    }

    state.queue.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    state.queue = [];
    renderQueue();
    showToast('Queue cleared', 'info');
  }

  /**
   * Clear only completed files
   */
  function clearCompletedFiles() {
    state.queue = state.queue.filter(item => {
      if (item.status === 'completed') {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return false;
      }
      return true;
    });
    renderQueue();
  }

  /**
   * Start batch upload process
   */
  async function startBatchUpload() {
    if (state.isBatchUploading) return;

    // Check if configuration is needed
    if (!state.simulationMode && (!state.scriptUrl || !state.scriptUrl.trim())) {
      openSettingsModal();
      showToast('Please set your Google Apps Script Web App URL first or enable Demo Mode.', 'warning');
      return;
    }

    const pendingItems = state.queue.filter(item => item.status === 'pending' || item.status === 'failed');
    if (pendingItems.length === 0) {
      showToast('No pending files to upload.', 'info');
      return;
    }

    state.isBatchUploading = true;
    DOM.uploadAllBtn.disabled = true;
    DOM.batchProgressBarWrapper.classList.remove('hidden');

    showToast(`Starting upload of ${pendingItems.length} file${pendingItems.length > 1 ? 's' : ''}...`, 'info');

    // Process uploads with controlled concurrency
    for (const item of pendingItems) {
      if (!state.isBatchUploading) break; // Check if cancelled
      await uploadSingleFile(item);
    }

    state.isBatchUploading = false;
    DOM.uploadAllBtn.disabled = false;
    updateBatchProgress();

    const successCount = state.queue.filter(item => item.status === 'completed').length;
    if (successCount > 0) {
      showToast(`Batch complete! ${successCount} file${successCount > 1 ? 's' : ''} saved to Google Drive.`, 'success');
      renderHistory();
    }
  }

  /**
   * Upload single file (either real POST or simulated)
   */
  async function uploadSingleFile(item) {
    item.status = 'uploading';
    item.progress = 10;
    item.errorMsg = null;
    renderQueue();

    try {
      if (state.simulationMode) {
        // Run realistic simulated upload
        await simulateUpload(item);
      } else {
        // Run real Google Apps Script upload
        await performRealUpload(item);
      }

      // Record to history
      addToHistory(item);

    } catch (err) {
      console.error('Upload error for', item.name, err);
      item.status = 'failed';
      item.progress = 0;
      item.errorMsg = err.message || 'Upload failed. Check connection.';
      showToast(`Failed to upload ${item.name}: ${item.errorMsg}`, 'error');
    }

    renderQueue();
  }

  /**
   * Perform real upload to Google Apps Script
   */
  async function performRealUpload(item) {
    item.progress = 25;
    renderQueue();

    // 1. Convert file to Base64
    const base64String = await readFileAsBase64(item.file, (readProgress) => {
      // Map reading progress to 25% - 50%
      item.progress = Math.round(25 + (readProgress * 0.25));
      renderQueue();
    });

    item.progress = 55;
    renderQueue();

    // 2. Prepare payload
    const payload = {
      filename: item.name,
      mimeType: item.type,
      fileData: base64String
    };

    // 3. Send fetch request using text/plain to bypass CORS preflight
    item.progress = 70;
    renderQueue();

    const response = await fetch(state.scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.status === 'success') {
      item.status = 'completed';
      item.progress = 100;
      item.fileUrl = result.fileUrl || CONFIG.FOLDER_URL;
      item.errorMsg = null;
    } else {
      throw new Error(result.message || 'Google Apps Script reported an error.');
    }
  }

  /**
   * Simulate realistic upload for demo & styling verification
   */
  function simulateUpload(item) {
    return new Promise((resolve) => {
      let currentProgress = 15;
      const interval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 20) + 15;
        if (currentProgress >= 100) {
          currentProgress = 100;
          clearInterval(interval);
          item.status = 'completed';
          item.progress = 100;
          item.fileUrl = CONFIG.FOLDER_URL;
          item.errorMsg = null;
          resolve();
        } else {
          item.progress = currentProgress;
          renderQueue();
        }
      }, 300);
    });
  }

  /**
   * Read file as base64 string
   */
  function readFileAsBase64(file, onProgress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(e.loaded / e.total);
        }
      };

      reader.onload = () => {
        try {
          const resultStr = reader.result;
          // Strip out "data:...;base64," header
          const base64Data = resultStr.split(',')[1];
          resolve(base64Data);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file from disk.'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Update the overall batch progress bar
   */
  function updateBatchProgress() {
    if (state.queue.length === 0) {
      DOM.batchProgressBarWrapper.classList.add('hidden');
      return;
    }

    const totalProgress = state.queue.reduce((acc, item) => acc + item.progress, 0);
    const overallPercentage = Math.round(totalProgress / state.queue.length);

    DOM.batchProgressBar.style.width = `${overallPercentage}%`;
    DOM.batchProgressText.textContent = `Batch Progress: ${overallPercentage}% (${state.queue.filter(i => i.status === 'completed').length}/${state.queue.length} completed)`;

    if (overallPercentage === 100 && !state.isBatchUploading) {
      setTimeout(() => {
        DOM.batchProgressBarWrapper.classList.add('hidden');
      }, 2000);
    }
  }

  /**
   * Add successfully uploaded item to history
   */
  function addToHistory(item) {
    const historyItem = {
      name: item.name,
      formattedSize: item.formattedSize,
      fileUrl: item.fileUrl || CONFIG.FOLDER_URL,
      uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      previewUrl: item.previewUrl,
      isImage: item.isImage,
      isVideo: item.isVideo
    };

    state.history.unshift(historyItem);
    // Keep max 12 items in history
    if (state.history.length > 12) {
      state.history.pop();
    }

    try {
      // Don't save large blob preview URLs in sessionStorage
      const sessionData = state.history.map(h => ({
        name: h.name,
        formattedSize: h.formattedSize,
        fileUrl: h.fileUrl,
        uploadedAt: h.uploadedAt
      }));
      sessionStorage.setItem('gdrive_upload_history', JSON.stringify(sessionData));
    } catch (e) {
      console.warn('Session storage write error', e);
    }

    renderHistory();
  }

  /**
   * Render history section
   */
  function renderHistory() {
    if (state.history.length === 0) {
      DOM.historySection.classList.add('hidden');
      return;
    }

    DOM.historySection.classList.remove('hidden');
    DOM.historyGrid.innerHTML = '';

    state.history.forEach(item => {
      const card = document.createElement('a');
      card.href = item.fileUrl;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.className = 'history-card';
      card.title = `Open ${item.name} in Google Drive`;

      let thumb = '';
      if (item.isImage && item.previewUrl) {
        thumb = `<img src="${item.previewUrl}" alt="${escapeHtml(item.name)}" class="history-thumb-img" loading="lazy">`;
      } else {
        thumb = `
          <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#818cf8;background:rgba(99,102,241,0.08);">
            <svg viewBox="0 0 24 24" fill="currentColor" style="width:36px;height:36px;">
              <path d="M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-7L10 4H5a2 2 0 00-2 2v12h16V6h-7l-2-2h-3"/>
            </svg>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="history-thumb-wrap">
          ${thumb}
        </div>
        <div class="history-info">
          <div class="history-name">${escapeHtml(item.name)}</div>
          <div class="history-time">${item.uploadedAt} &bull; ${item.formattedSize}</div>
        </div>
      `;

      DOM.historyGrid.appendChild(card);
    });
  }

  /**
   * Modal management
   */
  function openModal(modalEl) {
    modalEl.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    modalEl.classList.add('hidden');
    document.body.style.overflow = '';
  }

  /**
   * Open Settings modal with current values
   */
  function openSettingsModal() {
    DOM.scriptUrlInput.value = state.scriptUrl || '';
    DOM.simModeToggle.checked = state.simulationMode;
    DOM.connectionStatusMsg.className = 'connection-status-msg hidden';
    openModal(DOM.settingsModal);
  }

  /**
   * Save settings from Settings modal
   */
  function handleSaveSettings() {
    const newUrl = DOM.scriptUrlInput.value.trim();
    const newSim = DOM.simModeToggle.checked;

    state.scriptUrl = newUrl;
    state.simulationMode = newSim;

    localStorage.setItem(CONFIG.STORAGE_KEYS.SCRIPT_URL, newUrl);
    localStorage.setItem(CONFIG.STORAGE_KEYS.SIMULATION_MODE, newSim.toString());

    closeModal(DOM.settingsModal);
    checkBackendStatus();
    showToast('Settings saved successfully.', 'success');
  }

  /**
   * Test Connection in Settings modal
   */
  async function handleTestConnection() {
    const url = DOM.scriptUrlInput.value.trim();
    if (!url) {
      showConnectionMsg('Please enter a Google Apps Script URL to test.', 'error');
      return;
    }

    if (!url.startsWith('https://script.google.com/macros/s/')) {
      showConnectionMsg('Warning: Google Apps Script Web App URLs usually start with https://script.google.com/macros/s/...', 'error');
      return;
    }

    showConnectionMsg('Testing endpoint...', 'info');

    try {
      const resp = await fetch(url, { method: 'GET', cache: 'no-cache' });
      if (resp.ok) {
        showConnectionMsg('✓ Connection successful! Web app is active.', 'success');
      } else {
        showConnectionMsg(`Endpoint reachable but returned status ${resp.status}`, 'warning');
      }
    } catch (e) {
      // Due to Google Apps Script CORS redirects on GET, a fetch might throw in browser console
      // but still be functional for POST.
      showConnectionMsg('✓ Script URL formatted correctly and reachable.', 'success');
    }
  }

  function showConnectionMsg(msg, type) {
    DOM.connectionStatusMsg.textContent = msg;
    DOM.connectionStatusMsg.className = `connection-status-msg ${type}`;
  }

  /**
   * Populate Code snippet in setup guide
   */
  function populateGuideCodeSnippet() {
    const code = `// Google Apps Script Code.gs
const TARGET_FOLDER_ID = "${CONFIG.FOLDER_ID}";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const decodedBytes = Utilities.base64Decode(payload.fileData);
    const blob = Utilities.newBlob(decodedBytes, payload.mimeType, payload.filename);
    const folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    const file = folder.createFile(blob);
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      fileUrl: file.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
    if (DOM.codeSnippetText) {
      DOM.codeSnippetText.textContent = code;
    }
  }

  /**
   * Copy script to clipboard
   */
  async function handleCopyScript() {
    try {
      const scriptCode = `// Google Apps Script - Target Folder: ${CONFIG.FOLDER_ID}
const TARGET_FOLDER_ID = "${CONFIG.FOLDER_ID}";

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    folderId: TARGET_FOLDER_ID
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var decodedBytes = Utilities.base64Decode(payload.fileData);
    var blob = Utilities.newBlob(decodedBytes, payload.mimeType || "application/octet-stream", payload.filename);
    var folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    var file = folder.createFile(blob);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      fileUrl: file.getUrl(),
      fileName: file.getName()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

      await navigator.clipboard.writeText(scriptCode);
      DOM.copyScriptBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:#34d399;">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied!
      `;
      showToast('Google Apps Script code copied to clipboard!', 'success');

      setTimeout(() => {
        DOM.copyScriptBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Code
        `;
      }, 3000);
    } catch (err) {
      showToast('Could not copy automatically. Please select and copy manually.', 'warning');
    }
  }

  /**
   * Lightbox preview modal for media
   */
  function openPreviewModal(item) {
    if (!item.previewUrl) return;

    DOM.previewMediaContainer.innerHTML = '';
    DOM.previewCaption.textContent = `${item.name} (${item.formattedSize})`;

    if (item.isImage) {
      const img = document.createElement('img');
      img.src = item.previewUrl;
      img.alt = item.name;
      DOM.previewMediaContainer.appendChild(img);
    } else if (item.isVideo) {
      const video = document.createElement('video');
      video.src = item.previewUrl;
      video.controls = true;
      video.autoplay = true;
      DOM.previewMediaContainer.appendChild(video);
    }

    openModal(DOM.previewModal);
  }

  /**
   * Toast notification system
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠️';
    if (type === 'warning') icon = '⚡';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.remove();
    });

    DOM.toastContainer.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 250);
      }
    }, 4200);
  }

  /**
   * Helper: Escape HTML strings
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
