import { FC } from 'react';
import { BaseErrorBoundary, ErrorBoundaryProps } from './BaseErrorBoundary';
import { DevErrorFallback } from './devErrors';
import { ProdErrorFallback, onErrorHandler } from './prodErrors';

/* v8 ignore start */
const DevErrorBoundary: FC<ErrorBoundaryProps> = ({ children, Fallback: Fallback, ...props }) => (
  <BaseErrorBoundary
    {...props}
    Fallback={(errorProps) => {
      if (Fallback) {
        return <Fallback {...errorProps} />;
      }

      return <DevErrorFallback {...errorProps} prodError={<ProdErrorFallback {...errorProps} />} />;
    }}
    onError={onErrorHandler}
  >
    {children}
  </BaseErrorBoundary>
);
/* v8 ignore stop */

const ProdErrorBoundary: FC<ErrorBoundaryProps> = ({ children, Fallback: Fallback, ...props }) => (
  <BaseErrorBoundary {...props} Fallback={Fallback ?? ProdErrorFallback} onError={onErrorHandler}>
    {children}
  </BaseErrorBoundary>
);

const ErrorBoundary = __DEV__ ? DevErrorBoundary : ProdErrorBoundary;

export default ErrorBoundary;
