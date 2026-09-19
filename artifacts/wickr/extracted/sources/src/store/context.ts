import { ListenerMiddlewareInstance } from '@reduxjs/toolkit';
import { createContext, useContext } from 'react';
import { createAppListenerMiddleware } from './listeners/listenerMiddleware';

const ListenerMiddlewareContext = createContext(createAppListenerMiddleware());

export function useListenerMiddleware(): ListenerMiddlewareInstance {
  return useContext(ListenerMiddlewareContext);
}
