import { createContext } from 'react';
import { WickrMcpClient } from './WickrMcpClient';
import { WickrMcpServer } from './WickrMcpServer';

export type WickrMcpContextValue = {
  client?: WickrMcpClient;
  server?: WickrMcpServer;
};

export const WickrMcpContext = createContext<WickrMcpContextValue>({
  client: undefined,
  server: undefined,
});
