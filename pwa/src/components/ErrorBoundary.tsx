import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.moduleName ?? "app"}]:`, error, info);
    speechEngine.init();
    speechEngine.interrupt(
      `An error occurred${this.props.moduleName ? ` in ${this.props.moduleName}` : ""}. ${error.message}. You can try again or go back.`
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto"
          role="alert"
          aria-live="assertive"
        >
          <svg
            className="w-16 h-16 text-red-400 mb-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-gray-400 text-center mb-6">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <div className="flex gap-3">
            <Button onClick={this.handleRetry}>Try again</Button>
            <Button variant="secondary" onClick={this.handleGoHome}>
              Go home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
