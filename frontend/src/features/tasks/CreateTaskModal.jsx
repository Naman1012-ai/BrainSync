import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { orgService } from '../../services/orgService';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Plus } from 'lucide-react';

export function CreateTaskModal({ isOpen, onClose, onSubmit }) {
  const { orgId } = useParams();
  const [members, setMembers] = useState([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('Todo');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    orgService.getOrganizationMembers(orgId).then((memList) => {
      setMembers(memList || []);
    });
  }, [orgId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    const selectedMember = members.find((m) => m.uid === assignedTo);
    const assignedToName = selectedMember
      ? selectedMember.displayName || selectedMember.email
      : 'Unassigned';

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        assignedTo,
        assignedToName,
        dueDate,
      });

      setTitle('');
      setDescription('');
      setPriority('Medium');
      setStatus('Todo');
      setAssignedTo('');
      setDueDate('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const memberOptions = [
    { value: '', label: 'Unassigned' },
    ...members.map((m) => ({
      value: m.uid,
      label: `${m.displayName || m.email} (${m.role})`,
    })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Actionable Sprint Task" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <Input
          label="Task Title"
          placeholder="e.g., Setup Mapbox GL JS Map Container"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Textarea
          label="Description & Specifications"
          placeholder="Detailed task breakdown, API specifications, or acceptance criteria..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Priority Level"
            options={[
              { value: 'Low', label: 'Low Priority' },
              { value: 'Medium', label: 'Medium Priority' },
              { value: 'High', label: 'High Priority' },
              { value: 'Critical', label: 'Critical Priority' },
            ]}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />

          <Select
            label="Kanban Swimlane Status"
            options={[
              { value: 'Todo', label: 'Todo' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Review', label: 'Review' },
              { value: 'Completed', label: 'Completed' },
            ]}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Assign Team Member"
            options={memberOptions}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          />

          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            icon={<Plus className="h-4 w-4" />}
          >
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}

CreateTaskModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};
