import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useOrg } from '../../hooks/useOrg';
import { useAuth } from '../../hooks/useAuth';
import { orgService } from '../../services/orgService';
import { rtdbService } from '../../services/rtdbService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { PageHeader } from '../../components/layout/PageHeader';
import { Toast } from '../../components/feedback/Toast';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { formatTimestamp } from '../../utils/formatting';
import {
  Settings,
  Users,
  Shield,
  Sliders,
  Info,
  AlertTriangle,
  Save,
  RotateCcw,
  UserCheck,
  UserX,
  LogOut,
  Trash2,
  Lock,
  Globe,
} from 'lucide-react';

export default function SettingsPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { org, members: contextMembers, loading: orgLoading } = useOrg();
  const { user } = useAuth();

  // Settings State
  const [generalSettings, setGeneralSettings] = useState({
    name: '',
    hackathonDescription: '',
    hackathonName: '',
    hackathonTheme: '',
    hackathonLocation: '',
    startDate: '',
    endDate: '',
    teamSizeLimit: 5,
  });

  const [preferences, setPreferences] = useState({
    enableRealtime: true,
    enableNotifications: false,
    defaultIdeaSort: 'Most Votes',
    defaultTaskView: 'Board',
    autoArchiveMvps: false,
  });

  const [members, setMembers] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState('member');
  
  // Stats — loaded progressively in background
  const [workspaceStats, setWorkspaceStats] = useState({
    ideasCount: 0,
    tasksCount: 0,
    completedTasksCount: 0,
    activeMvpTitle: 'None',
  });

  // Validation
  const [validationErrors, setValidationErrors] = useState({});

  // UI States — split into primary (instant) and stats (background)
  const [primaryReady, setPrimaryReady] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Dialog Confirmations
  const [confirmLeave, setConfirmLeave] = useState(false);
  
  // Delete Workspace Confirmation steps
  const [deleteStep, setDeleteStep] = useState(0); // 0 = closed, 1 = warning, 2 = type name, 3 = final
  const [typedOrgName, setTypedOrgName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Phase 1: Hydrate from OrgContext (instant — zero network calls)
  useEffect(() => {
    if (!org || !user || !contextMembers) return;

    setGeneralSettings({
      name: org.name || '',
      hackathonDescription: org.hackathonDescription || '',
      hackathonName: org.hackathonName || 'Hackathon',
      hackathonTheme: org.hackathonTheme || '',
      hackathonLocation: org.hackathonLocation || '',
      startDate: org.startDate || '',
      endDate: org.endDate || '',
      teamSizeLimit: org.teamSizeLimit || 5,
    });

    setMembers(contextMembers);
    const currentMember = contextMembers.find((m) => m.uid === user.uid);
    setCurrentUserRole(currentMember?.role || 'member');
    setPrimaryReady(true);
  }, [org, user, contextMembers]);

  // Phase 2: Load preferences + stats in parallel (background)
  useEffect(() => {
    if (!orgId || !org) return;

    let active = true;

    async function loadSecondary() {
      setStatsLoading(true);
      try {
        // Parallel fetch: preferences + ideas count + tasks count + MVP title
        const [prefs, ideas, tasks] = await Promise.all([
          orgService.getWorkspacePreferences(orgId),
          rtdbService.getData(`ideas/${orgId}`),
          rtdbService.getData(`tasks/${orgId}`),
        ]);

        if (!active) return;

        // Preferences
        if (prefs) {
          setPreferences({
            enableRealtime: prefs.enableRealtime ?? true,
            enableNotifications: prefs.enableNotifications ?? false,
            defaultIdeaSort: prefs.defaultIdeaSort || 'Most Votes',
            defaultTaskView: prefs.defaultTaskView || 'Board',
            autoArchiveMvps: prefs.autoArchiveMvps ?? false,
          });
        }

        // Stats computation
        const ideasObj = ideas || {};
        const tasksObj = tasks || {};
        const activeTasks = Object.values(tasksObj).filter((t) => t && !t.isDeleted);
        const completedTasks = activeTasks.filter((t) => t.status === 'done' || t.status === 'completed');

        let mvpTitle = 'None';
        if (org.activeProjectId && ideasObj[org.activeProjectId]) {
          mvpTitle = ideasObj[org.activeProjectId].title || 'Untitled';
        }

        if (active) {
          setWorkspaceStats({
            ideasCount: Object.keys(ideasObj).filter((k) => ideasObj[k] && !ideasObj[k].isDeleted).length,
            tasksCount: activeTasks.length,
            completedTasksCount: completedTasks.length,
            activeMvpTitle: mvpTitle,
          });
        }
      } catch (err) {
        console.error('[SettingsPage] error loading secondary data:', err);
      } finally {
        if (active) setStatsLoading(false);
      }
    }

    loadSecondary();

    return () => {
      active = false;
    };
  }, [orgId, org]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Validation helper
  const validateGeneralSettings = () => {
    const errors = {};
    if (!generalSettings.name || generalSettings.name.trim().length === 0) {
      errors.name = 'Workspace name is required.';
    } else if (generalSettings.name.trim().length > 60) {
      errors.name = 'Workspace name must be 60 characters or fewer.';
    }
    if (!generalSettings.hackathonName || generalSettings.hackathonName.trim().length === 0) {
      errors.hackathonName = 'Hackathon name is required.';
    } else if (generalSettings.hackathonName.trim().length > 80) {
      errors.hackathonName = 'Hackathon name must be 80 characters or fewer.';
    }
    if (generalSettings.hackathonTheme && generalSettings.hackathonTheme.length > 100) {
      errors.hackathonTheme = 'Theme must be 100 characters or fewer.';
    }
    if (generalSettings.hackathonDescription && generalSettings.hackathonDescription.length > 500) {
      errors.hackathonDescription = 'Description must be 500 characters or fewer.';
    }
    if (generalSettings.startDate && generalSettings.endDate && generalSettings.startDate > generalSettings.endDate) {
      errors.endDate = 'End date must be after start date.';
    }
    const size = Number(generalSettings.teamSizeLimit);
    if (!size || size < 1 || size > 50) {
      errors.teamSizeLimit = 'Team size must be between 1 and 50.';
    }
    return errors;
  };

  const handleGeneralSave = async (e) => {
    e.preventDefault();
    if (currentUserRole === 'member') return;

    const errors = validateGeneralSettings();
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      showToast('Please fix validation errors before saving.', 'error');
      return;
    }

    setSavingGeneral(true);
    try {
      await orgService.updateOrganizationGeneralSettings(orgId, generalSettings);
      showToast('General settings updated successfully.');
    } catch (err) {
      showToast(err.message || 'Failed to save general settings.', 'error');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handlePreferencesSave = async (e) => {
    e.preventDefault();
    if (currentUserRole === 'member') return;

    setSavingPreferences(true);
    try {
      await orgService.updateWorkspacePreferences(orgId, preferences);
      showToast('Preferences updated successfully.');
    } catch (err) {
      showToast(err.message || 'Failed to save preferences.', 'error');
    } finally {
      setSavingPreferences(false);
    }
  };

  // Member Management Actions
  const handleRoleChange = async (targetUid, currentRole, action) => {
    if (currentUserRole !== 'owner') {
      showToast('Only the Owner can promote or demote members.', 'error');
      return;
    }

    try {
      let nextRole = 'member';
      if (action === 'promote') nextRole = 'admin';
      
      await orgService.updateMemberRole(orgId, targetUid, nextRole);
      
      // Update local state
      setMembers((prev) =>
        prev.map((m) => (m.uid === targetUid ? { ...m, role: nextRole } : m))
      );
      showToast(`Member role updated successfully.`);
    } catch (err) {
      showToast(err.message || 'Failed to modify role.', 'error');
    }
  };

  const handleRemoveMember = async (targetUid, memberName) => {
    const isOwner = currentUserRole === 'owner';
    const isAdmin = currentUserRole === 'admin';

    if (!isOwner && !isAdmin) {
      showToast('Unauthorized role.', 'error');
      return;
    }

    try {
      await orgService.removeMemberFromWorkspace(orgId, targetUid);
      setMembers((prev) => prev.filter((m) => m.uid !== targetUid));
      showToast(`Removed ${memberName} from workspace.`);
    } catch (err) {
      showToast(err.message || 'Failed to remove member.', 'error');
    }
  };

  const handleTransferOwnership = async (newOwnerUid, newOwnerName) => {
    if (currentUserRole !== 'owner') return;

    try {
      await orgService.transferWorkspaceOwnership(orgId, user.uid, newOwnerUid);
      setCurrentUserRole('admin');
      
      // Update local list
      setMembers((prev) =>
        prev.map((m) => {
          if (m.uid === user.uid) return { ...m, role: 'admin' };
          if (m.uid === newOwnerUid) return { ...m, role: 'owner' };
          return m;
        })
      );
      showToast(`Ownership transferred to ${newOwnerName}. You are now an Admin.`);
    } catch (err) {
      showToast(err.message || 'Failed to transfer ownership.', 'error');
    }
  };

  // Danger Zone Handlers
  const handleLeaveWorkspace = async () => {
    try {
      await orgService.leaveWorkspace(orgId, user.uid);
      showToast('You left the workspace.');
      navigate('/dashboard');
    } catch (err) {
      showToast(err.message || 'Failed to leave workspace.', 'error');
    }
  };

  const handleDeleteWorkspace = async () => {
    setIsDeleting(true);
    try {
      await orgService.markWorkspaceForDeletion(orgId);
      showToast('Workspace marked for deletion. It will be permanently removed in 7 days.', 'success');
      navigate('/dashboard');
    } catch (err) {
      showToast(err.message || 'Failed to schedule workspace deletion.', 'error');
      setIsDeleting(false);
      setDeleteStep(0);
    }
  };

  // Compute progress percentage memoized at top level
  const progressPercentage = useMemo(() => {
    if (workspaceStats.tasksCount === 0) return 0;
    return Math.round((workspaceStats.completedTasksCount / workspaceStats.tasksCount) * 100);
  }, [workspaceStats.tasksCount, workspaceStats.completedTasksCount]);

  if (orgLoading || !primaryReady) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <LoadingSkeleton variant="profile" />
      </div>
    );
  }

  const isOwner = currentUserRole === 'owner';
  const isAdmin = currentUserRole === 'admin';
  const isReadOnly = currentUserRole === 'member';

  return (
    <div className="space-y-10 max-w-4xl mx-auto pb-16">
      {/* Section 1 - General Settings */}
      <Card className="p-6 bg-white border border-slate-200/80 shadow-sm relative">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
          <Settings className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-900">General Information</h2>
          {isReadOnly && (
            <Badge variant="default" className="ml-auto bg-slate-100 text-slate-500 flex items-center gap-1 border-none font-bold">
              <Lock className="h-3 w-3" /> Read Only
            </Badge>
          )}
        </div>

        <form onSubmit={handleGeneralSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Workspace Name"
              value={generalSettings.name}
              onChange={(e) => { setGeneralSettings({ ...generalSettings, name: e.target.value }); setValidationErrors((prev) => ({ ...prev, name: undefined })); }}
              required
              disabled={isReadOnly}
              maxLength={60}
              error={validationErrors.name}
            />
            <Input
              label="Hackathon Name"
              value={generalSettings.hackathonName}
              onChange={(e) => { setGeneralSettings({ ...generalSettings, hackathonName: e.target.value }); setValidationErrors((prev) => ({ ...prev, hackathonName: undefined })); }}
              required
              disabled={isReadOnly}
              maxLength={80}
              error={validationErrors.hackathonName}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Hackathon Theme (Optional)"
              value={generalSettings.hackathonTheme}
              onChange={(e) => { setGeneralSettings({ ...generalSettings, hackathonTheme: e.target.value }); setValidationErrors((prev) => ({ ...prev, hackathonTheme: undefined })); }}
              disabled={isReadOnly}
              maxLength={100}
              error={validationErrors.hackathonTheme}
            />
            <Input
              label="Hackathon Location"
              value={generalSettings.hackathonLocation}
              onChange={(e) => setGeneralSettings({ ...generalSettings, hackathonLocation: e.target.value })}
              required
              disabled={isReadOnly}
            />
          </div>

          <Textarea
            label="Description"
            rows={3}
            value={generalSettings.hackathonDescription}
            onChange={(e) => { setGeneralSettings({ ...generalSettings, hackathonDescription: e.target.value }); setValidationErrors((prev) => ({ ...prev, hackathonDescription: undefined })); }}
            disabled={isReadOnly}
            placeholder="Provide a description of the hackathon workspace goals..."
            maxLength={500}
            error={validationErrors.hackathonDescription}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Input
              label="Start Date"
              type="date"
              value={generalSettings.startDate}
              onChange={(e) => setGeneralSettings({ ...generalSettings, startDate: e.target.value })}
              disabled={isReadOnly}
            />
            <Input
              label="End Date"
              type="date"
              value={generalSettings.endDate}
              onChange={(e) => { setGeneralSettings({ ...generalSettings, endDate: e.target.value }); setValidationErrors((prev) => ({ ...prev, endDate: undefined })); }}
              disabled={isReadOnly}
              error={validationErrors.endDate}
            />
            <Input
              label="Max Team Size"
              type="number"
              min={1}
              max={50}
              value={generalSettings.teamSizeLimit}
              onChange={(e) => { setGeneralSettings({ ...generalSettings, teamSizeLimit: Number(e.target.value) }); setValidationErrors((prev) => ({ ...prev, teamSizeLimit: undefined })); }}
              required
              disabled={isReadOnly}
              error={validationErrors.teamSizeLimit}
            />
          </div>

          {/* Read-Only Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
            <div>
              <span className="font-semibold block text-slate-400">Workspace ID</span>
              <span className="font-mono">{org.orgId}</span>
            </div>
            <div>
              <span className="font-semibold block text-slate-400">Created On</span>
              <span>{formatTimestamp(org.createdAt)}</span>
            </div>
            <div>
              <span className="font-semibold block text-slate-400">Invite Code</span>
              <span className="font-bold text-indigo-600 font-mono tracking-wider">{org.inviteCode}</span>
            </div>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                type="submit"
                loading={savingGeneral}
                icon={<Save className="h-4 w-4" />}
              >
                Save Changes
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setGeneralSettings({
                    name: org.name || '',
                    hackathonDescription: org.hackathonDescription || '',
                    hackathonName: org.hackathonName || 'Hackathon',
                    hackathonTheme: org.hackathonTheme || '',
                    hackathonLocation: org.hackathonLocation || '',
                    startDate: org.startDate || '',
                    endDate: org.endDate || '',
                    teamSizeLimit: org.teamSizeLimit || 5,
                  });
                }}
                icon={<RotateCcw className="h-4 w-4" />}
              >
                Cancel
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* Section 2 - Members & Roles */}
      <Card className="p-6 bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
          <Users className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-900">Members & Roles</h2>
          <span className="ml-auto text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">
            {members.length} / {generalSettings.teamSizeLimit} Members
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((member) => {
            const isSelf = member.uid === user.uid;
            
            return (
              <div key={member.uid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <Avatar name={member.displayName} size="md" />
                  <div>
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      {member.displayName}
                      {isSelf && <span className="text-[10px] bg-indigo-50 text-indigo-600 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">You</span>}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{member.email}</p>
                    {member.joinedAt && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Joined {formatTimestamp(member.joinedAt)}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={member.role === 'owner' ? 'success' : member.role === 'admin' ? 'info' : 'default'}>
                    {member.role.toUpperCase()}
                  </Badge>

                  {/* Actions depending on Role rules */}
                  {!isSelf && !isReadOnly && (
                    <div className="flex items-center gap-1.5">
                      {/* Owner permissions */}
                      {isOwner && (
                        <>
                          {member.role === 'member' && (
                            <button
                              onClick={() => handleRoleChange(member.uid, member.role, 'promote')}
                              className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 transition-colors text-xs flex items-center gap-1 font-bold"
                              title="Promote to Admin"
                            >
                              <Shield className="h-3.5 w-3.5" /> Promote
                            </button>
                          )}
                          {member.role === 'admin' && (
                            <button
                              onClick={() => handleRoleChange(member.uid, member.role, 'demote')}
                              className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 transition-colors text-xs flex items-center gap-1 font-bold"
                              title="Demote to Member"
                            >
                              <UserX className="h-3.5 w-3.5" /> Demote
                            </button>
                          )}
                          <button
                            onClick={() => handleTransferOwnership(member.uid, member.displayName)}
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors text-xs flex items-center gap-1 font-bold"
                            title="Transfer Ownership"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Transfer
                          </button>
                        </>
                      )}

                      {/* Owner or Admin can remove member (Admins cannot remove owners/admins) */}
                      {(isOwner || (isAdmin && member.role === 'member')) && (
                        <button
                          onClick={() => handleRemoveMember(member.uid, member.displayName)}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors text-xs flex items-center gap-1 font-bold"
                          title="Remove Member"
                        >
                          <UserX className="h-3.5 w-3.5" /> Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Section 3 - Workspace Preferences */}
      <Card className="p-6 bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
          <Sliders className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-900">Workspace Preferences</h2>
          {isReadOnly && (
            <Badge variant="default" className="ml-auto bg-slate-100 text-slate-500 flex items-center gap-1 border-none font-bold">
              <Lock className="h-3 w-3" /> Read Only
            </Badge>
          )}
        </div>

        <form onSubmit={handlePreferencesSave} className="space-y-6">
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.enableRealtime}
                onChange={(e) => setPreferences({ ...preferences, enableRealtime: e.target.checked })}
                disabled={isReadOnly}
                className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-bold text-slate-900 block">Realtime synchronization</span>
                <span className="text-xs text-slate-500">Instantly update cards and board actions as they occur.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.enableNotifications}
                onChange={(e) => setPreferences({ ...preferences, enableNotifications: e.target.checked })}
                disabled={isReadOnly}
                className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-bold text-slate-900 block">Email Notifications</span>
                <span className="text-xs text-slate-500">Notify me about task deadlines, blueprint updates, and discussion activities.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.autoArchiveMvps}
                onChange={(e) => setPreferences({ ...preferences, autoArchiveMvps: e.target.checked })}
                disabled={isReadOnly}
                className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-bold text-slate-900 block">Auto-Archive Completed MVP Projects</span>
                <span className="text-xs text-slate-500">Move task boards and proposals into records immediately when marked Done.</span>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <Select
              label="Idea Board Default Sorting"
              value={preferences.defaultIdeaSort}
              onChange={(e) => setPreferences({ ...preferences, defaultIdeaSort: e.target.value })}
              disabled={isReadOnly}
              options={[
                { value: 'Latest', label: 'Latest' },
                { value: 'Most Votes', label: 'Most Votes' },
                { value: 'Most Active', label: 'Most Active' },
              ]}
            />
            <Select
              label="Task Board Default View"
              value={preferences.defaultTaskView}
              onChange={(e) => setPreferences({ ...preferences, defaultTaskView: e.target.value })}
              disabled={isReadOnly}
              options={[
                { value: 'Board', label: 'Board (Kanban)' },
                { value: 'List', label: 'List (Backlog)' },
              ]}
            />
          </div>

          {!isReadOnly && (
            <div className="pt-2">
              <Button
                variant="primary"
                type="submit"
                loading={savingPreferences}
                icon={<Save className="h-4 w-4" />}
              >
                Save Preferences
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* Section 4 - Workspace Information */}
      <Card className="p-6 bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
          <Info className="h-5 w-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-900">Workspace Information</h2>
          {statsLoading && (
            <span className="ml-auto text-[10px] text-slate-400 font-semibold animate-pulse">Loading stats...</span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-xs">
          <div>
            <span className="text-slate-400 block font-semibold mb-1">Current Stage</span>
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
              org.status === 'project' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {org.status === 'project' ? 'Sprint Phase' : 'Ideation Phase'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Active MVP</span>
            <span className="font-bold text-slate-900 truncate block max-w-[200px]" title={workspaceStats.activeMvpTitle}>
              {workspaceStats.activeMvpTitle}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Progress</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-xs font-black text-slate-900">{progressPercentage}%</span>
            </div>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Ideas</span>
            <span className="text-sm font-black text-slate-900">{workspaceStats.ideasCount} Proposed</span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Tasks</span>
            <span className="text-sm font-black text-slate-900">{workspaceStats.completedTasksCount}/{workspaceStats.tasksCount} Done</span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Members</span>
            <span className="text-sm font-black text-slate-900">{members.length} Members</span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Created By</span>
            <span className="font-bold text-slate-900 truncate block max-w-[200px]">
              {members.find((m) => m.uid === org.ownerId)?.displayName || 'Team Leader'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Created On</span>
            <span>{org.createdAt ? formatTimestamp(org.createdAt) : 'Unknown'}</span>
          </div>

          <div>
            <span className="text-slate-400 block font-semibold mb-1">Last Updated</span>
            <span>{org.updatedAt ? formatTimestamp(org.updatedAt) : 'Never'}</span>
          </div>
        </div>
      </Card>

      {/* Section 5 - Danger Zone */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <h2 className="text-lg font-bold text-rose-600">Danger Zone</h2>
        </div>

        <Card className="p-6 bg-rose-50/30 border border-rose-200 rounded-2xl space-y-6">
          {/* Leave Workspace Option */}
          {!isOwner && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-100/50 pb-6">
              <div className="space-y-1 max-w-xl">
                <h4 className="text-sm font-extrabold text-slate-900">Leave Workspace</h4>
                <p className="text-xs text-slate-500">
                  You will lose access to this team's blueprints, ideas, and tasks. All comments, ideas, and tasks created by you will remain intact.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setConfirmLeave(true)}
                icon={<LogOut className="h-4 w-4" />}
                className="bg-white border-slate-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 shrink-0 font-bold"
              >
                Leave Workspace
              </Button>
            </div>
          )}

          {/* Delete Workspace Option */}
          {isOwner && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <h4 className="text-sm font-extrabold text-slate-900">Delete Workspace</h4>
                <p className="text-xs text-slate-500">
                  Permanently delete this workspace. This will destroy:
                </p>
                <ul className="text-xs text-slate-500 list-disc list-inside mt-1 space-y-0.5">
                  <li>Workspace metadata &amp; settings</li>
                  <li>All proposed ideas</li>
                  <li>Discussions &amp; suggestions</li>
                  <li>Votes &amp; vote history</li>
                  <li>Project blueprint</li>
                  <li>Sprint tasks &amp; assignments</li>
                  <li>Activity history</li>
                  <li>Member relationships</li>
                </ul>
                <p className="text-xs font-bold text-rose-600 mt-1.5">
                  This action CANNOT be undone.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setDeleteStep(1)}
                icon={<Trash2 className="h-4 w-4" />}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold border-none shadow-sm shadow-rose-200 shrink-0"
              >
                Delete Workspace
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Confirm Leave Workspace Dialog */}
      <ConfirmDialog
        isOpen={confirmLeave}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={handleLeaveWorkspace}
        title="Leave Workspace?"
        description="Are you sure you want to leave this hackathon team workspace? You will need an invite code to rejoin."
        confirmLabel="Leave Workspace"
        cancelLabel="Cancel"
      />

      {/* Delete Workspace Step 1: Warning Dialog */}
      <ConfirmDialog
        isOpen={deleteStep === 1}
        onCancel={() => setDeleteStep(0)}
        onConfirm={() => setDeleteStep(2)}
        title="⚠️ Delete Workspace permanently?"
        description={`You are about to delete "${org.name}". This will wipe out all ideas, blueprint boards, tasks, comments, and members. Are you sure you want to proceed?`}
        confirmLabel="Yes, Proceed"
        cancelLabel="No, Cancel"
      />

      {/* Delete Workspace Step 2: Name Verification Dialog */}
      {deleteStep === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <Card className="max-w-md w-full bg-white p-6 border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-rose-600 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Verification Required
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              To confirm deletion, please type the exact workspace name below:
              <strong className="block mt-1 font-mono text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-100 text-center select-all">
                {org.name}
              </strong>
            </p>
            <Input
              value={typedOrgName}
              onChange={(e) => setTypedOrgName(e.target.value)}
              placeholder="Type workspace name..."
              className="mb-6 font-semibold"
            />
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <Button variant="ghost" onClick={() => setDeleteStep(0)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => setDeleteStep(3)}
                disabled={typedOrgName !== org.name}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Continue Deletion
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Workspace Step 3: Final confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteStep === 3}
        onCancel={() => setDeleteStep(0)}
        onConfirm={handleDeleteWorkspace}
        isLoading={isDeleting}
        title="🚨 Final Confirmation"
        description={`Last warning: there is no undo. Clicking confirm will destroy the workspace "${org.name}" permanently. Proceed?`}
        confirmLabel="Confirm Permanent Delete"
        cancelLabel="No, Keep Workspace"
      />

      {/* Feedback Toast */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
}
