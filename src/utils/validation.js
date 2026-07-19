import { CHAR_LIMITS } from '../config/constants';

/**
 * Validates text input length and presence against business rules.
 */
export function validateString(value, maxLength, required = true, fieldName = 'Field') {
  if (!value || typeof value !== 'string') {
    if (required) {
      return { valid: false, error: `${fieldName} is required.` };
    }
    return { valid: true };
  }

  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    return { valid: false, error: `${fieldName} cannot be empty.` };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be at most ${maxLength} characters (currently ${trimmed.length}).`,
    };
  }

  return { valid: true };
}

export function validateIdeaTitle(title) {
  return validateString(title, CHAR_LIMITS.IDEA_TITLE, true, 'Title');
}

export function validateIdeaDescription(desc) {
  return validateString(desc, CHAR_LIMITS.IDEA_DESCRIPTION, true, 'Description');
}

export function validateProblemStatement(ps) {
  return validateString(ps, CHAR_LIMITS.PROBLEM_STATEMENT, true, 'Problem statement');
}

export function validateProposedSolution(sol) {
  return validateString(sol, CHAR_LIMITS.PROPOSED_SOLUTION, false, 'Proposed solution');
}

export function validateComment(content) {
  return validateString(content, CHAR_LIMITS.COMMENT, true, 'Comment');
}

export function validateSuggestion(content) {
  return validateString(content, CHAR_LIMITS.SUGGESTION, true, 'Suggestion');
}

export function validateTaskTitle(title) {
  return validateString(title, CHAR_LIMITS.TASK_TITLE, true, 'Task title');
}

export function validateOrgName(name) {
  return validateString(name, CHAR_LIMITS.ORG_NAME, true, 'Organization name');
}

export function validateDisplayName(name) {
  return validateString(name, CHAR_LIMITS.DISPLAY_NAME, true, 'Display name');
}

export function validateEmail(email) {
  if (!email || !email.trim()) {
    return { valid: false, error: 'Email address is required.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  return { valid: true };
}
