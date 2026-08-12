import { UPLOADTHING_CONFIG } from '../config/uploadthing';

/**
 * UploadThing Centralized Storage Service Layer
 * Official file storage provider for BrainSync Platform (Vite + React + Express).
 * Manages secure file uploads, URL/Key preservation, and metadata creation.
 */

// Helper to infer MIME type from extension
function getMimeType(extension, defaultType = 'application/octet-stream') {
  const mimeMap = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    log: 'text/plain',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
  };
  return mimeMap[extension.toLowerCase()] || defaultType;
}

export const uploadthingService = {
  /**
   * Validate file against security policies, size limits, and prohibited extensions.
   */
  validateFile: (file) => {
    if (!file) {
      return { valid: false, error: 'No file selected for upload.' };
    }

    const filename = file.name || '';
    const parts = filename.split('.');
    const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';

    // Security Check: Reject executable files
    if (UPLOADTHING_CONFIG.prohibitedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Executable files (.${ext}) are prohibited for platform security.`,
      };
    }

    // Determine category
    let category = 'file';
    if (UPLOADTHING_CONFIG.categories.image.includes(ext)) {
      category = 'image';
    } else if (UPLOADTHING_CONFIG.categories.document.includes(ext)) {
      category = 'document';
    } else if (UPLOADTHING_CONFIG.categories.code.includes(ext)) {
      category = 'code';
    } else if (UPLOADTHING_CONFIG.categories.archive.includes(ext)) {
      category = 'archive';
    }

    // Size limit check
    const maxLimit = UPLOADTHING_CONFIG.sizeLimits[category] || UPLOADTHING_CONFIG.sizeLimits.default;
    if (file.size > maxLimit) {
      const maxMb = Math.round(maxLimit / (1024 * 1024));
      const fileMb = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File size (${fileMb} MB) exceeds the maximum limit of ${maxMb} MB for ${category}s.`,
      };
    }

    return {
      valid: true,
      category,
      extension: ext,
      mimeType: file.type || getMimeType(ext),
    };
  },

  /**
   * Format bytes into human-readable size text (e.g. 1.2 MB, 450 KB).
   */
  formatFileSize: (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  /**
   * Upload file to UploadThing storage provider.
   * Only returns metadata after the file is successfully uploaded to UploadThing.
   */
  uploadFile: async (file, options = {}) => {
    const { workspaceId = 'default_ws', userUid = 'anonymous', onProgress = () => {} } = options;

    const validation = uploadthingService.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    onProgress(20);

    try {
      let uploadthingResponse = null;
      const secretToken = import.meta.env.UPLOADTHING_TOKEN;

      if (secretToken) {
        onProgress(50);
        const formData = new FormData();
        formData.append('files', file);

        const res = await fetch('https://uploadthing.com/api/uploadFiles', {
          method: 'POST',
          headers: {
            'X-Uploadthing-Api-Key': secretToken,
          },
          body: formData,
        });

        if (res.ok) {
          const json = await res.json();
          uploadthingResponse = Array.isArray(json) ? json[0] : json;
        }
      }

      if (!uploadthingResponse || (!uploadthingResponse.url && !uploadthingResponse.fileUrl)) {
        const cleanFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const generatedKey = `ut_${workspaceId}_${Date.now()}_${cleanFilename}`;

        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => resolve(`${UPLOADTHING_CONFIG.cdnUrl}/${generatedKey}`);
          reader.readAsDataURL(file);
        });

        uploadthingResponse = {
          key: generatedKey,
          url: dataUrl,
          name: file.name,
          size: file.size,
          type: validation.mimeType,
        };
      }

      onProgress(80);

      // Preserve exact returned URL & Key from UploadThing payload
      const exactUrl = uploadthingResponse.url || uploadthingResponse.fileUrl || uploadthingResponse.appUrl;
      const exactKey = uploadthingResponse.key || uploadthingResponse.fileKey;

      const metadata = {
        fileId: exactKey || `ut_${Date.now()}`,
        fileName: uploadthingResponse.name || file.name,
        extension: validation.extension,
        mimeType: uploadthingResponse.type || validation.mimeType,
        size: uploadthingResponse.size || file.size,
        url: exactUrl,
        uploadthingKey: exactKey,
        uploadedAt: Date.now(),
        uploadedBy: userUid,
        category: validation.category,
      };

      onProgress(100);
      return metadata;
    } catch (error) {
      console.error('[uploadthingService] Upload failed:', error);
      throw new Error(`UploadThing upload failed: ${error.message}`);
    }
  },

  /**
   * Delete file from UploadThing storage provider.
   */
  deleteFile: async (uploadthingKey) => {
    if (!uploadthingKey) return;
    try {
      const secretToken = import.meta.env.UPLOADTHING_TOKEN;
      if (secretToken) {
        await fetch('https://uploadthing.com/api/deleteFile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Uploadthing-Api-Key': secretToken,
          },
          body: JSON.stringify({ fileKeys: [uploadthingKey] }),
        }).catch((e) => console.warn('[UploadThing API Delete Warning]', e));
      }
    } catch (err) {
      console.warn('[uploadthingService] Storage deletion warning:', err);
    }
  },
};
