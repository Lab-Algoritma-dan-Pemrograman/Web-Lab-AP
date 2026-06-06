import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private toggleDetails = () => {
    this.setState((prevState) => ({ showDetails: !prevState.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-6 font-sans">
          {/* Background Decorative Blur Gradients */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

          {/* Error Card */}
          <div className="relative z-10 w-full max-w-xl bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl text-center overflow-hidden">
            {/* Header Icon */}
            <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>

            {/* Error Title */}
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Ups! Terjadi Kesalahan Sistem
            </h1>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-8">
              Aplikasi mengalami gangguan rendering yang tidak terduga. Jangan khawatir, data Anda tetap aman.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                Segarkan Halaman
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-sm border border-slate-700 transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
              >
                <Home className="w-4 h-4" />
                Kembali ke Beranda
              </button>
            </div>

            {/* Technical Details (Expandable) */}
            {this.state.error && (
              <div className="border-t border-slate-800/80 pt-6 text-left">
                <button
                  onClick={this.toggleDetails}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors duration-150 focus:outline-none"
                >
                  {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {this.state.showDetails ? "Sembunyikan detail teknis" : "Tampilkan detail teknis"}
                </button>

                {this.state.showDetails && (
                  <div className="mt-4 p-4 bg-slate-950/80 border border-slate-800 rounded-lg overflow-x-auto text-[11px] font-mono text-slate-400 leading-relaxed max-h-48 scrollbar-thin scrollbar-thumb-slate-800">
                    <p className="font-semibold text-amber-500/90 mb-1">
                      Error: {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="whitespace-pre-wrap mt-2">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
