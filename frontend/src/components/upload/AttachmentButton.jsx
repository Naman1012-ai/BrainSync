import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Paperclip, Upload } from 'lucide-react';

export function AttachmentButton({
  onSelectFile,
  disabled = false,
  className = '',
  icon: Icon = Paperclip,
  label = 'Attach File',
}) {
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectFile(file);
      // Reset input value so re-uploading the same file works
      e.target.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className={`p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-200/70 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${className}`}
        title={label}
        aria-label={label}
      >
        <Icon className="h-4 w-4" />
      </button>
    </>
  );
}

AttachmentButton.propTypes = {
  onSelectFile: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  icon: PropTypes.elementType,
  label: PropTypes.string,
};
