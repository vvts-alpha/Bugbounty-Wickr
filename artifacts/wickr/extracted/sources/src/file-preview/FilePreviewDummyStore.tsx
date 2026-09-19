import { configureStore, Middleware } from '@reduxjs/toolkit';
import { useMemo } from 'react';
import { Provider } from 'react-redux';
import { Logger } from '@/lib/logger';
import { rootReducer } from '@/store/rootReducer';

const logger = new Logger('dummy-store');

function getActionType(action: unknown): string {
  try {
    if (action) {
      if (typeof action === 'string') {
        return action;
      }
      if (typeof action === 'function') {
        return action.name || 'unknown thunk';
      }
      if (typeof action === 'object' && 'type' in action && typeof action.type === 'string') {
        return action.type;
      }
    }
  } catch {
    // no-op
  }
  return 'unknown';
}

/** Cancel all actions so the state never changes. Must be the first middlware. */
const noActionMiddleware: Middleware = () => (_next) => (action) => {
  logger.error('Attempted to modify the read-only store; canceling action:', getActionType(action));
  // Simply return action without calling next(action)
  // This prevents the action from reaching reducers
  return action;
};

export function configureDummyStore() {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => {
      const middlewares = getDefaultMiddleware();
      return middlewares.prepend(noActionMiddleware);
    },
  });
  return store;
}

/**
 * Wrap the file-preview app with a read-only store in production,
 * so incidental store usage does not break the app. Do not wrap
 * it in dev so that it does crash during development and we can
 * fix the errors.
 */
export const DummyStoreProvider: ReactFC = __DEV__
  ? ({ children }) => children
  : ({ children }) => {
      const store = useMemo(configureDummyStore, []);
      return <Provider store={store}>{children}</Provider>;
    };
