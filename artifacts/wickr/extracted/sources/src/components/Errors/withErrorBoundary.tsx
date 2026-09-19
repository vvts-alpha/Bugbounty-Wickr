import React from 'react';
import { OnErrorProps } from './BaseErrorBoundary';
import ErrorBoundary from './ErrorBoundary';

export type WithErrorBoundaryFallbackProps<T> = OnErrorProps & {
  /** Original props passed to the component */
  originalProps: T;
};

export type WithErrorBoundaryOptions<T> = {
  displayName?: string;
  Fallback?: React.FC<WithErrorBoundaryFallbackProps<T>>;
};

/**
 * Higher-order component that wraps a React component with an error boundary.
 *
 * This HOC provides error handling capabilities to any React component by wrapping it
 * with an ErrorBoundary. When an error occurs in the wrapped component or its children,
 * the error boundary will catch it and display a fallback UI instead of crashing the
 * entire application.
 *
 * @param OriginalComponent - The React component to wrap with error boundary protection
 * @param id - Unique identifier for the error boundary
 * @param options - Optional configuration object
 * @param options.FallbackComponent - Optional custom fallback render function that receives error details and original props.
 * If none provided, uses the default ErrorBoundary fallback UI.
 * @param options.displayName - Optional custom display name for the wrapped component. If not provided,
 * generates one based on the original component's name.
 *
 * @returns A new component that renders the original component wrapped in an ErrorBoundary
 *
 * @example
 * ```tsx
 * // Basic usage with default error UI
 * const SafeMyComponent = withErrorBoundary(MyComponent, 'MyComponent');
 *
 * // With custom fallback UI
 * const SafeMyComponent = withErrorBoundary(
 *   MyComponent,
 *   'MyComponent',
 *   {
 *     FallbackComponent: ({ error, componentStack, props }) => (
 *       <div>
 *         <h2>Something went wrong in MyComponent</h2>
 *         <details>
 *           <summary>Error details</summary>
 *           <pre>{error.message}</pre>
 *           <pre>{componentStack}</pre>
 *         </details>
 *       </div>
 *     )
 *   }
 * );
 *
 * // With custom display name
 * const SafeMyComponent = withErrorBoundary<PropsType>(
 *   (props) => {
 *     // component defined inline has no name
 *   },
 *   'MyInlineComponent',
 *   { displayName: 'MyComponent' }
 * );
 * ```
 */
export function withErrorBoundary<T extends AnyObject>(
  OriginalComponent: React.ComponentType<T>,
  id: string,
  { displayName, Fallback }: WithErrorBoundaryOptions<T> = {}
) {
  const WrapperComponent = React.forwardRef<any, T>((props, ref) => (
    <ErrorBoundary
      id={id}
      Fallback={Fallback ? (event) => <Fallback {...event} originalProps={props} /> : undefined}
    >
      <OriginalComponent {...props} ref={ref} />
    </ErrorBoundary>
  ));

  // This is by design, and doesn't affect tree-shaking
  // eslint-disable-next-line custom-rules/no-production-display-name
  WrapperComponent.displayName =
    displayName ||
    `${OriginalComponent.displayName || OriginalComponent.name || 'Component'}.ErrorBoundary`;

  return WrapperComponent;
}
