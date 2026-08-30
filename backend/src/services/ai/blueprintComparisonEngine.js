/**
 * Phase 9: Structured Blueprint Version Comparison Engine.
 * Computes semantic, section-level differences between two Blueprint snapshots.
 */
export const blueprintComparisonEngine = {
  /**
   * Compares two Blueprint documents (Version A vs Version B).
   * Returns structured metrics, section statuses, and human-readable summary.
   */
  compareVersions: (versionA = {}, versionB = {}) => {
    const vAContent = versionA.rawV2Content || versionA.__v2Content || versionA.content || {};
    const vBContent = versionB.rawV2Content || versionB.__v2Content || versionB.content || {};

    const verAName = String(versionA.version || versionA.versionId || '1.0');
    const verBName = String(versionB.version || versionB.versionId || '2.0');

    // 1. Requirements Diff
    const reqsA = Array.isArray(vAContent.requirements) ? vAContent.requirements : [];
    const reqsB = Array.isArray(vBContent.requirements) ? vBContent.requirements : [];
    const reqsADict = new Map(reqsA.map((r) => [r.id || r.title, r]));
    const reqsBDict = new Map(reqsB.map((r) => [r.id || r.title, r]));

    let reqsAdded = 0;
    let reqsRemoved = 0;
    let reqsModified = 0;

    reqsBDict.forEach((rB, key) => {
      if (!reqsADict.has(key)) {
        reqsAdded++;
      } else {
        const rA = reqsADict.get(key);
        if (rA.priority !== rB.priority || rA.description !== rB.description) {
          reqsModified++;
        }
      }
    });
    reqsADict.forEach((_, key) => {
      if (!reqsBDict.has(key)) reqsRemoved++;
    });

    // 2. Features Diff
    const featsA = Array.isArray(vAContent.execution?.features || vAContent.coreFeatures)
      ? vAContent.execution?.features || vAContent.coreFeatures
      : [];
    const featsB = Array.isArray(vBContent.execution?.features || vBContent.coreFeatures)
      ? vBContent.execution?.features || vBContent.coreFeatures
      : [];
    const featsDelta = featsB.length - featsA.length;

    // 3. Execution Tasks & Effort Diff
    const tasksA = Array.isArray(vAContent.execution?.tasks) ? vAContent.execution?.tasks : [];
    const tasksB = Array.isArray(vBContent.execution?.tasks) ? vBContent.execution?.tasks : [];
    const tasksADict = new Map(tasksA.map((t) => [t.id || t.title, t]));
    const tasksBDict = new Map(tasksB.map((t) => [t.id || t.title, t]));

    let tasksAdded = 0;
    let tasksRemoved = 0;
    tasksBDict.forEach((_, key) => {
      if (!tasksADict.has(key)) tasksAdded++;
    });
    tasksADict.forEach((_, key) => {
      if (!tasksBDict.has(key)) tasksRemoved++;
    });

    const effortA = tasksA.reduce((sum, t) => sum + (Number(t.estimatedEffortHours) || 0), 0);
    const effortB = tasksB.reduce((sum, t) => sum + (Number(t.estimatedEffortHours) || 0), 0);
    const effortDelta = effortB - effortA;

    // 4. Decisions Diff
    const decsA = Array.isArray(vAContent.intelligence?.discussionIntelligence?.decisions)
      ? vAContent.intelligence.discussionIntelligence.decisions
      : [];
    const decsB = Array.isArray(vBContent.intelligence?.discussionIntelligence?.decisions)
      ? vBContent.intelligence.discussionIntelligence.decisions
      : [];
    const approvedDecsA = decsA.filter((d) => d.status === 'approved').length;
    const approvedDecsB = decsB.filter((d) => d.status === 'approved').length;

    // 5. Section Statuses
    const sections = {
      projectUnderstanding: {
        status: (vAContent.projectUnderstanding?.summary || '') !== (vBContent.projectUnderstanding?.summary || '') ? 'CHANGED' : 'UNCHANGED',
      },
      requirements: {
        status: reqsAdded > 0 || reqsRemoved > 0 || reqsModified > 0 ? 'CHANGED' : 'UNCHANGED',
        added: reqsAdded,
        removed: reqsRemoved,
        modified: reqsModified,
        countA: reqsA.length,
        countB: reqsB.length,
      },
      architecture: {
        status: JSON.stringify(vAContent.architecture?.techStack || {}) !== JSON.stringify(vBContent.architecture?.techStack || {}) ? 'CHANGED' : 'UNCHANGED',
      },
      execution: {
        status: tasksAdded > 0 || tasksRemoved > 0 || featsDelta !== 0 || effortDelta !== 0 ? 'CHANGED' : 'UNCHANGED',
        tasksAdded,
        tasksRemoved,
        tasksDelta: tasksB.length - tasksA.length,
        featuresDelta: featsDelta,
        effortDeltaHours: effortDelta,
        countA: tasksA.length,
        countB: tasksB.length,
      },
      decisions: {
        status: decsA.length !== decsB.length || approvedDecsA !== approvedDecsB ? 'CHANGED' : 'UNCHANGED',
        totalDelta: decsB.length - decsA.length,
        approvedDelta: approvedDecsB - approvedDecsA,
      },
    };

    // 6. Summary Phrase
    const summaryTokens = [];
    if (tasksAdded > 0) summaryTokens.push(`+${tasksAdded} tasks`);
    if (tasksRemoved > 0) summaryTokens.push(`-${tasksRemoved} tasks`);
    if (reqsAdded > 0) summaryTokens.push(`+${reqsAdded} reqs`);
    if (effortDelta !== 0) summaryTokens.push(`${effortDelta > 0 ? '+' : ''}${effortDelta}h effort`);
    if (approvedDecsB > approvedDecsA) summaryTokens.push(`+${approvedDecsB - approvedDecsA} decisions approved`);

    const summaryText = summaryTokens.length > 0 ? summaryTokens.join(' · ') : 'Minor formatting & refinement';

    return {
      versionA: verAName,
      versionB: verBName,
      summary: summaryText,
      hasChanges: Object.values(sections).some((s) => s.status === 'CHANGED'),
      sections,
    };
  },
};
