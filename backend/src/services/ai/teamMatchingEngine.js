/**
 * Canonical Team Capability & Matching Engine (Phase 5).
 * Pure deterministic algorithms for:
 * 1. Capability normalization & proficiency comparisons
 * 2. Deterministic, explainable task-to-member capability matching
 * 3. Workload awareness & effort aggregation
 * 4. Team capability gap & workload concentration detection
 * 5. Critical path & dependency-aware assignment recommendations
 *
 * Core Rule: AI recommends. Application calculates. User confirms.
 */

export const PROFICIENCY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert',
};

export const PROFICIENCY_SCORES = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

export const CAPABILITY_SOURCES = {
  USER_PROVIDED: 'userProvided',
  VERIFIED_PROFILE: 'verifiedProfile',
  IMPORTED: 'imported',
  SYSTEM_DERIVED: 'systemDerived',
};

export const WORKLOAD_LEVELS = {
  LOW: 'low',
  BALANCED: 'balanced',
  HIGH: 'high',
  OVERLOADED: 'overloaded',
  UNKNOWN: 'unknown',
};

/**
 * Normalizes a raw user capability into canonical structure.
 */
export function normalizeCapability(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return {
      skill: trimmed,
      proficiency: PROFICIENCY_LEVELS.INTERMEDIATE,
      source: CAPABILITY_SOURCES.USER_PROVIDED,
      verified: true,
    };
  }

  const skillName = (raw.skill || raw.name || '').trim();
  if (!skillName) return null;

  const rawProf = String(raw.proficiency || '').toLowerCase().trim();
  const proficiency = PROFICIENCY_SCORES[rawProf] ? rawProf : PROFICIENCY_LEVELS.INTERMEDIATE;
  const rawSource = raw.source || CAPABILITY_SOURCES.USER_PROVIDED;
  const verified = raw.verified !== undefined ? Boolean(raw.verified) : rawSource !== CAPABILITY_SOURCES.SYSTEM_DERIVED;

  return {
    skill: skillName,
    proficiency,
    source: rawSource,
    verified,
  };
}

/**
 * Normalizes a task's required capability.
 */
export function normalizeRequiredCapability(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return {
      skill: trimmed,
      minimumProficiency: PROFICIENCY_LEVELS.INTERMEDIATE,
      importance: 'required',
    };
  }

  const skillName = (raw.skill || raw.name || '').trim();
  if (!skillName) return null;

  const rawProf = String(raw.minimumProficiency || raw.proficiency || '').toLowerCase().trim();
  const minimumProficiency = PROFICIENCY_SCORES[rawProf] ? rawProf : PROFICIENCY_LEVELS.INTERMEDIATE;
  const importance = raw.importance === 'preferred' ? 'preferred' : 'required';

  return {
    skill: skillName,
    minimumProficiency,
    importance,
  };
}

/**
 * Checks if two skill names match (case-insensitive substring or alias match).
 */
export function isSkillMatch(skillA, skillB) {
  if (!skillA || !skillB) return false;
  const a = String(skillA).toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = String(skillB).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

/**
 * Deterministically calculates capability match score and explainable reasons
 * between an eligible team member and a task.
 */
export function calculateMemberMatchForTask(member, task, role = null, memberWorkload = null) {
  if (!member) {
    return {
      matchScore: 0,
      confidence: 'none',
      matchLevel: 'none',
      reasons: ['No member record provided.'],
      capabilityMatches: [],
      capabilityGaps: [],
      hasMissingData: true,
    };
  }

  // Normalize member capabilities
  const rawSkills = Array.isArray(member.declaredSkills)
    ? member.declaredSkills
    : Array.isArray(member.skills)
    ? member.skills
    : typeof member.skills === 'string'
    ? member.skills.split(',').map((s) => s.trim())
    : [];

  const memberCaps = rawSkills.map(normalizeCapability).filter(Boolean);
  const hasDeclaredSkills = memberCaps.length > 0;

  // Extract task required capabilities
  const taskReqCaps = Array.isArray(task?.requiredCapabilities)
    ? task.requiredCapabilities.map(normalizeRequiredCapability).filter(Boolean)
    : [];

  // Fallback: If task has no explicit requiredCapabilities, use role capabilityRequirements or task category
  if (taskReqCaps.length === 0 && role?.capabilityRequirements?.length) {
    role.capabilityRequirements.forEach((req) => {
      const norm = normalizeRequiredCapability(req);
      if (norm) taskReqCaps.push(norm);
    });
  }

  // If member has no verified skills on profile
  if (!hasDeclaredSkills) {
    return {
      memberId: member.id || member.uid,
      memberName: member.name || member.displayName || 'Team Member',
      matchScore: 0,
      confidence: 'none',
      matchLevel: 'unknown',
      reasons: ['Insufficient verified capability information on member profile.'],
      capabilityMatches: [],
      capabilityGaps: taskReqCaps.map((r) => r.skill),
      hasMissingData: true,
      workload: memberWorkload,
    };
  }

  const requiredItems = taskReqCaps.filter((r) => r.importance === 'required');
  const preferredItems = taskReqCaps.filter((r) => r.importance === 'preferred');

  let requiredScore = 0;
  let maxRequiredScore = Math.max(requiredItems.length * 10, 1);
  const capabilityMatches = [];
  const capabilityGaps = [];

  // 1. Evaluate Required Capabilities (70% weighting)
  for (const req of requiredItems) {
    const matchedCap = memberCaps.find((c) => isSkillMatch(c.skill, req.skill));
    if (matchedCap) {
      const reqProfScore = PROFICIENCY_SCORES[req.minimumProficiency] || 2;
      const memProfScore = PROFICIENCY_SCORES[matchedCap.proficiency] || 2;

      if (memProfScore >= reqProfScore) {
        requiredScore += 10;
        capabilityMatches.push({
          skill: req.skill,
          matchedSkill: matchedCap.skill,
          memberProficiency: matchedCap.proficiency,
          requiredProficiency: req.minimumProficiency,
          importance: 'required',
          fit: 'meets_or_exceeds',
        });
      } else {
        requiredScore += 5; // Partial points for knowing skill at lower level
        capabilityMatches.push({
          skill: req.skill,
          matchedSkill: matchedCap.skill,
          memberProficiency: matchedCap.proficiency,
          requiredProficiency: req.minimumProficiency,
          importance: 'required',
          fit: 'partial_proficiency',
        });
      }
    } else {
      capabilityGaps.push({
        skill: req.skill,
        requiredProficiency: req.minimumProficiency,
        importance: 'required',
      });
    }
  }

  // 2. Evaluate Preferred Capabilities (20% weighting)
  let preferredScore = 0;
  let maxPreferredScore = Math.max(preferredItems.length * 10, 1);

  for (const pref of preferredItems) {
    const matchedCap = memberCaps.find((c) => isSkillMatch(c.skill, pref.skill));
    if (matchedCap) {
      preferredScore += 10;
      capabilityMatches.push({
        skill: pref.skill,
        matchedSkill: matchedCap.skill,
        memberProficiency: matchedCap.proficiency,
        requiredProficiency: pref.minimumProficiency,
        importance: 'preferred',
        fit: 'meets_or_exceeds',
      });
    } else {
      capabilityGaps.push({
        skill: pref.skill,
        requiredProficiency: pref.minimumProficiency,
        importance: 'preferred',
      });
    }
  }

  // 3. Evaluate Role & Workspace Context (10% weighting)
  let roleFitScore = 0;
  const taskCategory = String(task?.category || '').toLowerCase();
  const memberRole = String(member.workspaceRole || '').toLowerCase();
  const preferredStack = String(member.preferredTechStack || '').toLowerCase();

  if (
    memberRole.includes('lead') ||
    memberRole.includes('admin') ||
    memberRole.includes('owner') ||
    preferredStack.includes(taskCategory) ||
    (role && memberCaps.some((c) => role.roleName && isSkillMatch(c.skill, role.roleName)))
  ) {
    roleFitScore = 10;
  } else {
    roleFitScore = 5;
  }

  // 4. Calculate Final Composite Match Score (0 - 100)
  let finalScore = 0;
  if (taskReqCaps.length > 0) {
    const reqRatio = requiredItems.length > 0 ? requiredScore / maxRequiredScore : 1;
    const prefRatio = preferredItems.length > 0 ? preferredScore / maxPreferredScore : 0;
    
    if (requiredItems.length > 0 && requiredScore === 0) {
      finalScore = Math.min(roleFitScore, 10);
    } else {
      finalScore = Math.round(reqRatio * 70 + prefRatio * 20 + (roleFitScore / 10) * 10);
    }
  } else {
    // If no capabilities specified on task or role, baseline fit on category / role
    finalScore = roleFitScore > 5 ? 75 : 50;
  }

  // Cap score between 0 and 100
  finalScore = Math.min(Math.max(finalScore, 0), 100);

  // Confidence & Match Level
  let confidence = 'low';
  let matchLevel = 'partial';
  if (finalScore >= 80 && capabilityGaps.filter((g) => g.importance === 'required').length === 0) {
    confidence = 'high';
    matchLevel = 'strong';
  } else if (finalScore >= 50) {
    confidence = 'medium';
    matchLevel = 'moderate';
  } else {
    confidence = 'low';
    matchLevel = 'weak';
  }

  // 5. Generate Transparent, Explainable Sentences
  const reasons = [];
  if (capabilityMatches.length > 0) {
    const matchSummary = capabilityMatches
      .map((m) => `${m.skill} (${m.memberProficiency})`)
      .join(', ');
    reasons.push(`Verified capabilities match task requirements: ${matchSummary}.`);
  }

  const missingReqs = capabilityGaps.filter((g) => g.importance === 'required');
  if (missingReqs.length > 0) {
    const gapSummary = missingReqs.map((g) => g.skill).join(', ');
    reasons.push(`Missing verified experience in required skills: ${gapSummary}.`);
  }

  if (memberWorkload) {
    if (memberWorkload.workloadLevel === WORKLOAD_LEVELS.HIGH || memberWorkload.workloadLevel === WORKLOAD_LEVELS.OVERLOADED) {
      reasons.push(`Note: Member currently has high active workload (${memberWorkload.totalEstimatedHours}h across ${memberWorkload.activeTaskCount} tasks).`);
    } else if (memberWorkload.workloadLevel === WORKLOAD_LEVELS.LOW) {
      reasons.push(`Member has available execution bandwidth (${memberWorkload.activeTaskCount} active tasks).`);
    }
  }

  return {
    memberId: member.id || member.uid,
    memberName: member.name || member.displayName || 'Team Member',
    matchScore: finalScore,
    confidence,
    matchLevel,
    reasons,
    capabilityMatches,
    capabilityGaps,
    hasMissingData: false,
    workload: memberWorkload,
  };
}

/**
 * Aggregates workload across the workspace.
 * Calculates active task count, estimated effort hours, and flags workload concentration (>50%).
 * Strictly does NOT invent or assume upper capacity limits when unmeasured.
 */
export function calculateTeamWorkloadSummary(tasks = [], members = []) {
  const workloadMap = {};

  // Initialize roster members with zero baseline
  members.forEach((m) => {
    const uid = m.id || m.uid;
    if (uid) {
      workloadMap[uid] = {
        memberId: uid,
        memberName: m.name || m.displayName || 'Team Member',
        workspaceRole: m.workspaceRole || 'Contributor',
        activeTaskCount: 0,
        completedTaskCount: 0,
        totalEstimatedHours: 0,
        unestimatedTaskCount: 0,
        overdueTaskCount: 0,
        hasEffortData: false,
        assignedTaskIds: [],
        workloadLevel: WORKLOAD_LEVELS.LOW,
        capacity: 'unknown',
      };
    }
  });

  let totalProjectHours = 0;
  let unestimatedTaskCount = 0;
  let activeTaskCount = 0;
  let completedTaskCount = 0;
  const unassignedTasks = [];

  // Aggregate assigned and unassigned tasks
  tasks.forEach((t) => {
    const isCompleted = t.status === 'Completed' || t.status === 'completed';
    const effort = Number(t.estimatedEffortHours) || (t.effort ? Number(t.effort) : 0);
    const assignedUid = t.assignedUserId || t.assignedTo || null;

    if (isCompleted) {
      completedTaskCount += 1;
    } else {
      activeTaskCount += 1;
      if (effort > 0) {
        totalProjectHours += effort;
      } else {
        unestimatedTaskCount += 1;
      }
    }

    if (!assignedUid) {
      unassignedTasks.push(t);
      return;
    }

    if (!workloadMap[assignedUid]) {
      workloadMap[assignedUid] = {
        memberId: assignedUid,
        memberName: t.assignedUserName || t.assignedToName || 'Assigned Member',
        workspaceRole: 'Contributor',
        activeTaskCount: 0,
        completedTaskCount: 0,
        totalEstimatedHours: 0,
        unestimatedTaskCount: 0,
        overdueTaskCount: 0,
        hasEffortData: false,
        assignedTaskIds: [],
        workloadLevel: WORKLOAD_LEVELS.LOW,
        capacity: 'unknown',
      };
    }

    const memberStats = workloadMap[assignedUid];
    memberStats.assignedTaskIds.push(t.id || t.taskId);

    if (isCompleted) {
      memberStats.completedTaskCount += 1;
    } else {
      memberStats.activeTaskCount += 1;
      if (effort > 0) {
        memberStats.totalEstimatedHours += effort;
        memberStats.hasEffortData = true;
      } else {
        memberStats.unestimatedTaskCount += 1;
      }
    }
  });

  // Determine workload levels and overload warnings
  const workloadList = Object.values(workloadMap).map((stat) => {
    const hours = stat.totalEstimatedHours;
    const count = stat.activeTaskCount;

    let level = WORKLOAD_LEVELS.LOW;
    if (hours >= 35 || count >= 8) {
      level = WORKLOAD_LEVELS.OVERLOADED;
    } else if (hours >= 20 || count >= 5) {
      level = WORKLOAD_LEVELS.HIGH;
    } else if (hours >= 8 || count >= 2) {
      level = WORKLOAD_LEVELS.BALANCED;
    } else if (count === 0) {
      level = WORKLOAD_LEVELS.LOW;
    }

    stat.workloadLevel = level;
    stat.workloadPercentage = totalProjectHours > 0 ? Math.round((hours / totalProjectHours) * 100) : 0;

    return {
      ...stat,
      workloadLevel: level,
      workloadPercentage: stat.workloadPercentage,
    };
  });

  // Detect workload concentration (>50% of work on 1 member when team has >1 member)
  const concentrationWarnings = [];
  if (workloadList.length > 1 && totalProjectHours > 0) {
    const concentrated = workloadList.filter((w) => w.workloadPercentage >= 50);
    concentrated.forEach((c) => {
      concentrationWarnings.push(
        `Workload concentration detected: ${c.memberName} is allocated ${c.totalEstimatedHours}h (${c.workloadPercentage}% of total project effort).`
      );
    });
  }

  return {
    membersWorkload: workloadList,
    workloadMap,
    totalProjectHours,
    totalTaskCount: tasks.length,
    activeTaskCount,
    completedTaskCount,
    unestimatedTaskCount,
    unassignedTaskCount: unassignedTasks.length,
    unassignedTasks,
    concentrationWarnings,
  };
}

/**
 * Analyzes whole-team capability coverage vs project requirements and architectural roles.
 */
export function analyzeTeamCapabilityGaps(tasks = [], roles = [], members = [], techStack = null) {
  const allRequiredSkills = new Set();
  const allDeclaredSkills = new Set();

  const addRequiredSkill = (raw) => {
    if (!raw) return;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed && trimmed.toLowerCase() !== 'n/a' && trimmed.toLowerCase() !== 'none') {
        allRequiredSkills.add(trimmed);
      }
    } else if (typeof raw === 'object') {
      const name = raw.skill || raw.name || raw.capability || '';
      if (typeof name === 'string' && name.trim()) {
        allRequiredSkills.add(name.trim());
      }
    }
  };

  // 1. Collect all task required capabilities
  tasks.forEach((t) => {
    if (Array.isArray(t.requiredCapabilities)) {
      t.requiredCapabilities.forEach(addRequiredSkill);
    }
    if (Array.isArray(t.requiredSkills)) {
      t.requiredSkills.forEach(addRequiredSkill);
    }
  });

  // 2. Collect all role required capabilities
  roles.forEach((r) => {
    if (Array.isArray(r.capabilityRequirements)) {
      r.capabilityRequirements.forEach(addRequiredSkill);
    }
    if (Array.isArray(r.requiredSkills)) {
      r.requiredSkills.forEach(addRequiredSkill);
    }
  });

  // 3. Collect from techStack if available
  if (techStack) {
    if (typeof techStack === 'string') {
      techStack.split(',').forEach(addRequiredSkill);
    } else if (typeof techStack === 'object') {
      Object.values(techStack).flat().forEach((val) => {
        if (Array.isArray(val)) {
          val.forEach(addRequiredSkill);
        } else {
          addRequiredSkill(val);
        }
      });
    }
  }

  // 4. Collect member capabilities
  members.forEach((m) => {
    const skills = Array.isArray(m.declaredSkills)
      ? m.declaredSkills
      : Array.isArray(m.skills)
      ? m.skills
      : typeof m.skills === 'string'
      ? m.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    skills.forEach((s) => {
      if (s) {
        if (typeof s === 'string') {
          const trimmed = s.trim();
          if (trimmed) allDeclaredSkills.add(trimmed);
        } else if (typeof s === 'object') {
          const skillName = s.skill || s.name || s.capability || '';
          if (skillName && typeof skillName === 'string') allDeclaredSkills.add(skillName.trim());
        }
      }
    });
  });

  const coveredSkills = [];
  const uncoveredSkills = [];

  allRequiredSkills.forEach((reqSkill) => {
    let isCovered = false;
    for (const memSkill of allDeclaredSkills) {
      if (isSkillMatch(memSkill, reqSkill)) {
        isCovered = true;
        break;
      }
    }
    if (isCovered) {
      coveredSkills.push(reqSkill);
    } else {
      uncoveredSkills.push(reqSkill);
    }
  });

  // Detect uncovered roles
  const uncoveredRoles = roles.filter((r) => {
    const roleReqs = r.capabilityRequirements || r.requiredSkills || [];
    if (roleReqs.length === 0) return false;
    const hasMatch = members.some((m) => {
      const mSkills = Array.isArray(m.declaredSkills)
        ? m.declaredSkills
        : Array.isArray(m.skills)
        ? m.skills
        : typeof m.skills === 'string'
        ? m.skills.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      return roleReqs.some((req) => mSkills.some((ms) => isSkillMatch(ms, req)));
    });
    return !hasMatch;
  });

  // Strategic actionable advice for gaps
  const strategicAdvice = [];
  if (uncoveredSkills.length > 0) {
    strategicAdvice.push(
      `Team lacks verified experience in: ${uncoveredSkills.join(', ')}. Consider managed cloud services, architectural simplification, or pairing with learning resources.`
    );
  }
  if (uncoveredRoles.length > 0) {
    const roleNames = uncoveredRoles.map((r) => r.roleName).join(', ');
    strategicAdvice.push(`No verified team members match requirements for roles: ${roleNames}.`);
  }

  const hasRequirements = allRequiredSkills.size > 0;
  const coveragePercentage = hasRequirements
    ? Math.round((coveredSkills.length / allRequiredSkills.size) * 100)
    : null;
  const coverageStatus = !hasRequirements
    ? 'no_requirements'
    : coveredSkills.length === allRequiredSkills.size
    ? 'full_coverage'
    : 'partial_coverage';
  const coverageLabel = !hasRequirements
    ? 'N/A'
    : `${coveragePercentage}%`;

  return {
    totalRequiredSkillsCount: allRequiredSkills.size,
    hasRequirements,
    coveredSkills,
    uncoveredSkills,
    coveragePercentage,
    coverageStatus,
    coverageLabel,
    uncoveredRoles,
    strategicAdvice,
  };
}

/**
 * Generates holistic, explainable assignment recommendations for all tasks.
 * Combines capability match, workload balancing, and critical path awareness.
 */
export function generateTaskAssignmentRecommendations(tasks = [], roles = [], members = [], workloadSummary = null) {
  const rolesMap = {};
  roles.forEach((r) => {
    if (r.id) rolesMap[r.id] = r;
  });

  const summary = workloadSummary || calculateTeamWorkloadSummary(tasks, members);
  const workloadMap = summary.workloadMap || {};

  return tasks.map((task) => {
    const assignedRole = rolesMap[task.recommendedRoleId] || null;

    // Evaluate match for every eligible workspace member
    const memberMatches = members
      .map((member) => {
        const uid = member.id || member.uid;
        const memWorkload = workloadMap[uid] || null;
        return calculateMemberMatchForTask(member, task, assignedRole, memWorkload);
      })
      .sort((a, b) => {
        // Primary sort: Match score descending
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        // Secondary sort: Lower active workload preferred
        const aHours = a.workload?.totalEstimatedHours || 0;
        const bHours = b.workload?.totalEstimatedHours || 0;
        return aHours - bHours;
      });

    const bestMatch = memberMatches[0] || null;
    const alternatives = memberMatches.slice(1, 4).filter((m) => m.matchScore > 0);

    const isCriticalPath = Boolean(task.isCriticalPath);
    const isBlocked = Boolean(task.isBlocked);

    return {
      taskId: task.id,
      taskTitle: task.title,
      category: task.category,
      priority: task.priority,
      recommendedRoleId: task.recommendedRoleId || null,
      recommendedRoleName: assignedRole?.roleName || null,
      currentAssignedUserId: task.assignedUserId || null,
      currentAssignedUserName: task.assignedUserName || null,
      recommendedUserId: bestMatch && bestMatch.matchScore >= 40 ? bestMatch.memberId : null,
      recommendedUserName: bestMatch && bestMatch.matchScore >= 40 ? bestMatch.memberName : null,
      matchScore: bestMatch?.matchScore || 0,
      confidence: bestMatch?.confidence || 'none',
      matchLevel: bestMatch?.matchLevel || 'none',
      reasons: bestMatch?.reasons || ['No eligible members found in workspace.'],
      capabilityMatches: bestMatch?.capabilityMatches || [],
      capabilityGaps: bestMatch?.capabilityGaps || [],
      alternatives: alternatives.map((alt) => ({
        memberId: alt.memberId,
        memberName: alt.memberName,
        matchScore: alt.matchScore,
        confidence: alt.confidence,
        reasons: alt.reasons,
      })),
      isCriticalPath,
      isBlocked,
      unmetPrerequisites: task.unmetPrerequisites || [],
    };
  });
}
