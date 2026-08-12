import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../hooks/useAuth';
import { useOrg } from '../../hooks/useOrg';
import { orgService } from '../../services/orgService';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { Trash2, Wifi } from 'lucide-react';

export function OrgMemberList({ onToast = () => {} }) {
  const { user } = useAuth();
  const { org, members, isLeader } = useOrg();

  const [selectedMember, setSelectedMember] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleConfirmRemove = async () => {
    if (!selectedMember || !org) return;

    setIsRemoving(true);
    try {
      await orgService.removeMember(user.uid, org.orgId, selectedMember.uid);
      onToast(`Removed ${selectedMember.displayName} from organization.`);
      setSelectedMember(null);
    } catch (err) {
      onToast(err.message || 'Failed to remove member.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="divide-y divide-slate-100">
        {members.map((member) => {
          const isMemberOwner = member.role === 'owner';
          const isSelf = member.uid === user?.uid;
          const isOnline = member.onlineStatus === 'online';

          return (
            <div key={member.uid} className="flex items-center justify-between py-3.5">
              <div className="flex items-center gap-3">
                <Avatar name={member.displayName} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {member.displayName} {isSelf && '(You)'}
                    </span>
                    <span
                      title={isOnline ? 'Online' : 'Offline'}
                      className={`h-2 w-2 rounded-full ${
                        isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  </div>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={isMemberOwner ? 'info' : 'default'}>
                  {isMemberOwner ? 'Leader' : 'Member'}
                </Badge>

                {isLeader && !isMemberOwner && !isSelf && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => setSelectedMember(member)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Remove Member Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(selectedMember)}
        title="Remove Team Member"
        description={`Are you sure you want to remove ${selectedMember?.displayName} from this organization?`}
        confirmLabel="Remove Member"
        variant="danger"
        isLoading={isRemoving}
        onConfirm={handleConfirmRemove}
        onCancel={() => setSelectedMember(null)}
      />
    </div>
  );
}

OrgMemberList.propTypes = {
  onToast: PropTypes.func,
};
