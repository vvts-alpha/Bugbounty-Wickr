import React from 'react';
import { toError } from '@/utils/error';

export type OnErrorProps = {
  componentStack?: string | null;
  context?: Record<string, string | number>;
  error: Error;
  id: string;
  resetErrorBoundary?: () => void;
};

export type OnErrorEvent = Pick<OnErrorProps, 'componentStack' | 'context' | 'error' | 'id'>;

/**
 * Props for the BaseErrorBoundary component.
 */
export type BaseErrorBoundaryProps = React.PropsWithChildren<{
  /**
   * Fallback UI function to display when an error occurs.
   * Receives error details and returns JSX to render.
   */
  Fallback: React.FC<OnErrorProps>;
  /** Additional context to be reported to metrics */
  context?: Record<string, string | number>;
  /** Unique identifier for this error boundary instance */
  id: string;
  /** Optional callback function called when an error is caught */
  onError?: (props: OnErrorEvent) => void;
}>;

/**
 * Props for components that use error boundaries with optional fallback.
 * Extends React.PropsWithChildren and requires an id while making fallback optional.
 */
export type ErrorBoundaryProps = React.PropsWithChildren<{
  id: string;
  Fallback?: React.FC<OnErrorProps>;
}>;

/**
 * Internal state type for tracking error boundary state.
 */
type StateWithError = {
  /** Whether an error has been caught */
  hasError: true;
  /** The caught error object */
  error: any;
  /** React component stack trace where the error occurred */
  componentStack?: any;
};

type StateNoError = {
  hasError: false;
  error?: never;
  componentStack?: never;
};

type ErrorBoundaryState = StateWithError | StateNoError;

/**
 * A React error boundary component that catches JavaScript errors anywhere in the child
 * component tree, logs those errors, and displays a fallback UI instead of the component
 * tree that crashed.
 *
 * Error boundaries catch errors during rendering, in lifecycle methods, and in constructors
 * of the whole tree below them. They do NOT catch errors for:
 * - Event handlers
 * - Asynchronous code (e.g. setTimeout or requestAnimationFrame callbacks)
 * - Errors thrown during server-side rendering
 * - Errors thrown in the error boundary itself (rather than its children)
 *
 * @example
 * ```tsx
 * // Basic usage with simple fallback
 * <BaseErrorBoundary
 *   id="my-component-boundary"
 *   Fallback={() => <div>Something went wrong!</div>}
 * >
 *   <MyComponent />
 * </BaseErrorBoundary>
 *
 * // Usage with fallback for custom error handling
 * <BaseErrorBoundary
 *   id="advanced-boundary"
 *   Fallback={({ error, componentStack, id }) => (
 *     <div>
 *       <h2>Error in {id}</h2>
 *       <details>
 *         <summary>Error Details</summary>
 *         <pre>{error.message}</pre>
 *         <pre>{componentStack}</pre>
 *       </details>
 *     </div>
 *   )}
 *   onError={({ error, componentStack }) => {
 *     // Custom error reporting
 *     analytics.track('component_error', { error: error.message });
 *   }}
 * >
 *   <ComplexComponent />
 * </BaseErrorBoundary>
 * ```
 *
 * @see {@link https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary}
 */
export class BaseErrorBoundary extends React.Component<BaseErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: BaseErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown) {
    const state = { hasError: true, error: toError(error) };
    return state;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const { id, context } = this.props;
    const componentStack = info.componentStack;
    this.setState({ error: toError(error), componentStack });
    this.props.onError?.({ context, error: toError(error), componentStack, id });
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: undefined, componentStack: '' });
  };

  /**
   * Renders either the fallback UI when an error has occurred, or the children when no error.
   *
   * When an error is present, calls the fallback function with error details and renders the result.
   *
   * @returns The fallback UI if an error occurred, otherwise the children
   */
  render() {
    if (this.state.hasError) {
      const { hasError, ...state } = this.state;
      const { Fallback, onError, children, ...props } = this.props;

      return <Fallback {...state} {...props} resetErrorBoundary={this.resetErrorBoundary} />;
    }

    return this.props.children;
  }
}
