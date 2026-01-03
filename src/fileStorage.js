/**
 * File-based persistent storage module using IndexedDB.
 * Stores per-file settings including animation preferences,
 * optional focus distance override, and compressed preview images.
 * Uses file name as key for retrieval across sessions.
 */

/** Database name */
const DB_NAME = 'sharp-viewer-storage';

/** Database version */
const DB_VERSION = 1;

/** Object store name */
const STORE_NAME = 'file-settings';

/** Maximum preview image dimension (width or height) */
const MAX_PREVIEW_DIMENSION = 400;

/** JPEG quality for preview compression (0-1) */
const PREVIEW_QUALITY = 0.6;

/**
 * File settings schema.
 * @typedef {Object} FileSettings
 * @property {string} fileName - Original file name (used as key)
 * @property {number} version - Schema version for migration
 * @property {number} lastModified - Timestamp of last update
 * @property {AnimationSettings} [animation] - Load animation preferences
 * @property {number} [focusDistance] - Optional user-set focus distance override
 * @property {string} [preview] - Compressed preview image data URL
 */

/**
 * Animation settings schema (extensible for future additions).
 * @typedef {Object} AnimationSettings
 * @property {boolean} enabled - Whether animation is enabled
 * @property {string} intensity - 'subtle' | 'medium' | 'dramatic'
 * @property {string} direction - 'left' | 'right' | 'up' | 'down' | 'none'
 * @property {number} [duration] - Animation duration override in ms
 * @property {string} [easing] - Easing function override
 */

/** Current schema version */
const SCHEMA_VERSION = 1;

/** Database instance cache */
let dbInstance = null;

/**
 * Opens or creates the IndexedDB database.
 * @returns {Promise<IDBDatabase>} Database instance
 */
const openDatabase = () => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object store with fileName as key
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'fileName' });
        objectStore.createIndex('lastModified', 'lastModified', { unique: false });
      }
    };
  });
};

/**
 * Compresses an image data URL for storage.
 * Resizes if needed and applies JPEG compression.
 * @param {string} dataUrl - Original image data URL
 * @returns {Promise<string>} Compressed data URL
 */
const compressPreviewImage = (dataUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Calculate dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > MAX_PREVIEW_DIMENSION || height > MAX_PREVIEW_DIMENSION) {
        if (width > height) {
          height = (height / width) * MAX_PREVIEW_DIMENSION;
          width = MAX_PREVIEW_DIMENSION;
        } else {
          width = (width / height) * MAX_PREVIEW_DIMENSION;
          height = MAX_PREVIEW_DIMENSION;
        }
      }

      // Draw to canvas and compress
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL('image/jpeg', PREVIEW_QUALITY);
      resolve(compressed);
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
};

/**
 * Loads settings for a file from IndexedDB.
 * @param {string} fileName - File name to load settings for
 * @returns {Promise<FileSettings|null>} Settings object or null if not found
 */
export const loadFileSettings = async (fileName) => {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(fileName);

      request.onsuccess = () => {
        const settings = request.result;
        
        if (!settings) {
          resolve(null);
          return;
        }

        // Validate schema version
        if (settings.version !== SCHEMA_VERSION) {
          console.warn(`Settings for ${fileName} have outdated schema version ${settings.version}, ignoring`);
          resolve(null);
          return;
        }

        resolve(settings);
      };

      request.onerror = () => {
        reject(new Error(`Failed to load settings for ${fileName}`));
      };
    });
  } catch (error) {
    console.error(`Failed to load settings for ${fileName}:`, error);
    return null;
  }
};

/**
 * Saves settings for a file to IndexedDB.
 * @param {string} fileName - File name to save settings for
 * @param {Partial<FileSettings>} settings - Settings to save (merged with existing)
 * @returns {Promise<boolean>} Success status
 */
export const saveFileSettings = async (fileName, settings) => {
  try {
    const db = await openDatabase();

    // Load existing settings
    const existing = await loadFileSettings(fileName) || {
      fileName,
      version: SCHEMA_VERSION,
      lastModified: Date.now(),
    };

    // Compress preview image if provided
    if (settings.preview && settings.preview.startsWith('data:image')) {
      settings.preview = await compressPreviewImage(settings.preview);
    }

    // Merge with existing
    const updated = {
      ...existing,
      ...settings,
      fileName, // Ensure key is present
      lastModified: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(updated);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error(`Failed to save settings for ${fileName}`));
    });
  } catch (error) {
    console.error(`Failed to save settings for ${fileName}:`, error);
    return false;
  }
};

/**
 * Saves animation preferences for a file.
 * @param {string} fileName - File name
 * @param {AnimationSettings} animation - Animation settings
 * @returns {Promise<boolean>} Success status
 */
export const saveAnimationSettings = async (fileName, animation) => {
  return await saveFileSettings(fileName, { animation });
};

/**
 * Saves focus distance override for a file.
 * @param {string} fileName - File name
 * @param {number} focusDistance - Focus distance in units
 * @returns {Promise<boolean>} Success status
 */
export const saveFocusDistance = async (fileName, focusDistance) => {
  return await saveFileSettings(fileName, { focusDistance });
};

/**
 * Saves preview image for a file.
 * @param {string} fileName - File name
 * @param {string} previewDataUrl - Preview image data URL
 * @returns {Promise<boolean>} Success status
 */
export const savePreviewImage = async (fileName, previewDataUrl) => {
  return await saveFileSettings(fileName, { preview: previewDataUrl });
};

/**
 * Clears focus distance override for a file.
 * @param {string} fileName - File name
 * @returns {Promise<boolean>} Success status
 */
export const clearFocusDistance = async (fileName) => {
  try {
    const existing = await loadFileSettings(fileName);
    if (existing && existing.focusDistance !== undefined) {
      delete existing.focusDistance;
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(existing);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(new Error(`Failed to clear focus distance for ${fileName}`));
      });
    }
    return true;
  } catch (error) {
    console.error(`Failed to clear focus distance for ${fileName}:`, error);
    return false;
  }
};

/**
 * Deletes all settings for a file.
 * @param {string} fileName - File name
 * @returns {Promise<boolean>} Success status
 */
export const deleteFileSettings = async (fileName) => {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(fileName);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error(`Failed to delete settings for ${fileName}`));
    });
  } catch (error) {
    console.error(`Failed to delete settings for ${fileName}:`, error);
    return false;
  }
};

/**
 * Lists all stored file names.
 * @returns {Promise<string[]>} Array of file names with stored settings
 */
export const listStoredFiles = async () => {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to list stored files'));
    });
  } catch (error) {
    console.error('Failed to list stored files:', error);
    return [];
  }
};

/**
 * Clears all stored file settings.
 * @returns {Promise<number>} Number of entries deleted
 */
export const clearAllFileSettings = async () => {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Get count before clearing
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        const count = countRequest.result;
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => resolve(count);
        clearRequest.onerror = () => reject(new Error('Failed to clear settings'));
      };
      
      countRequest.onerror = () => reject(new Error('Failed to count settings'));
    });
  } catch (error) {
    console.error('Failed to clear all settings:', error);
    return 0;
  }
};
