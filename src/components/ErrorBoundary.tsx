import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Log lên console (có thể gửi lên service monitoring sau)
    console.error('🛑 ErrorBoundary caught:', error.message, errorInfo.componentStack?.slice(0, 200));
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">
              Có lỗi xảy ra 😵
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Ứng dụng gặp lỗi không mong muốn. Đừng lo, dữ liệu của anh vẫn an toàn.
            </p>
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                  Chi tiết lỗi
                </summary>
                <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs text-red-600 overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-xl font-bold text-sm transition-colors"
              >
                Thử lại
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-[#FF6D00] hover:bg-[#E66000] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw size={14} />
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}