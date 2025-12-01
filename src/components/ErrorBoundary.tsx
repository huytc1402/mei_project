'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-romantic-dark via-romantic-soft to-romantic-light flex items-center justify-center" style={{ backgroundColor: '#0a0e1a' }}>
          <div className="text-center">
            <p className="text-romantic-glow text-xl mb-4">Oops! Có lỗi xảy ra</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-6 py-2 bg-romantic-glow rounded-lg text-white"
            >
              Thử lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}