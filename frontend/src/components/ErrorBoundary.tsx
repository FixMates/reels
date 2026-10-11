import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 rounded-3xl bg-slate-900 border border-amber-500/40 text-slate-200 shadow-xl max-w-lg mx-auto text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg text-white">
              {this.props.fallbackTitle || 'Section Display Notice'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              A temporary display error occurred while rendering this section. Your project data is completely safe.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] font-mono text-amber-300/80 mt-2 bg-slate-950 p-2 rounded-lg break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Safe Defaults & Retry</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
