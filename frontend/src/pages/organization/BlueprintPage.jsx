import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useOrg } from '../../hooks/useOrg';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import { orgService } from '../../services/orgService';
import { ideaService } from '../../services/ideaService';
import { blueprintService } from '../../services/blueprintService';
import { aiBlueprintService } from '../../services/aiBlueprintService';
import { rtdbService } from '../../services/rtdbService';
import { NotificationService } from '../../services/notificationService';
import { NOTIFICATION_MESSAGES } from '../../utils/notificationMessages';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/feedback/Spinner';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { formatTimestamp } from '../../utils/formatting';
import {
  FileText,
  CheckCircle2,
  ThumbsUp,
  Sparkles,
  MessageCircle,
  Code,
  ArrowRight,
  Shield,
  Trophy,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  Clock,
  Layers,
  Wand2,
  Cpu,
  Database,
  Users,
  GitBranch,
  ShieldAlert,
  Zap,
  Target,
  Workflow,
  CheckSquare,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  Activity,
  Award,
  Filter,
  BarChart2,
  Lightbulb,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  Check,
  Download,
  FileCode,
  FileType,
  RefreshCw,
  History,
} from 'lucide-react';

const GENERATION_STAGES = [
  'Analyzing MVP Context & Problem Statement...',
  'Evaluating Tech Stack & Framework Requirements...',
  'Designing System Architecture & Database Schema...',
  'Analyzing Community Feedback & Discussions...',
  'Compiling 16-Section Blueprint Specification...',
];

export default function BlueprintPage() {
  const { orgId } = useParams();
  const { user } = useAuth();
  const { isLeader } = useOrg();
  const { canUseBlueprint } = usePlatformSettings();
  const blueprintCheck = canUseBlueprint();

  const [org, setOrg] = useState(null);
  const [activeMvpId, setActiveMvpId] = useState(null);
  const [mvpIdea, setMvpIdea] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [blueprintVersions, setBlueprintVersions] = useState([]);
  const [selectedVersionKey, setSelectedVersionKey] = useState(null);

  const [loadingOrg, setLoadingOrg] = useState(true);
  const [loadingIdea, setLoadingIdea] = useState(true);
  const [loadingBlueprint, setLoadingBlueprint] = useState(true);

  // Generation & UI States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingCommunity, setIsAnalyzingCommunity] = useState(false);
  const [generationStageIndex, setGenerationStageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('architecture');

  // Phase 5 Editing States
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showRegenWarningModal, setShowRegenWarningModal] = useState(false);

  // Phase 6 Export States
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Phase 4 Relevance Filter State
  const [relevanceFilter, setRelevanceFilter] = useState('all');

  if (!blueprintCheck.allowed) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <Card className="p-8 border border-amber-200 bg-amber-50 rounded-2xl text-amber-900 space-y-3 shadow-md">
          <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto" />
          <h3 className="text-lg font-extrabold">Feature Disabled</h3>
          <p className="text-sm font-medium">{blueprintCheck.reason}</p>
        </Card>
      </div>
    );
  }

  // 1. Subscribe to Organization & Real-time Active MVP Resolution
  useEffect(() => {
    if (!orgId) return;
    setLoadingOrg(true);

    const unsubOrg = orgService.subscribeToOrganization(orgId, (orgData) => {
      setOrg(orgData);
      setLoadingOrg(false);
    });

    const unsubMeta = rtdbService.subscribe(`workspaces/${orgId}/metadata`, (meta) => {
      if (meta?.selectedIdeaId) {
        setActiveMvpId(meta.selectedIdeaId);
      }
    });

    const unsubIdeas = ideaService.subscribeToIdeas(orgId, (ideasArray) => {
      const selectedIdea = (ideasArray || []).find(
        (i) => i && !i.isDeleted && (i.isSelected || i.status === 'selected' || i.status === 'Selected MVP')
      );
      if (selectedIdea) {
        setActiveMvpId(selectedIdea.ideaId);
      } else if (!org?.activeProjectId) {
        rtdbService.getData(`organizations/${orgId}`).then((oData) => {
          if (!oData?.activeProjectId) {
            setActiveMvpId(null);
          }
        });
      }
    });

    return () => {
      unsubOrg();
      unsubMeta();
      unsubIdeas();
    };
  }, [orgId, org?.activeProjectId]);

  useEffect(() => {
    if (org?.activeProjectId && !activeMvpId) {
      setActiveMvpId(org.activeProjectId);
    }
  }, [org?.activeProjectId, activeMvpId]);

  // 2. Real-time Subscription to Active MVP Idea Node
  useEffect(() => {
    if (!orgId || !activeMvpId) {
      setMvpIdea(null);
      setLoadingIdea(false);
      return;
    }

    setLoadingIdea(true);
    setMvpIdea(null);

    const unsubIdea = ideaService.subscribeToIdea(orgId, activeMvpId, (ideaData) => {
      setMvpIdea(ideaData);
      setLoadingIdea(false);
    });

    return () => unsubIdea();
  }, [orgId, activeMvpId]);

  // 3. Real-time Subscription to MVP Blueprint Document & Phase 7 Stale Recovery
  useEffect(() => {
    if (!orgId || !activeMvpId) {
      setBlueprint(null);
      setLoadingBlueprint(false);
      return;
    }

    setLoadingBlueprint(true);
    setBlueprint(null);

    const unsubBp = blueprintService.subscribeToMvpBlueprint(orgId, activeMvpId, (bpData) => {
      setBlueprint(bpData);
      setLoadingBlueprint(false);

      if (bpData?.status === 'generating') {
        const lastUpdated = bpData.updatedAt || bpData.generationStartedAt || 0;
        const isStale = Date.now() - lastUpdated > 90000; // > 90 seconds timeout

        if (isStale && user?.uid) {
          console.warn('⚠️ [Stale Generation Detected] Triggering auto-recovery for stuck blueprint...');
          aiBlueprintService.recoverStaleGeneration(orgId, user.uid).then(() => {
            setIsGenerating(false);
          });
        } else {
          setIsGenerating(true);
        }
      } else {
        setIsGenerating(false);
      }

      if (bpData?.communityIntelligenceStatus === 'analyzing') {
        setIsAnalyzingCommunity(true);
      } else {
        setIsAnalyzingCommunity(false);
      }
    });

    return () => unsubBp();
  }, [orgId, activeMvpId, user?.uid]);

  // 4. Real-time Subscription to Version History List
  useEffect(() => {
    if (!orgId || !activeMvpId) {
      setBlueprintVersions([]);
      return;
    }

    const unsubVersions = blueprintService.subscribeToBlueprintVersions(orgId, activeMvpId, (vList) => {
      setBlueprintVersions(vList || []);
    });

    return () => unsubVersions();
  }, [orgId, activeMvpId]);

  // Merged versions array (real-time versions + embedded blueprint.versions fallback)
  const effectiveBlueprintVersions = React.useMemo(() => {
    if (blueprintVersions && blueprintVersions.length > 0) return blueprintVersions;
    if (blueprint && blueprint.versions && typeof blueprint.versions === 'object') {
      const list = Object.values(blueprint.versions).filter((v) => v && typeof v === 'object' && (v.status === 'completed' || v.version));
      list.sort((a, b) => (parseFloat(b.version) || 0) - (parseFloat(a.version) || 0));
      return list;
    }
    return [];
  }, [blueprintVersions, blueprint]);

  // Resolved active/displayed blueprint (supports switching to historical versions & safe fallback extraction)
  const displayedBlueprint = React.useMemo(() => {
    if (selectedVersionKey && effectiveBlueprintVersions.length > 0) {
      const matched = effectiveBlueprintVersions.find(
        (v) =>
          String(v.version) === String(selectedVersionKey) ||
          String(v.versionId) === String(selectedVersionKey) ||
          parseFloat(v.version) === parseFloat(selectedVersionKey)
      );
      if (matched) {
        const contentObj = matched.content || (matched.projectOverview ? matched : null);
        return {
          ...matched,
          status: matched.status || 'completed',
          content: contentObj,
        };
      }
    }
    if (blueprint) {
      const contentObj = blueprint.content || (blueprint.projectOverview ? blueprint : null);
      return {
        ...blueprint,
        status: blueprint.status || 'completed',
        content: contentObj,
      };
    }
    return null;
  }, [selectedVersionKey, effectiveBlueprintVersions, blueprint]);

  // Resolved latest version string
  const latestVersion = React.useMemo(() => {
    if (effectiveBlueprintVersions && effectiveBlueprintVersions.length > 0) {
      return String(effectiveBlueprintVersions[0].version || '1.0');
    }
    return blueprint?.version ? String(blueprint.version) : '1.0';
  }, [effectiveBlueprintVersions, blueprint]);

  // Determine if user is actually viewing an older historical version
  const isViewingHistorical = React.useMemo(() => {
    if (!selectedVersionKey) return false;
    if (selectedVersionKey === latestVersion) return false;
    if (parseFloat(selectedVersionKey) === parseFloat(latestVersion)) return false;
    return true;
  }, [selectedVersionKey, latestVersion]);

  // Stage Cycle Timer during Generation
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setGenerationStageIndex((prev) => (prev + 1) % GENERATION_STAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Phase 5 Editing Handlers
  const handleStartEdit = () => {
    if (!blueprint?.content) return;
    setEditForm(JSON.parse(JSON.stringify(blueprint.content)));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    if (!orgId || !user?.uid || !editForm) return;

    setIsSaving(true);
    try {
      await aiBlueprintService.updateBlueprint(orgId, user.uid, editForm);
      NotificationService.success('Blueprint changes saved successfully.');
      setIsEditing(false);
      setEditForm(null);
    } catch (err) {
      console.error('[BlueprintPage] handleSaveEdit error:', err);
      NotificationService.error(err.message || 'Failed to save Blueprint changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // Phase 6 Export Handlers
  const handleExportJson = async () => {
    if (isEditing) {
      NotificationService.warning('Save your changes before exporting.');
      return;
    }
    if (!orgId || !user?.uid) return;

    setIsExportingJson(true);
    setShowExportMenu(false);

    try {
      await aiBlueprintService.exportBlueprintJson(orgId, user.uid, displayedBlueprint?.version, displayedBlueprint);
      NotificationService.success('Blueprint exported successfully as JSON.');
    } catch (err) {
      console.error('[BlueprintPage] handleExportJson error:', err);
      NotificationService.error(err.message || 'Failed to export Blueprint JSON.');
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleExportPdf = async () => {
    if (isEditing) {
      NotificationService.warning('Save your changes before exporting.');
      return;
    }
    if (!orgId || !user?.uid) return;

    setIsExportingPdf(true);
    setShowExportMenu(false);

    try {
      await aiBlueprintService.exportBlueprintPdf(orgId, user.uid, org?.name || 'Workspace', displayedBlueprint?.version, displayedBlueprint);
      NotificationService.success('Blueprint exported successfully as PDF.');
    } catch (err) {
      console.error('[BlueprintPage] handleExportPdf error:', err);
      NotificationService.error(err.message || 'Failed to export Blueprint PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Trigger Gemini Blueprint Generation (Phase 3)
  const handleGenerateBlueprint = async () => {
    if (!orgId || !user?.uid) return;

    setShowRegenWarningModal(false);
    setIsGenerating(true);
    setGenerationStageIndex(0);

    try {
      const res = await aiBlueprintService.generateBlueprint(orgId, user.uid);
      const generatedDoc = res?.data?.blueprint || res?.blueprint;

      // Auto-select latest version & immediately hydrate UI with generated content
      setSelectedVersionKey(null);
      if (generatedDoc) {
        setBlueprint(generatedDoc);
      }
      NotificationService.success(NOTIFICATION_MESSAGES.ADMIN.BLUEPRINT_SAVED || 'AI Blueprint generated successfully.');
    } catch (err) {
      console.error('[BlueprintPage] handleGenerateBlueprint error:', err);
      NotificationService.error('Blueprint generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenButtonClick = () => {
    if (blueprint?.lastModifiedSource === 'manual' || isEditing) {
      setShowRegenWarningModal(true);
    } else {
      handleGenerateBlueprint();
    }
  };

  // Trigger Standalone Community Intelligence Analysis (Phase 4)
  const handleAnalyzeCommunityIntelligence = async () => {
    if (!orgId || !user?.uid) return;

    setIsAnalyzingCommunity(true);

    try {
      await aiBlueprintService.analyzeCommunityIntelligence(orgId, user.uid);
      NotificationService.success('Community intelligence analyzed successfully.');
    } catch (err) {
      console.error('[BlueprintPage] handleAnalyzeCommunityIntelligence error:', err);
      NotificationService.error('Community feedback analysis failed. Please try again.');
    } finally {
      setIsAnalyzingCommunity(false);
    }
  };

  const isLoading = loadingOrg || (Boolean(activeMvpId) && (loadingIdea || loadingBlueprint));

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  // Case 1: No MVP Selected for Workspace
  if (!activeMvpId) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <EmptyState
          icon={<Trophy className="h-10 w-10 text-amber-500" />}
          title="No MVP Selected for this Workspace"
          description="Select an idea as MVP from the Idea Board to create its Blueprint."
          action={
            <Link to={`/workspaces/${orgId}/ideas`}>
              <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                Go to Idea Board & Vote
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Case 2: Referenced MVP was deleted or no longer exists
  if (!mvpIdea || mvpIdea.isDeleted) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <EmptyState
          icon={<AlertTriangle className="h-10 w-10 text-rose-500" />}
          title="Referenced MVP Idea No Longer Exists"
          description="This Blueprint references a workspace proposal that has been removed or deleted."
          action={
            <Link to={`/workspaces/${orgId}/ideas`}>
              <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                Go to Idea Board
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const title = mvpIdea.title || blueprint?.ideaTitle || 'Selected Project';
  const problemStatement = mvpIdea.problemStatement || blueprint?.problemStatement || '';
  const proposedSolution = mvpIdea.proposedSolution || blueprint?.proposedSolution || '';
  const techStack = mvpIdea.techStack || blueprint?.techStack || '';
  const difficultyLevel = mvpIdea.difficultyLevel || blueprint?.difficultyLevel || 'Medium';
  const authorName = mvpIdea.authorName || blueprint?.authorName || 'Team Member';
  const projectStatus = mvpIdea.projectStatus || (mvpIdea.isSelected ? 'Selected MVP' : 'Ideation');

  const isBlueprintCompleted = displayedBlueprint && displayedBlueprint.status === 'completed' && Boolean(displayedBlueprint.content);
  const isBlueprintFailed = displayedBlueprint && displayedBlueprint.status === 'failed' && !isBlueprintCompleted;

  // Form or View Content Source
  const content = isEditing ? editForm : displayedBlueprint?.content;

  // Community Intelligence Data
  const communityData = displayedBlueprint?.communityIntelligence || {
    suggestionsAnalysis: content?.suggestionsAnalysis || [],
    commentsAnalysis: content?.commentsAnalysis || [],
    questionsAnalysis: content?.questionsAnalysis || [],
    communityInsightsSummary: content?.communityInsightsSummary || '',
    communityInsights: { statistics: {}, keyInsights: [] },
  };

  const filterItem = (item) => {
    if (relevanceFilter === 'all') return true;
    return (item.relevance || '').toLowerCase() === relevanceFilter;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 overflow-x-hidden pb-20">
      {/* Historical Version Alert Banner */}
      {isViewingHistorical && (
        <div className="p-4 bg-indigo-950/90 border border-indigo-500/50 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-indigo-200 text-xs shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 font-semibold">
            <History className="h-5 w-5 text-indigo-400 shrink-0" />
            <span>Viewing Historical Blueprint (Version <strong>v{selectedVersionKey}</strong>). You can switch back to the latest version anytime.</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedVersionKey(null)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-none shrink-0"
          >
            Switch to Latest (v{latestVersion})
          </Button>
        </div>
      )}

      {/* Hero MVP Header Card */}
      <Card className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 text-white p-8 shadow-2xl border border-indigo-800/60 relative">
        <div className="absolute top-0 right-0 h-48 w-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none overflow-hidden" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" className="bg-amber-500 text-white font-bold flex items-center gap-1 shadow-md">
                <Trophy className="h-3.5 w-3.5" /> Current Workspace MVP
              </Badge>
              <Badge variant="info" className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                {difficultyLevel} Build
              </Badge>
              <Badge variant="default" className="bg-slate-800 text-slate-200 font-mono text-xs">
                Status: {projectStatus}
              </Badge>

              {/* Version Selector Dropdown for History */}
              {effectiveBlueprintVersions.length > 0 ? (
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-indigo-500/40 px-2.5 py-0.5 rounded-lg shadow-inner">
                  <History className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-[11px] font-mono font-bold text-slate-300">Version:</span>
                  <select
                    value={selectedVersionKey || latestVersion || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === latestVersion || parseFloat(val) === parseFloat(latestVersion)) {
                        setSelectedVersionKey(null);
                      } else {
                        setSelectedVersionKey(val);
                      }
                    }}
                    className="bg-slate-950 text-emerald-300 text-xs font-bold font-mono px-2 py-0.5 rounded border border-emerald-500/40 focus:outline-none cursor-pointer"
                  >
                    {effectiveBlueprintVersions.map((v) => (
                      <option key={v.version} value={v.version}>
                        Version {v.version} - {formatTimestamp(v.generatedAt || v.updatedAt)}{String(v.version) === String(latestVersion) || parseFloat(v.version) === parseFloat(latestVersion) ? ' (Latest)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : displayedBlueprint?.version ? (
                <Badge variant="default" className="bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono text-xs">
                  v{displayedBlueprint.version}
                </Badge>
              ) : null}

              {displayedBlueprint?.lastModifiedSource === 'manual' ? (
                <Badge variant="default" className="bg-amber-950 text-amber-300 border border-amber-800 font-mono text-xs flex items-center gap-1">
                  <Edit3 className="h-3 w-3 text-amber-400" /> Manually Edited
                </Badge>
              ) : displayedBlueprint?.aiProvider ? (
                <Badge variant="default" className="bg-purple-950 text-purple-300 border border-purple-800 font-mono text-xs flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-purple-400" /> Google Gemini ({displayedBlueprint.aiModel || '2.0 Flash'})
                </Badge>
              ) : null}
            </div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight">{title}</h1>

            <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
              <Avatar name={authorName} size="sm" />
              <span>Original Proposal by <strong className="text-white">{authorName}</strong></span>
              <span>·</span>
              <span>Workspace: <strong className="text-white">{org?.name}</strong></span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3 shrink-0">
            <Link to={`/workspaces/${orgId}/ideas/${mvpIdea.ideaId}`}>
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink className="h-4 w-4 text-white" />}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs"
              >
                View Original MVP Idea
              </Button>
            </Link>

            {isBlueprintCompleted ? (
              <div className="flex flex-wrap items-center gap-2 relative">
                {/* PHASE 6 EXPORT DROPDOWN MENU */}
                <div className="relative">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Download className="h-4 w-4 text-indigo-300" />}
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    isLoading={isExportingJson || isExportingPdf}
                    disabled={isGenerating || isSaving}
                    className="bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 border-indigo-800 font-bold text-xs active:scale-95 transition-transform"
                  >
                    Export ▾
                  </Button>

                  {showExportMenu && (
                    <>
                      {/* Mobile Backdrop overlay to close menu when tapping outside */}
                      <div
                        className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
                        onClick={() => setShowExportMenu(false)}
                        onTouchStart={() => setShowExportMenu(false)}
                      />

                      <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-56 max-w-[calc(100vw-2.5rem)] rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 py-1.5 space-y-1 divide-y divide-slate-800/80 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportPdf();
                          }}
                          className="w-full text-left px-4 py-3 text-xs text-slate-200 hover:bg-purple-950/80 active:bg-purple-900 hover:text-white flex items-center gap-2.5 font-bold transition-colors touch-manipulation whitespace-nowrap"
                        >
                          <FileType className="h-4 w-4 text-rose-400 shrink-0" />
                          <span>Export Professional PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportJson();
                          }}
                          className="w-full text-left px-4 py-3 text-xs text-slate-200 hover:bg-purple-950/80 active:bg-purple-900 hover:text-white flex items-center gap-2.5 font-bold transition-colors touch-manipulation whitespace-nowrap"
                        >
                          <FileCode className="h-4 w-4 text-cyan-400 shrink-0" />
                          <span>Export Structured JSON</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {!isEditing ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Edit3 className="h-4 w-4 text-amber-300" />}
                    onClick={handleStartEdit}
                    disabled={isGenerating || isSaving || isExportingJson || isExportingPdf}
                    className="bg-amber-950/80 hover:bg-amber-900 text-amber-200 border-amber-800 font-bold text-xs"
                  >
                    Edit Blueprint
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<X className="h-4 w-4 text-slate-300" />}
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 font-bold text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Save className="h-4 w-4 text-white" />}
                      onClick={handleSaveEdit}
                      isLoading={isSaving}
                      disabled={isSaving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      Save Changes
                    </Button>
                  </>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  icon={<RotateCcw className="h-4 w-4 text-purple-200" />}
                  onClick={handleRegenButtonClick}
                  isLoading={isGenerating}
                  disabled={isGenerating || isSaving || isEditing || isExportingJson || isExportingPdf}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                >
                  Regenerate AI Blueprint
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {/* GENERATION IN PROGRESS CARD */}
      {isGenerating && (
        <Card className="p-8 bg-slate-900 border border-purple-800/80 shadow-2xl text-center space-y-4 relative overflow-hidden">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-950/80 text-purple-400 border border-purple-700/50 shadow-inner">
            <Spinner size="lg" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-black text-white flex items-center justify-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-400 animate-pulse" /> Generating your AI Blueprint...
            </h3>
            <p className="text-xs text-purple-300 font-mono font-semibold transition-all duration-300">
              ⚡ {GENERATION_STAGES[generationStageIndex]}
            </p>
          </div>
        </Card>
      )}

      {/* FAILED GENERATION OR INTERRUPTED STALE RECOVERY CARD */}
      {isBlueprintFailed && !isGenerating && (
        <Card className="p-6 bg-rose-950/30 border border-rose-800/80 text-rose-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-rose-400 shrink-0" />
              <div>
                <h3 className="text-base font-extrabold text-white">Blueprint Generation Interrupted</h3>
                <p className="text-xs text-rose-300">
                  {blueprint?.lastError || 'Blueprint generation was interrupted or timed out. Please click Try Again to start a fresh generation attempt.'}
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleGenerateBlueprint}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shrink-0"
            >
              Try Again
            </Button>
          </div>
        </Card>
      )}

      {/* NOT GENERATED YET PLACEHOLDER CARD */}
      {!isBlueprintCompleted && !isGenerating && !isBlueprintFailed && (
        <Card className="p-8 bg-slate-900 border border-purple-900/60 shadow-xl space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-950 text-purple-400 border border-purple-800">
            <Wand2 className="h-8 w-8 text-purple-400" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h3 className="text-xl font-black text-white">AI Blueprint Not Generated Yet</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              This proposal has been selected as the Workspace MVP. Click below to trigger Google Gemini AI analysis and compile a complete 16-section technical build plan.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            icon={<Sparkles className="h-5 w-5 text-purple-200" />}
            onClick={handleGenerateBlueprint}
            className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-sm shadow-lg px-8 mx-auto"
          >
            Generate AI Blueprint
          </Button>
        </Card>
      )}

      {/* EXECUTIVE SUMMARY & SCOPE (ALWAYS VISIBLE) */}
      <Card className="p-6 space-y-6 bg-slate-900 border border-slate-800">
        <h2 className="text-lg font-bold text-white flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-400" /> Executive Summary & Scope
          </span>
          {isEditing && (
            <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1 bg-amber-950/60 px-3 py-1 rounded-lg border border-amber-800">
              <Edit3 className="h-3.5 w-3.5" /> Editing Section
            </span>
          )}
        </h2>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            📌 Core Problem Statement
          </h3>
          <p className="text-sm text-slate-200 leading-relaxed font-medium bg-slate-950 p-4 rounded-xl border border-slate-800">
            {problemStatement}
          </p>
        </div>

        {isEditing ? (
          <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-amber-900/50">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                Project Vision & Summary
              </label>
              <textarea
                value={editForm?.projectOverview?.summary || ''}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    projectOverview: { ...(prev.projectOverview || {}), summary: e.target.value },
                  }))
                }
                rows={3}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>
          </div>
        ) : content?.projectOverview?.summary ? (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
              🎯 AI Project Overview & Vision
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed bg-purple-950/40 p-4 rounded-xl border border-purple-800/60 font-medium">
              {content.projectOverview.summary}
            </p>
          </div>
        ) : null}
      </Card>

      {/* COMPLETED 16-SECTION AI BLUEPRINT DISPLAY / EDITOR */}
      {isBlueprintCompleted && content && (
        <div className="space-y-6">
          {/* READINESS & METADATA BAR */}
          {content.projectReadiness && (
            <Card className="p-5 bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-black font-mono text-lg border ${
                  content.projectReadiness.score >= 80
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : content.projectReadiness.score >= 60
                    ? 'bg-amber-950 text-amber-400 border-amber-800'
                    : 'bg-rose-950 text-rose-400 border-rose-800'
                }`}>
                  {content.projectReadiness.score}%
                </div>
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Project Readiness Rating</span>
                  <h4 className="text-sm font-extrabold text-white">{content.projectReadiness.readinessLevel}</h4>
                </div>
              </div>

              {blueprint.updatedAt && (
                <div className="text-right text-xs text-slate-400 font-mono">
                  <span>Version {blueprint.version || '1.0'} · {blueprint.lastModifiedSource === 'manual' ? 'Manually edited' : 'Generated'} {formatTimestamp(blueprint.updatedAt)}</span>
                </div>
              )}
            </Card>
          )}

          {/* TABBED NAVIGATION FOR DETAILED SECTIONS */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
            {[
              { id: 'architecture', label: 'Architecture & DB', icon: Cpu },
              { id: 'features', label: 'Features & User Flow', icon: Workflow },
              { id: 'stack', label: 'Recommended Stack', icon: Code },
              { id: 'roadmap', label: 'Roadmap & Scope', icon: GitBranch },
              { id: 'team', label: 'Team & Challenges', icon: Users },
              { id: 'community', label: 'Community Intelligence', icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: ARCHITECTURE & DATABASE DESIGN */}
          {activeTab === 'architecture' && (
            <div className="space-y-6">
              <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-base font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-purple-400" /> Technical Architecture
                  </span>
                </h3>

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1 font-mono">Architecture Pattern</label>
                      <input
                        type="text"
                        value={editForm?.technicalArchitecture?.architecturePattern || ''}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            technicalArchitecture: { ...(prev.technicalArchitecture || {}), architecturePattern: e.target.value },
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1 font-mono">Data Flow Description</label>
                      <textarea
                        value={editForm?.technicalArchitecture?.dataFlowDescription || ''}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            technicalArchitecture: { ...(prev.technicalArchitecture || {}), dataFlowDescription: e.target.value },
                          }))
                        }
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider font-mono">Pattern: </span>
                      <span className="font-extrabold text-purple-300">{content.technicalArchitecture?.architecturePattern}</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed font-medium bg-slate-950 p-4 rounded-xl border border-slate-800">
                      {content.technicalArchitecture?.dataFlowDescription}
                    </p>
                  </div>
                )}
              </Card>

              <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-base font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-purple-400" /> Database Entity Schema
                  </span>
                </h3>

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1 font-mono">Primary Database Engine</label>
                      <input
                        type="text"
                        value={editForm?.databaseDesign?.primaryDatabase || ''}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            databaseDesign: { ...(prev.databaseDesign || {}), primaryDatabase: e.target.value },
                          }))
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 font-mono">Schema Entities (Necessary &amp; Optional):</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Plus className="h-3.5 w-3.5" />}
                          className="text-xs font-bold text-indigo-400 hover:bg-slate-800"
                          onClick={() => {
                            setEditForm((prev) => {
                              const currentDb = prev?.databaseDesign || {};
                              const currentEnts = currentDb.entities || [];
                              return {
                                ...prev,
                                databaseDesign: {
                                  ...currentDb,
                                  entities: [
                                    ...currentEnts,
                                    { entityName: 'NewEntity', entityType: 'Necessary Entity', isOptional: false, fields: ['id', 'created_at'], optionalFields: [] },
                                  ],
                                },
                              };
                            });
                          }}
                        >
                          Add Entity
                        </Button>
                      </div>

                      {editForm?.databaseDesign?.entities?.map((entity, i) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                            <input
                              type="text"
                              value={entity.entityName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditForm((prev) => {
                                  const ents = [...(prev?.databaseDesign?.entities || [])];
                                  ents[i] = { ...ents[i], entityName: val };
                                  return { ...prev, databaseDesign: { ...(prev?.databaseDesign || {}), entities: ents } };
                                });
                              }}
                              placeholder="Entity Name"
                              className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white font-mono"
                            />

                            <select
                              value={entity.isOptional ? 'optional' : 'necessary'}
                              onChange={(e) => {
                                const isOpt = e.target.value === 'optional';
                                setEditForm((prev) => {
                                  const ents = [...(prev?.databaseDesign?.entities || [])];
                                  ents[i] = { ...ents[i], isOptional: isOpt, entityType: isOpt ? 'Optional Entity' : 'Necessary Entity' };
                                  return { ...prev, databaseDesign: { ...(prev?.databaseDesign || {}), entities: ents } };
                                });
                              }}
                              className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white font-mono"
                            >
                              <option value="necessary">Necessary Entity</option>
                              <option value="optional">Optional Entity</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                setEditForm((prev) => {
                                  const ents = (prev?.databaseDesign?.entities || []).filter((_, index) => index !== i);
                                  return { ...prev, databaseDesign: { ...(prev?.databaseDesign || {}), entities: ents } };
                                });
                              }}
                              className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center justify-end gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Remove
                            </button>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 font-mono mb-1">Required Fields (comma-separated):</label>
                            <input
                              type="text"
                              value={Array.isArray(entity.fields) ? entity.fields.join(', ') : ''}
                              onChange={(e) => {
                                const fieldsArr = e.target.value.split(',').map((f) => f.trim()).filter(Boolean);
                                setEditForm((prev) => {
                                  const ents = [...(prev?.databaseDesign?.entities || [])];
                                  ents[i] = { ...ents[i], fields: fieldsArr };
                                  return { ...prev, databaseDesign: { ...(prev?.databaseDesign || {}), entities: ents } };
                                });
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-300 font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-amber-400/80 font-mono mb-1">Optional Fields (comma-separated):</label>
                            <input
                              type="text"
                              value={Array.isArray(entity.optionalFields) ? entity.optionalFields.join(', ') : ''}
                              onChange={(e) => {
                                const optFieldsArr = e.target.value.split(',').map((f) => f.trim()).filter(Boolean);
                                setEditForm((prev) => {
                                  const ents = [...(prev?.databaseDesign?.entities || [])];
                                  ents[i] = { ...ents[i], optionalFields: optFieldsArr };
                                  return { ...prev, databaseDesign: { ...(prev?.databaseDesign || {}), entities: ents } };
                                });
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs text-amber-200/90 font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-400 font-mono mb-4">Primary Database Engine: <strong className="text-white">{content.databaseDesign?.primaryDatabase}</strong></p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {content.databaseDesign?.entities?.map((entity, i) => {
                        const isOptional = entity.isOptional || (entity.entityType && String(entity.entityType).toLowerCase().includes('optional'));
                        return (
                          <div key={i} className={`p-4 rounded-xl bg-slate-950 border space-y-3 ${isOptional ? 'border-amber-900/40' : 'border-emerald-900/40'}`}>
                            <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                              <span className="text-xs font-black text-purple-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                                📦 {entity.entityName}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase tracking-wider ${
                                isOptional ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                {isOptional ? 'Optional Entity' : 'Necessary Entity'}
                              </span>
                            </div>

                            {/* Required Fields */}
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 font-mono block">Required Fields:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {(entity.fields || []).map((field, fIdx) => (
                                  <span key={fIdx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-200 font-mono">
                                    {field}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Optional Fields */}
                            {entity.optionalFields && entity.optionalFields.length > 0 && (
                              <div className="space-y-1 pt-1.5 border-t border-slate-900">
                                <span className="text-[10px] font-bold text-amber-400/80 font-mono block">Optional Fields:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {entity.optionalFields.map((optField, fIdx) => (
                                    <span key={fIdx} className="px-2 py-0.5 rounded bg-amber-950/30 border border-amber-800/40 text-[10px] text-amber-200/90 font-mono">
                                      {optField}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* TAB 2: FEATURES & USER FLOW */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-base font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-purple-400" /> Core Feature Breakdown
                  </span>
                  {isEditing && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          coreFeatures: [...(prev.coreFeatures || []), { featureName: 'New Feature', description: 'Feature description', priority: 'Must Have' }],
                        }))
                      }
                      className="bg-purple-950 hover:bg-purple-900 text-purple-200 border-purple-800 text-xs font-bold"
                    >
                      Add Feature
                    </Button>
                  )}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {content.coreFeatures?.map((feat, i) => (
                    <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 relative group">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={feat.featureName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditForm((prev) => {
                                  const updated = [...(prev.coreFeatures || [])];
                                  updated[i] = { ...updated[i], featureName: val };
                                  return { ...prev, coreFeatures: updated };
                                });
                              }}
                              className="bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white font-bold w-full"
                            />
                            <button
                              onClick={() =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  coreFeatures: (prev.coreFeatures || []).filter((_, idx) => idx !== i),
                                }))
                              }
                              className="text-rose-400 hover:text-rose-300 p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <textarea
                            value={feat.description || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditForm((prev) => {
                                const updated = [...(prev.coreFeatures || [])];
                                updated[i] = { ...updated[i], description: val };
                                return { ...prev, coreFeatures: updated };
                              });
                            }}
                            rows={2}
                            className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{feat.featureName}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              feat.priority === 'Must Have'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            }`}>
                              {feat.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-medium">{feat.description}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 3: RECOMMENDED TECH STACK */}
          {activeTab === 'stack' && (
            <Card className="p-6 bg-slate-900 border border-slate-800 space-y-6">
              <h3 className="text-base font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-purple-400" /> Recommended Technology Stack Evaluation
                </span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'frontend', title: 'Frontend', items: content.recommendedTechStack?.frontend },
                  { key: 'backend', title: 'Backend', items: content.recommendedTechStack?.backend },
                  { key: 'database', title: 'Database', items: content.recommendedTechStack?.database },
                  { key: 'hosting', title: 'Hosting & Cloud', items: content.recommendedTechStack?.hosting },
                  { key: 'thirdPartyApis', title: 'Third-Party APIs', items: content.recommendedTechStack?.thirdPartyApis },
                ].map((stackCategory, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider font-mono">{stackCategory.title}</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {stackCategory.items?.map((item, i) => (
                        <span key={i} className="px-2.5 py-1 rounded bg-purple-950 border border-purple-800 text-xs text-purple-300 font-mono font-bold">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* TAB 4: ROADMAP & SCOPE */}
          {activeTab === 'roadmap' && (
            <div className="space-y-6">
              {content.developmentRoadmap && (
                <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
                  <h3 className="text-base font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="flex items-center gap-2">
                      <GitBranch className="h-5 w-5 text-purple-400" /> Sprint Development Roadmap
                    </span>
                  </h3>
                  <div className="space-y-4">
                    {content.developmentRoadmap.map((phase, i) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-purple-300 font-mono">{phase.phase}</span>
                          <span className="text-[11px] text-slate-400 font-mono font-bold">⏱️ {phase.duration}</span>
                        </div>
                        <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 font-medium pl-1">
                          {phase.deliverables?.map((d, dIdx) => (
                            <li key={dIdx}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB 5: TEAM & CHALLENGES */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              {content.teamAllocation && (
                <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
                  <h3 className="text-base font-extrabold text-white flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-400" /> Strategic Team Allocation
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {content.teamAllocation.map((member, i) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-white">{member.memberName}</span>
                          <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-mono text-[10px] font-bold border border-purple-800">
                            {member.assignedRole}
                          </span>
                        </div>
                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Suggested Tasks:</span>
                          <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                            {member.recommendedTasks?.map((task, tIdx) => <li key={tIdx}>{task}</li>)}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB 6: PHASE 4 COMMUNITY INTELLIGENCE */}
          {activeTab === 'community' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-purple-400" /> Community Intelligence Synthesis
                  </h3>
                  <p className="text-xs text-slate-400">AI relevance classification of suggestions, comments, and questions</p>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  icon={<Sparkles className="h-3.5 w-3.5 text-purple-200" />}
                  onClick={handleAnalyzeCommunityIntelligence}
                  isLoading={isAnalyzingCommunity}
                  disabled={isAnalyzingCommunity || isGenerating || isEditing}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                >
                  Analyze Feedback
                </Button>
              </div>

              {communityData.communityInsights?.statistics && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Suggestions</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-black text-white">
                        {communityData.communityInsights.statistics.suggestionsAnalyzed || 0} analyzed
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {communityData.communityInsights.statistics.suggestionsRelevant || 0} relevant
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Comments</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-black text-white">
                        {communityData.communityInsights.statistics.commentsAnalyzed || 0} analyzed
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {communityData.communityInsights.statistics.commentsRelevant || 0} relevant
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Questions</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-black text-white">
                        {communityData.communityInsights.statistics.questionsAnalyzed || 0} analyzed
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {communityData.communityInsights.statistics.questionsRelevant || 0} relevant
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {communityData.communityInsights?.keyInsights?.length > 0 && (
                <Card className="p-6 bg-slate-900 border border-slate-800 space-y-4">
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                    <Lightbulb className="h-4 w-4 text-amber-400" /> Key Architectural & Product Insights
                  </h4>
                  <div className="space-y-3">
                    {communityData.communityInsights.keyInsights.map((insightObj, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-950 text-purple-300 font-mono font-black text-xs border border-purple-800 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="space-y-1">
                          <p className="text-xs text-slate-200 font-bold leading-relaxed">{insightObj.insight}</p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono text-[10px] border border-slate-800 uppercase font-bold">
                              Category: {insightObj.category || 'architecture'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                              insightObj.impact === 'high' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            }`}>
                              {insightObj.impact || 'medium'} impact
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* REGENERATION WARNING CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={showRegenWarningModal}
        onClose={() => setShowRegenWarningModal(false)}
        onConfirm={handleGenerateBlueprint}
        title="Regenerate Blueprint with AI?"
        description="This Blueprint contains manual edits. Regenerating with AI will replace existing manual changes with a newly generated AI specification. Are you sure you want to proceed?"
        confirmText="Yes, Regenerate"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}
