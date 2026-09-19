import { useEffect, useState } from 'react';
import { Logger } from '../logger';
import { useWebChannel } from '@/apis/webChannel/context';
import { useAppStore } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { InMemoryTransport } from './InMemoryTransport';
import { WickrMcpClient } from './WickrMcpClient';
import { WickrMcpContext, WickrMcpContextValue } from './WickrMcpContext';
import { WickrMcpServer } from './WickrMcpServer';

const logger = new Logger('WickrMcp');

export const WickrMcpProvider: ReactFC = ({ children }) => {
  const wickrAiEnabled = useFeature('WickrAI');
  const store = useAppStore();
  const webChannel = useWebChannel();
  const [contextValue, setContextValue] = useState<WickrMcpContextValue>({});

  // Set the value via effect since we need to handle tear-down logic
  // This means that we will get +1 render when it gets set up
  useEffect(() => {
    if (wickrAiEnabled) {
      logger.info(`creating mcp server and client`);
      // Create transport pair
      const [clientTransport, serverTransport] = InMemoryTransport.createPair();
      const server = new WickrMcpServer(serverTransport, store, webChannel);
      const client = new WickrMcpClient(clientTransport);
      server.start();
      client.connect();
      setContextValue({ server, client });

      return () => {
        server.dispose();
        client.dispose();
      };
    } else {
      setContextValue({});
    }
  }, [wickrAiEnabled]);

  return <WickrMcpContext.Provider value={contextValue}>{children}</WickrMcpContext.Provider>;
};
