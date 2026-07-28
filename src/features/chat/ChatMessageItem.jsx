import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Pencil, Trash2, Copy, Check, MessageSquare, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { ChatFileCard } from './ChatFileCard';

export function ChatMessageItem({
  message,
  currentUserId,
  isWorkspaceAdmin = false,
  isGrouped = false,
  onEdit = () => {},
  onDelete = () => {},
  onOpenPreview = () => {},
}) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [copied, setCopied] = useState(false);

  const isOwnMessage = message.senderId === currentUserId;
  const canDelete = isOwnMessage || isWorkspaceAdmin;
  const canEdit = isOwnMessage && !message.deleted && !message.isSystem;

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('Message copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editContent.trim()) {
      toast.error('Message content cannot be empty.');
      return;
    }
    onEdit(message.messageId, editContent.trim());
    setIsEditing(false);
  };

  // Format timestamp helper
  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Today at ${formatTime(ts)}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${formatTime(ts)}`;
  };

  // Render System Events distinctly
  if (message.isSystem) {
    return (
      <div className="flex items-center justify-center my-3 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/70 border border-slate-300 text-[11px] font-mono font-medium text-slate-600 shadow-2xs">
          <AlertCircle className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          <span>{message.content}</span>
          <span className="text-[10px] text-slate-400 font-normal">({formatTime(message.createdAt)})</span>
        </div>
      </div>
    );
  }

  // Render Soft-Deleted Message
  if (message.deleted) {
    return (
      <div className={`flex gap-3 px-4 py-1.5 ${isGrouped ? 'pl-14' : 'mt-2'} opacity-60`}>
        {!isGrouped && (
          <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 shrink-0 text-xs font-bold">
            ?
          </div>
        )}
        <div className="flex-1 space-y-1">
          {!isGrouped && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">{message.senderName || 'Member'}</span>
              <span className="text-[10px] text-slate-400 font-mono">{formatDateLabel(message.createdAt)}</span>
            </div>
          )}
          <p className="text-xs italic text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 inline-block">
            🚫 This message was deleted
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative flex gap-3 px-4 py-1.5 hover:bg-slate-100/60 rounded-xl transition-colors ${isGrouped ? 'pl-14' : 'mt-2'}`}>
      {/* Sender Avatar */}
      {!isGrouped && (
        <div className="shrink-0">
          {message.senderAvatar ? (
            <img
              src={message.senderAvatar}
              alt={message.senderName}
              className="h-9 w-9 rounded-full object-cover border border-slate-200 shadow-2xs"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-2xs">
              {(message.senderName || 'M').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      {/* Message Content & Editing State */}
      <div className="flex-1 min-w-0 space-y-1">
        {!isGrouped && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-900">{message.senderName || 'Member'}</span>
            {isOwnMessage && (
              <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-600 border border-indigo-200 text-[10px] font-mono font-bold">
                You
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-mono">{formatDateLabel(message.createdAt)}</span>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-2 pt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-indigo-400 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
              autoFocus
            />
            <div className="flex items-center gap-2 text-xs">
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-1">
            {message.content && (
              <div className="text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-wrap break-words">
                {message.content}
                {message.editedAt && (
                  <span className="ml-2 text-[10px] font-mono text-slate-400 italic" title={`Edited at ${new Date(message.editedAt).toLocaleString()}`}>
                    (Edited)
                  </span>
                )}
              </div>
            )}
            {message.attachment && (
              <ChatFileCard attachment={message.attachment} onOpenPreview={onOpenPreview} />
            )}
          </div>
        )}
      </div>

      {/* Floating Action Menu on Hover */}
      {!isEditing && (
        <div className="absolute right-4 top-2 hidden group-hover:flex items-center gap-1 p-1 rounded-xl bg-white border border-slate-200 shadow-md z-10">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Copy Text"
            aria-label="Copy Text"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          {canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Edit Message"
              aria-label="Edit Message"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}

          {canDelete && (
            <button
              onClick={() => onDelete(message.messageId)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Delete Message"
              aria-label="Delete Message"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

ChatMessageItem.propTypes = {
  message: PropTypes.shape({
    messageId: PropTypes.string.isRequired,
    senderId: PropTypes.string,
    senderName: PropTypes.string,
    senderAvatar: PropTypes.string,
    content: PropTypes.string,
    createdAt: PropTypes.number,
    editedAt: PropTypes.number,
    deleted: PropTypes.bool,
    isSystem: PropTypes.bool,
  }).isRequired,
  currentUserId: PropTypes.string,
  isWorkspaceAdmin: PropTypes.bool,
  isGrouped: PropTypes.bool,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onOpenPreview: PropTypes.func,
};
