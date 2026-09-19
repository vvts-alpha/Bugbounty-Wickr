import { ReactNode, useEffect, useState } from 'react';
import { Logger } from '@/lib/logger';
import { useWebChannel } from './context';

const logger = new Logger('ChannelReadyManager');

/**
 * Guard component that ensures web channels are initialized before rendering children
 * Prevents race conditions where components try to use channels before they're ready
 *
 * If channels fail to initialize:
 * - Shows errorFallback if provided
 * - Otherwise renders children with degraded functionality (logs error for debugging)
 */
export const ChannelReadyManager: ReactFC<{
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
}> = ({ children, fallback = null, errorFallback }) => {
  const webChannel = useWebChannel();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string>();

  useEffect(() => {
    let mounted = true;

    // Reset to loading state on mount (handles HMR case)
    setStatus('loading');
    setError(undefined);

    logger.debug('Checking channel readiness...');

    // Wait for all critical channels to be ready
    Promise.all([
      webChannel.bridge.whenChannel(),
      webChannel.wickrSettings.whenChannel(),
      webChannel.environmentMgr.whenChannel(),
    ])
      .then(() => {
        if (mounted) {
          logger.info('All critical channels ready');
          setStatus('ready');
        }
      })
      .catch((err) => {
        logger.error('Failed to initialize channels', err);
        if (mounted) {
          setError(err?.message || 'Unknown error');
          setStatus('error');
        }
      });

    return () => {
      mounted = false;
    };
  }, [webChannel]);

  if (status === 'loading') {
    return <>{fallback}</>;
  }

  if (status === 'error') {
    if (errorFallback) {
      logger.warn('Rendering error fallback due to channel initialization failure:', error);
      return <>{errorFallback}</>;
    }
    // Graceful degradation: render children despite error
    logger.warn('Rendering children despite channel initialization failure:', error);
  }

  return <>{children}</>;
};
