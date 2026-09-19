import { createContext, useContext, useMemo } from 'react';
import { WickrWebChannel } from '.';

/**
 * React Context for WickrWebChannel instance
 * Initialized as undefined to distinguish between "not provided" vs "provided but null"
 */
const WebChannelContext = createContext<WickrWebChannel | undefined>(undefined);

/**
 * Hook to access the WickrWebChannel instance
 * Throws error if used outside of WickrWebChannelProvider
 */
export function useWebChannel(): WickrWebChannel {
  const context = useContext(WebChannelContext);
  if (context === undefined) {
    throw new Error('useWebChannel must be used within WickrWebChannelProvider');
  }
  return context;
}

/**
 * Provider component for WickrWebChannel context
 * Creates a single WickrWebChannel instance and provides it to all child components
 */
export const WickrWebChannelProvider: ReactFC = ({ children }) => {
  const webChannel = useMemo(() => new WickrWebChannel(), []);

  return <WebChannelContext.Provider value={webChannel}>{children}</WebChannelContext.Provider>;
};

/**
 * Test provider that allows injecting a partial mock WickrWebChannel
 * Useful for unit testing components that depend on web channels
 */
export const TestWebChannelProvider: ReactFC<{
  value: DeepPartial<WickrWebChannel>;
}> = ({ children, value }) => {
  return (
    <WebChannelContext.Provider value={value as WickrWebChannel}>
      {children}
    </WebChannelContext.Provider>
  );
};
