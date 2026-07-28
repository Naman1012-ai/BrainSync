import { ref, push, set, update, get } from 'firebase/database';
import { rtdb } from '../config/firebase';
import { rtdbService } from './rtdbService';
import { uploadthingService } from './uploadthingService';

/**
 * Workspace Chat Service
 * Firebase Realtime Database Service Layer for Workspace Team Communication Hub.
 * Uses UploadThing as official binary file storage provider.
 * Schema: /workspaceChats/{workspaceId}/channels/{channelId}/messages/{messageId}
 */

export const chatService = {
  /**
   * Send a message to a workspace channel (Default: 'general').
   * Supports optional UploadThing attachment object.
   */
  sendMessage: async (workspaceId, channelId = 'general', content, user, attachment = null) => {
    if (!workspaceId || !user) {
      throw new Error('Workspace ID and user are required.');
    }

    const trimmedContent = (content || '').trim();

    // Allow empty text if an attachment is provided
    if (!trimmedContent && !attachment) {
      throw new Error('Message content or attachment is required.');
    }

    if (trimmedContent.length > 2000) {
      throw new Error('Message content exceeds the 2000 character limit.');
    }

    const channelPath = `workspaceChats/${workspaceId}/channels/${channelId}/messages`;
    const messagesRef = ref(rtdb, channelPath);
    const newMsgRef = push(messagesRef);
    const messageId = newMsgRef.key;

    const senderName = user.displayName || user.name || user.email?.split('@')[0] || 'Member';
    const senderAvatar = user.photoURL || user.avatar || user.userProfile?.avatar || '';

    const messageData = {
      messageId,
      senderId: user.uid,
      senderName,
      senderAvatar,
      content: trimmedContent,
      createdAt: Date.now(),
      editedAt: null,
      editedBy: null,
      deleted: false,
      isSystem: false,
      systemType: null,
      attachment: attachment ? {
        fileId: attachment.fileId,
        fileName: attachment.fileName || attachment.filename,
        extension: attachment.extension,
        mimeType: attachment.mimeType || 'application/octet-stream',
        size: attachment.size,
        url: attachment.url || attachment.downloadURL,
        uploadthingKey: attachment.uploadthingKey || attachment.storagePath,
        uploadedAt: attachment.uploadedAt || Date.now(),
        uploadedBy: attachment.uploadedBy || user.uid,
        category: attachment.category || 'file',
      } : null,
    };

    // Write message payload to Realtime Database
    await set(newMsgRef, messageData);

    // Update channel metadata for unread tracking & recent activity preview
    const metaPath = `workspaceChats/${workspaceId}/channels/${channelId}/metadata`;
    const previewText = attachment ? `📎 ${attachment.fileName || attachment.filename}` : trimmedContent.substring(0, 100);
    await rtdbService.updateData(metaPath, {
      lastMessageAt: Date.now(),
      lastMessageContent: previewText,
      lastSenderName: senderName,
    }).catch((err) => console.warn('[chatService] Metadata update warning:', err));

    return messageData;
  },

  /**
   * Send an automated system message.
   */
  sendSystemEvent: async (workspaceId, channelId = 'general', text, systemType = 'system') => {
    if (!workspaceId || !text) return;

    try {
      const channelPath = `workspaceChats/${workspaceId}/channels/${channelId}/messages`;
      const messagesRef = ref(rtdb, channelPath);
      const newMsgRef = push(messagesRef);
      const messageId = newMsgRef.key;

      const systemData = {
        messageId,
        senderId: 'system',
        senderName: 'System',
        senderAvatar: '',
        content: text,
        createdAt: Date.now(),
        editedAt: null,
        editedBy: null,
        deleted: false,
        isSystem: true,
        systemType,
        attachment: null,
      };

      await set(newMsgRef, systemData);
      return systemData;
    } catch (err) {
      console.warn('[chatService] Failed to send system event:', err);
    }
  },

  /**
   * Subscribe to real-time channel messages.
   */
  subscribeToMessages: (workspaceId, channelId = 'general', callback) => {
    if (!workspaceId) {
      callback([]);
      return () => {};
    }

    const channelPath = `workspaceChats/${workspaceId}/channels/${channelId}/messages`;
    return rtdbService.subscribe(channelPath, (data) => {
      if (!data || typeof data !== 'object') {
        callback([]);
        return;
      }

      // Convert snapshot map to array & sort ascending by createdAt
      const messageList = Object.values(data)
        .filter((msg) => msg && msg.messageId)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      callback(messageList);
    });
  },

  /**
   * Edit a user's own message content.
   */
  editMessage: async (workspaceId, channelId = 'general', messageId, newContent, userId) => {
    if (!workspaceId || !messageId || !newContent || !newContent.trim()) {
      throw new Error('Message content cannot be empty.');
    }

    const msgPath = `workspaceChats/${workspaceId}/channels/${channelId}/messages/${messageId}`;
    
    // Fetch message to verify sender
    const currentMsg = await rtdbService.getData(msgPath);
    if (!currentMsg) {
      throw new Error('Message not found.');
    }

    if (currentMsg.senderId !== userId) {
      throw new Error('You can only edit your own messages.');
    }

    if (currentMsg.deleted) {
      throw new Error('Deleted messages cannot be edited.');
    }

    const updates = {
      content: newContent.trim(),
      editedAt: Date.now(),
      editedBy: userId,
    };

    await rtdbService.updateData(msgPath, updates);
    return updates;
  },

  /**
   * Delete a message & purge UploadThing storage file if present.
   */
  deleteMessage: async (workspaceId, channelId = 'general', messageId, userId, isWorkspaceAdmin = false) => {
    if (!workspaceId || !messageId) {
      throw new Error('Workspace ID and Message ID are required.');
    }

    const msgPath = `workspaceChats/${workspaceId}/channels/${channelId}/messages/${messageId}`;
    const currentMsg = await rtdbService.getData(msgPath);

    if (!currentMsg) {
      throw new Error('Message not found.');
    }

    // Check authorization: User is sender OR User is Workspace Admin/Owner
    if (currentMsg.senderId !== userId && !isWorkspaceAdmin) {
      throw new Error('You do not have permission to delete this message.');
    }

    // Clean up UploadThing file object if an attachment was associated
    if (currentMsg.attachment && (currentMsg.attachment.uploadthingKey || currentMsg.attachment.storagePath)) {
      const keyToDelete = currentMsg.attachment.uploadthingKey || currentMsg.attachment.storagePath;
      uploadthingService.deleteFile(keyToDelete).catch((e) =>
        console.warn('[chatService] Error cleaning up UploadThing file:', e)
      );
    }

    const updates = {
      deleted: true,
      content: 'This message was deleted',
      attachment: null,
      deletedAt: Date.now(),
      deletedBy: userId,
    };

    await rtdbService.updateData(msgPath, updates);
    return updates;
  },

  /**
   * Subscribe to channel metadata (last message time, count).
   */
  subscribeToChannelMetadata: (workspaceId, channelId = 'general', callback) => {
    if (!workspaceId) {
      callback(null);
      return () => {};
    }
    const metaPath = `workspaceChats/${workspaceId}/channels/${channelId}/metadata`;
    return rtdbService.subscribe(metaPath, callback);
  },
};
