import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Textarea } from '../../components/ui/Textarea';
import { Button } from '../../components/ui/Button';
import { Send, Sparkles } from 'lucide-react';

export function AddDiscussionForm({ onSubmit, isSubmitting = false }) {
  const [type, setType] = useState('comment');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSubmit(type, message.trim());
    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" /> Post to Discussion Stream
        </h3>

        {/* Type Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setType('comment')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
              type === 'comment'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            💬 Comment
          </button>
          <button
            type="button"
            onClick={() => setType('suggestion')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
              type === 'suggestion'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-amber-800 hover:text-amber-900'
            }`}
          >
            💡 Suggestion
          </button>
          <button
            type="button"
            onClick={() => setType('question')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
              type === 'question'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-indigo-800 hover:text-indigo-900'
            }`}
          >
            ❓ Question
          </button>
        </div>
      </div>

      <Textarea
        placeholder={
          type === 'suggestion'
            ? '💡 Propose a technical improvement or architecture alternative...'
            : type === 'question'
            ? '❓ Ask an implementation or tech stack question...'
            : '💬 Share your feedback or general thoughts...'
        }
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        required
      />

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={isSubmitting}
          icon={<Send className="h-4 w-4" />}
        >
          Submit {type === 'suggestion' ? 'Suggestion' : type === 'question' ? 'Question' : 'Comment'}
        </Button>
      </div>
    </form>
  );
}

AddDiscussionForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
};
