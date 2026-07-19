import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS classes safely without style collision.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
