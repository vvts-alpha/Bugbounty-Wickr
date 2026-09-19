import { KeyboardShortcut } from '../KeyboardShortcut';
import { Button } from '@/componentlibrary';
import { metrics } from '@/lib/metrics';
import { reloadApp } from '@/utils/url';
import { OnErrorEvent, OnErrorProps } from './BaseErrorBoundary';
import styles from './ErrorBoundary.module.less';

function withPrefix(value: any, prefix: string) {
  const str = `${value}`;
  return str.startsWith(prefix) ? str : `${prefix} ${str}`;
}

export const ProdErrorFallback: React.FC<OnErrorProps> = ({ error }) => {
  const hasError = Boolean(error);
  const errorStack = error?.stack;

  // Obtain the file ID, line and column numbers of the place where the error is thrown
  const getErrorCode = () => {
    let errorFile = '';
    try {
      if (errorStack) {
        // Second line of stack looks something like 'at getScrollParent (qrc:/assets/index-67130d0b.js:60:4257)'
        const errorCodeLine = errorStack.split('\n')[1];
        errorFile = errorCodeLine.match(/\((.+)\)/)?.[1] ?? '';
      }
    } catch {
      // no-op
    }
    return errorFile;
  };

  return (
    <div className={styles.errorBoundary}>
      <KeyboardShortcut shortcut="Reload" onShortcut={reloadApp} />
      <h3>{hasError ? withPrefix(`${error}`, 'Error:') : 'Error'}</h3>
      {!!errorStack && <pre className={styles.errorStack}>{`${getErrorCode()}`}</pre>}
      <br />
      <br />
      <Button bordered onClick={reloadApp} autoFocus>
        Reload Wickr
      </Button>
    </div>
  );
};

export function onErrorHandler({ context, id, error, componentStack }: OnErrorEvent) {
  metrics.addCount('WV:UnhandledError', 1, { ...context, error, componentStack, id });
}
