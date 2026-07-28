import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Users, Crown, ShieldCheck, UserCheck, Search } from 'lucide-react';

export function ChatMemberList({ members = [], currentUserId }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredMembers = members.filter((m) => {
    const name = m.name || m.displayName || m.email || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="w-64 h-full border-l border-slate-200 bg-white flex flex-col shrink-0 font-sans">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-mono font-bold text-slate-900 uppercase tracking-wider">
              Workspace Team ({members.length})
            </h3>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Member Roster List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {filteredMembers.map((member) => {
          const isMe = member.uid === currentUserId;
          const isLeader = member.role === 'leader' || member.isLeader || member.role === 'owner';
          const name = member.name || member.displayName || member.email?.split('@')[0] || 'Team Member';
          const avatar = member.avatar || member.photoURL || '';

          return (
            <div
              key={member.uid || member.id}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Avatar & Online Dot */}
                <div className="relative shrink-0">
                  {avatar ? (
                    <img src={avatar} alt={name} className="h-8 w-8 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" title="Active in Workspace" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                    <span>{name}</span>
                    {isMe && <span className="text-[10px] text-slate-400 font-normal">(You)</span>}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono capitalize">
                    {isLeader ? 'Workspace Owner' : member.role || 'Member'}
                  </p>
                </div>
              </div>

              {/* Role Badge */}
              {isLeader ? (
                <Crown className="h-4 w-4 text-amber-500 shrink-0" title="Workspace Owner" />
              ) : (
                <UserCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
            </div>
          );
        })}

        {filteredMembers.length === 0 && (
          <p className="text-center py-6 text-xs text-slate-400 italic">No members found.</p>
        )}
      </div>
    </div>
  );
}

ChatMemberList.propTypes = {
  members: PropTypes.arrayOf(
    PropTypes.shape({
      uid: PropTypes.string,
      name: PropTypes.string,
      displayName: PropTypes.string,
      email: PropTypes.string,
      role: PropTypes.string,
    })
  ),
  currentUserId: PropTypes.string,
};
