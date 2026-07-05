'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for VRM / Three.js subtrees.
 * Catches WebGL context loss, VRM loader failures, and animation errors
 * without crashing the entire application.
 */
export class VrmErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[VrmErrorBoundary] 3D rendering error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center h-full w-full rounded-xl bg-black/10 text-xs text-foreground/50">
            3D avatar unavailable
          </div>
        )
      );
    }
    return this.props.children;
  }
}

/**
 * Error boundary for the main Three.js canvas.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CanvasErrorBoundary] Canvas error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center h-full w-full rounded-xl bg-black/10 text-xs text-foreground/50">
            Canvas unavailable
          </div>
        )
      );
    }
    return this.props.children;
  }
}
