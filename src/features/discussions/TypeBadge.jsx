import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from '../../components/ui/Badge';
import { MessageCircle, Lightbulb, HelpCircle, CheckCircle } from 'lucide-react';

export function TypeBadge({ type }) {
  switch (type) {
    case 'suggestion':
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <Lightbulb className="h-3 w-3" /> Technical Suggestion
        </Badge>
      );
    case 'question':
      return (
        <Badge variant="info" className="flex items-center gap-1">
          <HelpCircle className="h-3 w-3" /> Question
        </Badge>
      );
    case 'answer':
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" /> Answer
        </Badge>
      );
    default:
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <MessageCircle className="h-3 w-3 text-slate-500" /> Comment
        </Badge>
      );
  }
}

TypeBadge.propTypes = {
  type: PropTypes.string,
};
