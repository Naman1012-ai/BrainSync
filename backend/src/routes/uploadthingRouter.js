/**
 * Express UploadThing Router Configuration for BrainSync Backend
 * Handles server-side UploadThing file upload endpoints and callbacks.
 */

import { createUploadthing } from 'uploadthing/express';
import { createRouteHandler } from 'uploadthing/express';

const f = createUploadthing();

// UploadThing Express Route Definitions
export const uploadRouter = {
  attachmentUploader: f({
    image: { maxFileSize: '10MB', maxFileCount: 1 },
    pdf: { maxFileSize: '25MB', maxFileCount: 1 },
    blob: { maxFileSize: '50MB', maxFileCount: 1 },
  })
    .middleware(async ({ req }) => {
      // Step 4: Server received request
      console.log('⚡ [UT-Step 4] Server received request on /api/uploadthing');
      return { uploadedBy: 'user' };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Step 5 & 6: UploadThing response & File stored in UploadThing dashboard
      console.log('📦 [UT-Step 5] UploadThing response:', file);
      console.log('☁️ [UT-Step 6] File stored in UploadThing dashboard:', file.url);
    }),
};

// Express Route Handler Export
export const uploadthingExpressHandler = createRouteHandler({
  router: uploadRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
  },
});
