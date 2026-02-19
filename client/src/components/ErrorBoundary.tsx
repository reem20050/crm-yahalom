import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleNavigateHome = (): void => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-gray-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl shadow-elevated border border-danger-100 max-w-md w-full p-8 text-center animate-scale-in">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-danger-100 to-danger-50 rounded-full flex items-center justify-center shadow-sm">
                <AlertTriangle className="w-8 h-8 text-danger-600" />
              </div>
            </div>

            <h1 className="text-2xl font-heading font-bold text-gray-900 mb-3">
              שגיאה בלתי צפויה
            </h1>

            <p className="text-gray-500 mb-8 leading-relaxed">
              משהו השתבש. אנחנו מתנצלים על אי הנוחות.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all font-medium shadow-sm"
              >
                רענן עמוד
              </button>
              <button
                onClick={this.handleNavigateHome}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                חזרה לדשבורד
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
