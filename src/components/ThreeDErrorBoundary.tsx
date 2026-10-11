import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Power, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onDisable3D?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ThreeDErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('3D Visualization Error caught by boundary:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="m-3 p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/70 text-slate-200 text-xs space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-rose-300 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>3D Visualization Error</span>
            </div>
            {this.props.onDisable3D && (
              <button
                onClick={this.props.onDisable3D}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-rose-100 text-[11px] font-medium transition-colors cursor-pointer"
                title="Disable 3D visualization and revert to standard 2D view"
              >
                <Power className="w-3 h-3 text-rose-200" />
                <span>Turn 3D OFF</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-rose-200/90 leading-relaxed">
            The 3D renderer encountered an issue with this execution step or device context.
            The standard 2D execution visualizer remains 100% active and unaffected.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Retry 3D Render</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
