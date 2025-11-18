import { logError } from '@/utils/browser-logger';
import { Component, ComponentChildren } from 'preact';
import { ErrorInfo } from 'preact/compat';
import { ErrorState } from './ui';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

interface ErrorBoundaryProps {
    children: ComponentChildren;
    fallback?: ComponentChildren;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logError('errorBoundary.caughtError', error, {
            componentStack: errorInfo.componentStack,
        });

        this.setState({
            error,
            errorInfo,
        });

        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Note: ErrorState component will use i18n internally
            return <ErrorState error={this.state.error || 'errorBoundary.unexpectedError'} onRetry={this.handleRetry} fullPage />;
        }

        return this.props.children;
    }
}
