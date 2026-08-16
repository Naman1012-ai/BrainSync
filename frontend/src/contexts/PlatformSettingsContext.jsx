import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminService } from '../services/adminService';

const PlatformSettingsContext = createContext(null);

export const defaultPlatformSettings = {
  general: {
    platformName: 'Convia',
    tagline: 'Where Ideas Converge into Action.',
    supportEmail: 'support@convia.dev',
    environment: 'Production',
    copyright: '© 2026 Convia Inc. All rights reserved.',
  },
  auth: {
    requireEmailVerification: true,
    allowRegistrations: true,
    minPasswordLength: 8,
  },
  workspaces: {
    maxOrgsPerUser: 5,
    maxMembersPerOrg: 20,
    maxOrgNameLength: 50,
    allowWorkspaceCreation: true,
    allowWorkspaceJoining: true,
    allowWorkspaceDeletion: true,
    allowPublicWorkspaces: true,
    autoArchiveDays: 90,
  },
  ideas: {
    maxIdeasPerUser: 10,
    enableIdeaCreation: true,
    enableIdeaImport: true,
    enableIdeaExport: true,
    enableVoting: true,
    enableSuggestions: true,
    enableComments: true,
    enableBlueprint: true,
    enableMvpSelection: true,
    allowIdeaDeletion: true,
  },
  maintenance: {
    maintenanceMode: false,
    maintenanceMessage: 'Convia is currently undergoing scheduled system maintenance.',
  },
  featureFlags: {
    ideaImport: true,
    blueprint: true,
    resources: true,
    reports: true,
    analytics: true,
  },
};

export function PlatformSettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultPlatformSettings);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    const unsubscribe = adminService.subscribeToPlatformSettings((liveSettings) => {
      if (liveSettings) {
        setSettings({
          general: { ...defaultPlatformSettings.general, ...liveSettings.general },
          auth: { ...defaultPlatformSettings.auth, ...liveSettings.auth },
          workspaces: { ...defaultPlatformSettings.workspaces, ...liveSettings.workspaces },
          ideas: { ...defaultPlatformSettings.ideas, ...liveSettings.ideas },
          maintenance: { ...defaultPlatformSettings.maintenance, ...liveSettings.maintenance },
          featureFlags: { ...defaultPlatformSettings.featureFlags, ...liveSettings.featureFlags },
        });
      } else {
        setSettings(defaultPlatformSettings);
      }
      setLoadingSettings(false);
    });

    return () => unsubscribe();
  }, []);

  const isFeatureEnabled = (key) => {
    return Boolean(settings?.featureFlags?.[key] ?? defaultPlatformSettings.featureFlags[key] ?? true);
  };

  const canCreateWorkspace = (userOwnedCount = 0) => {
    if (!settings.workspaces.allowWorkspaceCreation) {
      return { allowed: false, reason: 'Workspace creation has been disabled by the platform administrator.' };
    }
    if (userOwnedCount >= settings.workspaces.maxOrgsPerUser) {
      return {
        allowed: false,
        reason: `Workspace limit reached. Maximum allowed workspaces per user is ${settings.workspaces.maxOrgsPerUser}.`,
      };
    }
    return { allowed: true };
  };

  const canJoinWorkspace = (currentMemberCount = 0) => {
    if (!settings.workspaces.allowWorkspaceJoining) {
      return { allowed: false, reason: 'Workspace joining has been disabled by the platform administrator.' };
    }
    if (currentMemberCount >= settings.workspaces.maxMembersPerOrg) {
      return {
        allowed: false,
        reason: `Workspace is full. Maximum allowed members per workspace is ${settings.workspaces.maxMembersPerOrg}.`,
      };
    }
    return { allowed: true };
  };

  const canCreateIdea = () => {
    if (!settings.ideas.enableIdeaCreation) {
      return { allowed: false, reason: 'Idea proposal creation has been disabled by the platform administrator.' };
    }
    return { allowed: true };
  };

  const canImportIdea = () => {
    if (!settings.ideas.enableIdeaImport || !settings.featureFlags.ideaImport) {
      return { allowed: false, reason: 'Idea import feature has been disabled by the platform administrator.' };
    }
    return { allowed: true };
  };

  const canExportIdea = () => {
    if (!settings.ideas.enableIdeaExport) {
      return { allowed: false, reason: 'Idea export feature has been disabled by the platform administrator.' };
    }
    return { allowed: true };
  };

  const canVote = () => {
    if (!settings.ideas.enableVoting) {
      return { allowed: false, reason: 'Voting on proposals has been disabled by the platform administrator.' };
    }
    return { allowed: true };
  };

  const canSuggest = () => {
    if (!settings.ideas.enableSuggestions) {
      return { allowed: false, reason: 'Community suggestions have been disabled by the platform administrator.' };
    }
    return { allowed: true };
  };

  const canComment = () => {
    if (!settings.ideas.enableComments) {
      return { allowed: false, reason: 'Discussion comments have been disabled by the platform administrator.' };
    }
    return { allowed: true };
  };

  const canUseBlueprint = () => {
    if (!settings.ideas.enableBlueprint || !settings.featureFlags.blueprint) {
      return { allowed: false, reason: 'AI Blueprint generation has been disabled by the platform administrator.' };
    }
    return { allowed: true };
  };

  const canSelectMvp = () => {
    if (!settings.ideas.enableMvpSelection) {
      return { allowed: false, reason: 'MVP Selection workflow has been disabled by the platform administrator.' };
    }
    return { allowed: true };
  };

  const value = {
    settings,
    loadingSettings,
    isFeatureEnabled,
    canCreateWorkspace,
    canJoinWorkspace,
    canCreateIdea,
    canImportIdea,
    canExportIdea,
    canVote,
    canSuggest,
    canComment,
    canUseBlueprint,
    canSelectMvp,
  };

  return (
    <PlatformSettingsContext.Provider value={value}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}

export function usePlatformSettings() {
  const context = useContext(PlatformSettingsContext);
  if (!context) {
    throw new Error('usePlatformSettings must be used within a PlatformSettingsProvider');
  }
  return context;
}
