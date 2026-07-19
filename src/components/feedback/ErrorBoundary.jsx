import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../ui/Button';
import { AlertOctagon, RotateCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary Caught Error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-6">
          <div className="rounded-full bg-rose-50 p-4 text-rose-600 border border-rose-100">
            <AlertOctagon className="h-10 w-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
            <p className="text-sm text-slate-500 max-w-md">
              An unexpected error occurred while rendering this workspace panel. Please reload the page or reset the view.
            </p>
            {this.state.error && (
              <pre className="mt-4 rounded-lg bg-slate-50 p-3 text-left font-mono text-xs text-rose-700 max-w-lg overflow-auto border border-slate-200 max-h-40">
                {this.state.error.stack || this.state.error.message || String(this.state.error)}
              </pre>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={this.handleReset}
            icon={<RotateCw className="h-4 w-4" />}
          >
            Reload Component
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};
