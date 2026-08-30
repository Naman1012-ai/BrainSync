import React from 'react';
import PropTypes from 'prop-types';

export function EmptyState({
  icon,
  title,
  description,
  action = null,
  actionLabel = null,
  actionLink = null,
  className = '',
}) {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function' || (typeof icon === 'object' && icon.$$typeof)) {
      const IconComponent = icon;
      return <IconComponent className="h-8 w-8 text-indigo-500" />;
    }
    return null;
  };

  const renderedIcon = renderIcon();

  return (
    <div
      className={`flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center ${className}`}
    >
      {renderedIcon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-400">
          {renderedIcon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="max-w-sm text-sm text-slate-500 mb-6">{description}</p>
      {action && <div>{action}</div>}
      {!action && actionLabel && actionLink && (
        <a
          href={actionLink}
          className="inline-flex items-center justify-center font-medium bg-indigo-600 text-white hover:bg-indigo-700 h-9 px-4 text-xs rounded-lg shadow-sm"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.oneOfType([PropTypes.node, PropTypes.elementType, PropTypes.object, PropTypes.func]),
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  action: PropTypes.node,
  actionLabel: PropTypes.string,
  actionLink: PropTypes.string,
  className: PropTypes.string,
};
