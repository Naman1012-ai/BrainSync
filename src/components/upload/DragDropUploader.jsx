import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import { uploadthingService } from '../../services/uploadthingService';

export function DragDropUploader({ onDropFile, children, className = '' }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      onDropFile(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative ${className}`}
    >
      {children}

      {/* Visual Dragging Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-indigo-600/90 text-white font-extrabold text-xs rounded-2xl backdrop-blur-xs p-4 border-2 border-dashed border-white shadow-xl transition-all">
          <UploadCloud className="h-8 w-8 mb-2 animate-bounce" />
          <span>Drop file to upload to UploadThing storage</span>
          <span className="text-[10px] font-mono font-normal opacity-80 mt-1">
            Supports Images (10MB), PDFs & Docs (25MB), Archives (50MB)
          </span>
        </div>
      )}
    </div>
  );
}

DragDropUploader.propTypes = {
  onDropFile: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};
