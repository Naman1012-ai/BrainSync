import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { validateIdeaTitle, validateProblemStatement } from '../../utils/validation';
import { CHAR_LIMITS } from '../../config/constants';

export function IdeaForm({ initialValues = null, onSubmit, isSubmitting = false, onCancel }) {
  const [title, setTitle] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [proposedSolution, setProposedSolution] = useState('');
  const [techStack, setTechStack] = useState('');
  const [difficultyLevel, setDifficultyLevel] = useState('Medium');

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialValues) {
      setTitle(initialValues.title || '');
      setProblemStatement(initialValues.problemStatement || '');
      setProposedSolution(initialValues.proposedSolution || '');
      setTechStack(initialValues.techStack || '');
      setDifficultyLevel(initialValues.difficultyLevel || 'Medium');
    }
  }, [initialValues]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const titleVal = validateIdeaTitle(title);
    const probVal = validateProblemStatement(problemStatement);

    if (!titleVal.valid || !probVal.valid) {
      setErrors({
        title: titleVal.error,
        problemStatement: probVal.error,
      });
      return;
    }

    setErrors({});
    onSubmit({
      title: title.trim(),
      problemStatement: problemStatement.trim(),
      proposedSolution: proposedSolution.trim(),
      techStack: techStack.trim(),
      difficultyLevel,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Idea Title"
        placeholder="Short, catchy title for your proposal..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        maxLength={CHAR_LIMITS.IDEA_TITLE}
        required
      />

      <Textarea
        label="Problem Statement"
        placeholder="What problem does this solve? Describe the background and user pain point..."
        value={problemStatement}
        onChange={(e) => setProblemStatement(e.target.value)}
        error={errors.problemStatement}
        maxLength={CHAR_LIMITS.PROBLEM_STATEMENT}
        rows={4}
        required
      />

      <Textarea
        label="Proposed Solution"
        placeholder="How would your project solve it? Detail the proposed architecture..."
        value={proposedSolution}
        onChange={(e) => setProposedSolution(e.target.value)}
        maxLength={CHAR_LIMITS.PROPOSED_SOLUTION}
        rows={4}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Tech Stack (Optional)"
          placeholder="e.g., React, Python, Mapbox, OpenCV"
          value={techStack}
          onChange={(e) => setTechStack(e.target.value)}
        />

        <Select
          label="Technical Difficulty"
          options={[
            { value: 'Easy', label: 'Easy — Quick prototype' },
            { value: 'Medium', label: 'Medium — Moderate build' },
            { value: 'Hard', label: 'Hard — Complex / Hardcore' },
          ]}
          value={difficultyLevel}
          onChange={(e) => setDifficultyLevel(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {initialValues ? 'Save Changes' : 'Submit Idea'}
        </Button>
      </div>
    </form>
  );
}

IdeaForm.propTypes = {
  initialValues: PropTypes.shape({
    title: PropTypes.string,
    problemStatement: PropTypes.string,
    proposedSolution: PropTypes.string,
    techStack: PropTypes.string,
    difficultyLevel: PropTypes.string,
  }),
  onSubmit: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
  onCancel: PropTypes.func,
};
