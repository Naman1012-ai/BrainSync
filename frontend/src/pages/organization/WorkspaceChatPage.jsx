import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useOrg } from '../../hooks/useOrg';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { chatService } from '../../services/chatService';
import { uploadthingService } from '../../services/uploadthingService';
import { ChatMessageItem } from '../../features/chat/ChatMessageItem';
import { ChatMessageInput } from '../../features/chat/ChatMessageInput';
import { ChatMemberList } from '../../features/chat/ChatMemberList';
import { ChatEmptyState } from '../../features/chat/ChatEmptyState';
import { FilePreviewModal } from '../../features/chat/FilePreviewModal';
import { ConfirmDialog } from '../../components/feedback/ConfirmDialog';
import { Hash, Users } from 'lucide-react';

export default function WorkspaceChatPage() {
  const { orgId } = useParams();
  const { org, members, isLeader, loading: orgLoading } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Modal States
  const [deleteMsgId, setDeleteMsgId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [mobileRosterOpen, setMobileRosterOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const messageListContainerRef = useRef(null);

  // Subscribe to real-time chat messages
  useEffect(() => {
    if (!orgId) return;

    setLoadingMessages(true);
    const unsubscribe = chatService.subscribeToMessages(orgId, 'general', (fetchedMsgs, err) => {
      setMessages(fetchedMsgs || []);
      setLoadingMessages(false);
      if (err && err.code === 'PERMISSION_DENIED') {
        console.warn('[WorkspaceChatPage] Chat subscription permission warning:', err);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [orgId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message handler (Supports Text + File Attachment)
  const handleSendMessage = async (content, file = null) => {
    if (!orgId || !user) return;
    if (!content.trim() && !file) return;

    try {
      setIsSubmitting(true);
      setUploadProgress(0);

      let attachmentData = null;

      // Upload file to UploadThing storage provider if attached
      if (file) {
        attachmentData = await uploadthingService.uploadFile(file, {
          workspaceId: orgId,
          userUid: user?.uid,
          onProgress: (progress) => setUploadProgress(progress),
        });
      }

      await chatService.sendMessage(orgId, 'general', content, user, attachmentData);
      toast.success('Message sent.');
    } catch (err) {
      console.error('[WorkspaceChatPage] Send error:', err);
      toast.error(err.message || 'Failed to send message.');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  // Edit message handler
  const handleEditMessage = async (messageId, newContent) => {
    try {
      await chatService.editMessage(orgId, 'general', messageId, newContent, user.uid);
      toast.success('Message updated.');
    } catch (err) {
      console.error('[WorkspaceChatPage] Edit error:', err);
      toast.error(err.message || 'Failed to update message.');
    }
  };

  // Delete message handlers
  const promptDeleteMessage = (messageId) => {
    setDeleteMsgId(messageId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteMessage = async () => {
    if (!deleteMsgId) return;

    try {
      await chatService.deleteMessage(orgId, 'general', deleteMsgId, user.uid, isLeader);
      toast.success('Message and attachments deleted.');
    } catch (err) {
      console.error('[WorkspaceChatPage] Delete error:', err);
      toast.error(err.message || 'Failed to delete message.');
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteMsgId(null);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = (attachment) => {
    setPreviewAttachment(attachment);
    setIsPreviewModalOpen(true);
  };

  if (orgLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[500px] w-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-md font-sans">
      {/* Central Chat Column */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/40">
        {/* Chat Header Bar */}
        <div className="h-14 px-4 sm:px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Hash className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900 truncate">general</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                  Default Channel
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Team discussion, file sharing & real-time updates for <strong className="text-slate-700">{org?.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile Roster Toggle */}
            <button
              onClick={() => setMobileRosterOpen(!mobileRosterOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
            >
              <Users className="h-4 w-4 text-indigo-600" />
              <span>({members.length})</span>
            </button>
          </div>
        </div>

        {/* Message Stream Area */}
        <div
          ref={messageListContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-1"
        >
          {loadingMessages ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400 font-mono">
              Loading chat messages...
            </div>
          ) : messages.length === 0 ? (
            <ChatEmptyState />
          ) : (
            messages.map((msg, index) => {
              const prevMsg = index > 0 ? messages[index - 1] : null;

              // Check if consecutive messages from same sender within 5 mins
              const isGrouped = Boolean(
                prevMsg &&
                  !prevMsg.isSystem &&
                  !msg.isSystem &&
                  prevMsg.senderId === msg.senderId &&
                  msg.createdAt - prevMsg.createdAt < 5 * 60 * 1000
              );

              return (
                <ChatMessageItem
                  key={msg.messageId || index}
                  message={msg}
                  currentUserId={user?.uid}
                  isWorkspaceAdmin={isLeader}
                  isGrouped={isGrouped}
                  onEdit={handleEditMessage}
                  onDelete={promptDeleteMessage}
                  onOpenPreview={handleOpenPreview}
                />
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <ChatMessageInput
          onSendMessage={handleSendMessage}
          isSubmitting={isSubmitting}
          uploadProgress={uploadProgress}
        />
      </div>

      {/* Desktop Right Member Roster */}
      <div className="hidden lg:block">
        <ChatMemberList members={members} currentUserId={user?.uid} />
      </div>

      {/* Mobile Drawer Member Roster */}
      {mobileRosterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="w-72 h-full bg-white shadow-2xl relative flex flex-col">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <span className="text-xs font-mono font-bold text-slate-900">Workspace Roster</span>
              <button
                onClick={() => setMobileRosterOpen(false)}
                className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close
              </button>
            </div>
            <ChatMemberList members={members} currentUserId={user?.uid} />
          </div>
        </div>
      )}

      {/* File Lightbox / PDF Preview Modal */}
      <FilePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        attachment={previewAttachment}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteMessage}
        title="Delete Message & Attachment"
        message="Are you sure you want to delete this message? Attached files will also be permanently deleted from workspace storage."
        confirmText="Delete Message"
        variant="danger"
      />
    </div>
  );
}
