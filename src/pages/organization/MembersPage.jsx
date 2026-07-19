import React, { useState } from 'react';
import { useOrg } from '../../hooks/useOrg';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Toast } from '../../components/feedback/Toast';
import { InviteCodeDisplay } from '../../features/organizations/InviteCodeDisplay';
import { OrgMemberList } from '../../features/organizations/OrgMemberList';
import { LeaveOrgButton } from '../../features/organizations/LeaveOrgButton';
import { OrgSettingsModal } from '../../features/organizations/OrgSettingsModal';
import { Settings, Users } from 'lucide-react';

export default function MembersPage() {
  const { org, isLeader, members } = useOrg();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  if (!org) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Invite Code Component */}
      <InviteCodeDisplay inviteCode={org.inviteCode} />

      {/* Team Roster Card */}
      <Card>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" /> Team Roster ({members.length} / {org.teamSizeLimit || 5})
          </h2>
        </div>
        <OrgMemberList onToast={(msg) => setToastMessage(msg)} />
      </Card>

      {/* Leave Org Action */}
      <div className="pt-4 text-center">
        <LeaveOrgButton onToast={(msg) => setToastMessage(msg)} />
      </div>

      {/* Org Settings Modal */}
      <OrgSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSuccess={(msg) => setToastMessage(msg)}
      />

      {/* Toast Feedback */}
      <Toast
        type="info"
        message={toastMessage}
        isOpen={Boolean(toastMessage)}
        onClose={() => setToastMessage('')}
      />
    </div>
  );
}
