import { Router } from 'express';
import { blueprintController } from '../controllers/blueprintController.js';

export const blueprintRouter = Router();

// Helper wrapper for Express async handlers
function asyncRoute(fn) {
  return async (req, res, next) => {
    try {
      const { workspaceId, userUid, updatedContent } = req.body || {};
      const result = await fn(workspaceId || req.query.workspaceId, userUid || req.query.userUid, updatedContent);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error(`🚨 [Blueprint API Error] Route: ${req.path} | Error:`, err.message);
      res.status(400).json({ success: false, error: { message: err.message, code: err.code || 'BLUEPRINT_ERROR' } });
    }
  };
}

blueprintRouter.post('/generate', asyncRoute((workspaceId, userUid) => blueprintController.generateBlueprintHandler(workspaceId, userUid)));
blueprintRouter.post('/recover', asyncRoute((workspaceId, userUid) => blueprintController.recoverStaleGenerationHandler(workspaceId, userUid)));
blueprintRouter.put('/update', asyncRoute((workspaceId, userUid, updatedContent) => blueprintController.updateBlueprintHandler(workspaceId, userUid, updatedContent)));
blueprintRouter.post('/export-json', asyncRoute((workspaceId, userUid) => blueprintController.exportJsonHandler(workspaceId, userUid)));
blueprintRouter.post('/analyze-community', asyncRoute((workspaceId, userUid) => blueprintController.analyzeCommunityIntelligenceHandler(workspaceId, userUid)));
