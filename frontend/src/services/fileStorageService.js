import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * File Storage Service
 * Handles file validation, Firebase Storage uploads, attachment metadata generation,
 * and deletion of workspace chat attachments.
 */

// File size limits in bytes
const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,    // 10 MB
  document: 25 * 1024 * 1024, // 25 MB
  code: 25 * 1024 * 1024,     // 25 MB
  archive: 50 * 1024 * 1024,  // 50 MB
  default: 25 * 1024 * 1024,  // 25 MB
};

// Prohibited executable extensions
const PROHIBITED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'vbs', 'js', 'mjs', 'jar', 'apk', 'app', 'scr', 'msi', 'com', 'pif'
];

export const fileStorageService = {
  /**
   * Validate file type, extension, size, and security prohibitions.
   */
  validateFile: (file) => {
    if (!file) {
      return { valid: false, error: 'No file selected.' };
    }

    const filename = file.name || '';
    const parts = filename.split('.');
    const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';

    if (PROHIBITED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `Executable files (.${ext}) are not permitted for security reasons.`,
      };
    }

    // Determine category type
    let type = 'file';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      type = 'image';
    } else if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) {
      type = 'document';
    } else if (['json', 'csv', 'xml', 'log'].includes(ext)) {
      type = 'code';
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      type = 'archive';
    }

    const maxLimit = SIZE_LIMITS[type] || SIZE_LIMITS.default;
    if (file.size > maxLimit) {
      const maxMb = Math.round(maxLimit / (1024 * 1024));
      return {
        valid: false,
        error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum ${maxMb} MB limit for ${type}s.`,
      };
    }

    return {
      valid: true,
      type,
      extension: ext,
    };
  },

  /**
   * Format bytes into human-readable string (e.g. 1.2 MB, 450 KB).
   */
  formatFileSize: (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  /**
   * Upload file to Firebase Storage.
   * Path: workspaces/{workspaceId}/chat/attachments/{messageId}/{filename}
   */
  uploadFile: async (workspaceId, messageId, file, user, onProgress = () => {}) => {
    const validation = fileStorageService.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const cleanFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `workspaces/${workspaceId}/chat/attachments/${messageId}/${cleanFilename}`;

    try {
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(Math.round(progress));
          },
          (error) => {
            console.error('[fileStorageService] Firebase Storage upload error:', error);
            // Fallback for local demo environment if Firebase Storage rules block upload
            fileStorageService.fallbackBase64Upload(file, validation, user, storagePath)
              .then(resolve)
              .catch(reject);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              const attachment = {
                fileId: `${messageId}_${Date.now()}`,
                type: validation.type,
                filename: file.name,
                extension: validation.extension,
                size: file.size,
                downloadURL,
                storagePath,
                uploadedAt: Date.now(),
                uploadedBy: user.uid,
              };
              resolve(attachment);
            } catch (err) {
              reject(err);
            }
          }
        );
      });
    } catch (err) {
      console.warn('[fileStorageService] Upload fallback activated:', err);
      return await fileStorageService.fallbackBase64Upload(file, validation, user, storagePath);
    }
  },

  /**
   * Fallback Base64 data URL generator for offline/restricted dev environments.
   */
  fallbackBase64Upload: (file, validation, user, storagePath) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const downloadURL = e.target.result;
        resolve({
          fileId: `fallback_${Date.now()}`,
          type: validation.type,
          filename: file.name,
          extension: validation.extension,
          size: file.size,
          downloadURL,
          storagePath,
          uploadedAt: Date.now(),
          uploadedBy: user.uid,
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Delete file from Firebase Storage.
   */
  deleteFile: async (storagePath) => {
    if (!storagePath || storagePath.startsWith('fallback_')) return;
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn('[fileStorageService] Storage delete warning (object may already be removed):', err);
    }
  },
};
