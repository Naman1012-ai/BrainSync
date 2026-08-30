/**
 * Idempotent Global Statistics Synchronization Script
 * Can be executed via: node backend/src/scripts/syncGlobalStats.js
 * Scans private collections using Firebase Admin SDK and updates the public 'globalStats' document in RTDB.
 */

import { globalStatsService } from '../services/globalStatsService.js';

async function run() {
  console.log('🚀 [syncGlobalStats Script] Starting globalStats synchronization...');
  const result = await globalStatsService.calculateAndSyncGlobalStats();
  if (result) {
    console.log('🎉 [syncGlobalStats Script] Completed successfully!');
    console.log('Synced Summary:', JSON.stringify(result, null, 2));
    process.exit(0);
  } else {
    console.error('❌ [syncGlobalStats Script] Failed to synchronize globalStats.');
    process.exit(1);
  }
}

run();
