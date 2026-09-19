import { devToolsEnhancer } from '@redux-devtools/remote';
import {
  ActionCreatorWithPayload,
  AsyncThunk,
  configureStore,
  ListenerMiddlewareInstance,
  StoreEnhancer,
} from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector, useStore } from 'react-redux';
import { Logger } from '@/lib/logger';
import { isQt } from '@/utils/platform';
import { ThunkExtraArgument } from './AppStoreProvider';
import { activeConvoSyncMiddleware } from './middleware/activeConvoSyncMiddleware';
import { AppRootState } from './models';
import { rootReducer } from './rootReducer';

if (__DEV__) {
  import('./dev-utils');
}

const logger = new Logger('store');

export type ConfigureAppStoreOptions = {
  extraArgument: ThunkExtraArgument;
  listenerMiddleware?: ListenerMiddlewareInstance;
  preloadedState?: AppRootState;
};

export function configureAppStore({
  extraArgument,
  listenerMiddleware,
  preloadedState,
}: ConfigureAppStoreOptions) {
  const listenWare = listenerMiddleware?.middleware;

  let devTools = false;
  const enhancers: StoreEnhancer[] = [];
  if (__DEV__) {
    // To use redux dev tools in Qt
    if (isQt()) {
      devTools = false;
      enhancers.push(devToolsEnhancer({ realtime: true, port: 8000, maxAge: 100 }));
    } else {
      devTools = true;
    }
  }

  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => {
      const middlewares = getDefaultMiddleware({
        thunk: {
          extraArgument: extraArgument,
        },
        serializableCheck: __DEV__,
      }).concat(activeConvoSyncMiddleware);
      return listenWare ? middlewares.prepend(listenWare) : middlewares;
    },
    devTools,
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers().concat(enhancers),
  });

  // WIP
  if (import.meta.hot) {
    import.meta.hot.accept(['./rootReducer'], ([rootReducerModule]) => {
      // or? import.meta.hot?.invalidate();
      if (rootReducerModule) {
        store.replaceReducer(rootReducerModule.rootReducer);
      }
    });
  }

  return store;
}

export type AppStore = ReturnType<typeof configureAppStore>;

export type AppDispatch = AppStore['dispatch'];

export type AppAction = Parameters<AppDispatch>[0];

export type ThunkOrActionCreatorWithPayload<Payload> =
  | ActionCreatorWithPayload<Payload>
  | AsyncThunk<any, Payload, any>;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<AppRootState> = useSelector;
export const useAppStore = useStore<AppRootState>;

type AppSelectorExtra<Args extends any[], Returns> = (
  state: AppRootState,
  ...args: Args
) => Returns;

/** Convenience hook for useAppSelector when the selector requires extra arguments */
export const useAppSelectorExtra = <Args extends any[], Returns>(
  selector: AppSelectorExtra<Args, Returns>,
  ...args: Args
) => {
  return useAppSelector((state) => selector(state, ...args));
};
