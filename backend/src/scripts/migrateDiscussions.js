/**
 * Idempotent Discussion Path Migration Utility
 * Migrates legacy flat discussions:
 *   discussions/{ideaId}/{discussionId}
 * To workspace-aware hierarchical paths:
 *   discussions/{orgId}/{ideaId}/{discussionId}  (Workspace Ideas)
 *   discussions/public/{ideaId}/{discussionId}   (Public Ideas)
 *
 * Usage:
 *   node backend/src/scripts/migrateDiscussions.js --dry-run
 *   node backend/src/scripts/migrateDiscussions.js --execute
 *
 * CRITICAL SAFETY RULES:
 * - Does NOT delete legacy data.
 * - Idempotent (safe to run multiple times).
 * - Exclusively uses Firebase Admin SDK.
 */

import { rtdbService } from '../services/rtdbService.js';

async function migrateDiscussions() {
  const isDryRun = !process.argv.includes('--execute');
  console.log(`🚀 [Discussion Migration] Starting migration in ${isDryRun ? 'DRY-RUN mode (no writes)' : 'LIVE EXECUTION mode'}...`);

  try {
    const [discussionsData, ideasData, publicIdeasData] = await Promise.all([
      rtdbService.getData('discussions').catch(() => ({})),
      rtdbService.getData('ideas').catch(() => ({})),
      rtdbService.getData('publicIdeas').catch(() => ({})),
    ]);

    if (!discussionsData || typeof discussionsData !== 'object') {
      console.log('ℹ️ No discussions data found in database. Nothing to migrate.');
      return;
    }

    // Build Idea ID -> Org ID mapping
    const ideaToOrgMap = new Map();

    // Map workspace ideas: ideas/{orgId}/{ideaId}
    if (ideasData && typeof ideasData === 'object') {
      Object.entries(ideasData).forEach(([orgId, orgIdeas]) => {
        if (orgIdeas && typeof orgIdeas === 'object') {
          Object.keys(orgIdeas).forEach((ideaId) => {
            ideaToOrgMap.set(ideaId, orgId);
          });
        }
      });
    }

    // Map public ideas: publicIdeas/{ideaId}
    if (publicIdeasData && typeof publicIdeasData === 'object') {
      Object.keys(publicIdeasData).forEach((ideaId) => {
        if (!ideaToOrgMap.has(ideaId)) {
          ideaToOrgMap.set(ideaId, 'public');
        }
      });
    }

    console.log(`🔍 [Discussion Migration] Resolved mapping for ${ideaToOrgMap.size} ideas.`);

    let scannedCount = 0;
    let migratedCount = 0;
    let alreadyNormalizedCount = 0;
    let skippedUnresolvedCount = 0;

    for (const [topLevelKey, topLevelVal] of Object.entries(discussionsData)) {
      if (!topLevelVal || typeof topLevelVal !== 'object') continue;

      // Check if topLevelKey is already an orgId / 'public' (3-segment schema)
      const firstChild = Object.values(topLevelVal)[0];
      const isAlreadyNormalized = firstChild && typeof firstChild === 'object' && !firstChild.discussionId && !firstChild.message;

      if (isAlreadyNormalized) {
        alreadyNormalizedCount += Object.keys(topLevelVal).length;
        continue;
      }

      // If topLevelVal contains discussion items directly, topLevelKey is a legacy ideaId
      const ideaId = topLevelKey;
      const resolvedOrgId = ideaToOrgMap.get(ideaId) || (topLevelVal.orgId || null);

      if (!resolvedOrgId) {
        console.warn(`⚠️ [Discussion Migration] Unresolved parent org for legacy idea '${ideaId}'. Skipping.`);
        skippedUnresolvedCount++;
        continue;
      }

      for (const [discussionId, discRecord] of Object.entries(topLevelVal)) {
        if (!discRecord || typeof discRecord !== 'object') continue;
        scannedCount++;

        const targetPath = `discussions/${resolvedOrgId}/${ideaId}/${discussionId}`;
        const updatedRecord = {
          ...discRecord,
          orgId: resolvedOrgId === 'public' ? null : resolvedOrgId,
        };

        if (!isDryRun) {
          await rtdbService.setData(targetPath, updatedRecord);
        }
        migratedCount++;
      }
    }

    console.log('\n======================================================');
    console.log('📊 DISCUSSION MIGRATION SUMMARY REPORT');
    console.log('======================================================');
    console.log(`Execution Mode:           ${isDryRun ? 'DRY-RUN (Simulated)' : 'LIVE EXECUTION (Committed)'}`);
    console.log(`Discussions Scanned:      ${scannedCount}`);
    console.log(`Discussions Migrated:     ${migratedCount}`);
    console.log(`Already Normalized:       ${alreadyNormalizedCount}`);
    console.log(`Skipped (Unresolved Org): ${skippedUnresolvedCount}`);
    console.log('Legacy Data Preserved:    YES (No legacy entries deleted)');
    console.log('======================================================\n');
  } catch (err) {
    console.error('🚨 [Discussion Migration] Migration error:', err.message);
    process.exit(1);
  }
}

migrateDiscussions();
