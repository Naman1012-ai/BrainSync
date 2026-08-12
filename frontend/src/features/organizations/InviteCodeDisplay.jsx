import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../../components/ui/Button';
import { Copy, Check } from 'lucide-react';

export function InviteCodeDisplay({ inviteCode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-900 mb-1">
        Invite Teammates
      </h3>
      <p className="text-sm text-indigo-700 mb-4">
        Share this 8-character invite code with your team to let them join this workspace.
      </p>

      <div className="flex items-center gap-3 max-w-sm">
        <div className="flex-1 rounded-xl border-2 border-dashed border-indigo-300 bg-white px-4 py-2.5 text-center font-mono text-xl font-bold tracking-widest text-indigo-900 select-all">
          {inviteCode || '--------'}
        </div>
        <Button
          variant="primary"
          icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy Code'}
        </Button>
      </div>
    </div>
  );
}

InviteCodeDisplay.propTypes = {
  inviteCode: PropTypes.string,
};
