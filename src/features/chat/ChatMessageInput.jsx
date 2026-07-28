import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { Send, Paperclip, X, Image as ImageIcon, FileText, AlertCircle } from 'lucide-react';
import { uploadthingService } from '../../services/uploadthingService';
import { AttachmentButton } from '../../components/upload/AttachmentButton';

export function ChatMessageInput({
  onSendMessage,
  isSubmitting = false,
  uploadProgress = 0,
  disabled = false,
}) {
  const [content, setContent] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef(null);

  const handleSelectFile = (file) => {
    if (!file) return;
    setFileError(null);

    const validation = uploadthingService.validateFile(file);
    if (!validation.valid) {
      setFileError(validation.error);
      setPendingFile(null);
      return;
    }

    setPendingFile(file);
  };

  // Clipboard Paste Image Support
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleSelectFile(file);
          break;
        }
      }
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleSelectFile(file);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if ((!content.trim() && !pendingFile) || isSubmitting || disabled) return;

    const fileToUpload = pendingFile;
    const textToSend = content.trim();

    setContent('');
    setPendingFile(null);
    setFileError(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSendMessage(textToSend, fileToUpload);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = content.length;
  const isOverLimit = charCount > 1800;

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative bg-white p-3 border-t border-slate-200 transition-colors ${
        isDragging ? 'bg-indigo-50/80 border-indigo-400' : ''
      }`}
    >
      {/* Drag & Drop Visual Indicator */}
      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-indigo-600/90 text-white font-extrabold text-sm rounded-t-2xl backdrop-blur-xs">
          Drop file to attach via UploadThing
        </div>
      )}

      {/* Error Banner */}
      {fileError && (
        <div className="mb-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{fileError}</span>
          </div>
          <button onClick={() => setFileError(null)} className="p-1 hover:text-rose-900">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Pending UploadThing Attachment Pill */}
      {pendingFile && (
        <div className="mb-2 p-2 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="font-bold text-slate-900 truncate">{pendingFile.name}</span>
            <span className="text-slate-500">({uploadthingService.formatFileSize(pendingFile.size)})</span>
          </div>

          <button
            type="button"
            onClick={() => setPendingFile(null)}
            className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-900"
            title="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* UploadThing Upload Progress Bar */}
      {isSubmitting && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mb-2 space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-indigo-600 font-bold">
            <span>Uploading to UploadThing...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Input Container */}
      <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-300/80 bg-slate-50/60 p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white transition-all shadow-2xs">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value.substring(0, 2000))}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Message #general... (Drag & drop files or paste images)"
          disabled={disabled || isSubmitting}
          rows={2}
          className="w-full resize-none bg-transparent p-1.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none disabled:opacity-50"
        />

        <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 px-1 text-xs">
          <div className="flex items-center gap-2">
            <AttachmentButton onSelectFile={handleSelectFile} disabled={disabled || isSubmitting} />

            <span className={`text-[10px] font-mono font-medium ${isOverLimit ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
              {charCount}/2000
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={(!content.trim() && !pendingFile) || isSubmitting || disabled}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Send Message"
            >
              <span>{isSubmitting ? 'Uploading...' : 'Send'}</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

ChatMessageInput.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
  uploadProgress: PropTypes.number,
  disabled: PropTypes.bool,
};
