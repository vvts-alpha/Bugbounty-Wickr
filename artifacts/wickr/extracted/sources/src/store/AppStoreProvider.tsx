import { AnyAction, ListenerMiddlewareInstance } from '@reduxjs/toolkit';
import { useEffect, useMemo, useRef } from 'react';
import { Provider } from 'react-redux';
import { NavigateFunction, useNavigate } from 'react-router';
import { BridgeWebChannelAdapter } from '@/apis/webChannel/BridgeWebChannelAdapter';
import { EnvironmentManagerWebChannelAdapter } from '@/apis/webChannel/EnvironmentManagerWebChannelAdapter';
import { FileManagerWebChannelAdapter } from '@/apis/webChannel/FileManagerWebChannelAdapter';
import { OnboardingWebChannelAdapter } from '@/apis/webChannel/OnboardingWebChannelAdapter';
import { ServerModelWebChannelAdapter } from '@/apis/webChannel/ServerModelWebChannelAdapter';
import { UIBridgeWebChannelAdapter } from '@/apis/webChannel/UIBridgeWebChannelAdapter';
import { WickrSettingsWebChannelAdapter } from '@/apis/webChannel/WickrSettingsWebChannelAdapter';
import { useWebChannel } from '@/apis/webChannel/context';
import { MessageCaches } from '@/lib/cache/MessageCaches';
import { useMessageCaches } from '@/lib/cache/context';
import { AppTranslation, useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { AppStorage } from '@/lib/storage/AppStorage';
import { useAppStorage } from '@/lib/storage/AppStorageProvider';
import { AppStorageData } from '@/lib/storage/models';
import { logDevError } from '@/utils/error';
import { redactInProd } from '@/utils/strings';
import { useListenerMiddleware } from './context';
import {
  subscribeRejectedThunks,
  whenStoreListener,
  WhenStoreListenerOptions,
} from './listeners/listenerMiddleware';
import { AppStore, configureAppStore } from '.';

const logger = new Logger('AppStoreProvider');

// In dev, keep a stable store reference across HMR remounts so Redux state
// (settings, active convo, etc.) survives hot reloads without flashing initialState.
let hmrStore: AppStore | undefined;
let hmrExtraArg: ThunkExtraArgument | undefined;

export interface ThunkExtraArgument {
  storage: AppStorage<AppStorageData>;
  bridge: BridgeWebChannelAdapter;
  environmentMgr: EnvironmentManagerWebChannelAdapter;
  fileManager: FileManagerWebChannelAdapter;
  uiBridge: UIBridgeWebChannelAdapter;
  wickrSettings: WickrSettingsWebChannelAdapter;
  serverModel: ServerModelWebChannelAdapter;
  onboardingBridge: OnboardingWebChannelAdapter;
  messageCaches: MessageCaches;
  navigate: NavigateFunction;
  t: AppTranslation;
  thunkWhenStoreListener: (options: WhenStoreListenerOptions) => Promise<AnyAction | undefined>;
}

export const AppStoreProvider: ReactFC = ({ children }) => {
  const storage = useAppStorage();
  const {
    bridge,
    environmentMgr,
    fileManager,
    uiBridge,
    wickrSettings,
    serverModel,
    onboardingBridge,
  } = useWebChannel();
  const messageCaches = useMessageCaches();
  const navigate = useNavigate();
  const { t } = useAppTranslation();

  const listenerMiddleware: ListenerMiddlewareInstance = useListenerMiddleware();
  const thunkWhenStoreListener = (options: WhenStoreListenerOptions) =>
    whenStoreListener(listenerMiddleware, options);

  const extraArg: ThunkExtraArgument = {
    storage,
    bridge,
    environmentMgr,
    fileManager,
    uiBridge,
    wickrSettings,
    serverModel,
    onboardingBridge,
    messageCaches,
    navigate,
    t,
    thunkWhenStoreListener,
  };
  if (__DEV__ && hmrExtraArg) {
    Object.assign(hmrExtraArg, extraArg);
  }
  const extraArgRef = useRef(hmrExtraArg ?? extraArg);
  Object.assign(extraArgRef.current, extraArg);

  const store: AppStore = useMemo(() => {
    if (__DEV__ && hmrStore) {
      return hmrStore;
    }
    const newStore = configureAppStore({ extraArgument: extraArgRef.current, listenerMiddleware });
    if (__DEV__) {
      hmrStore = newStore;
      hmrExtraArg = extraArgRef.current;
    }
    return newStore;
  }, [listenerMiddleware]);

  useEffect(
    () =>
      subscribeRejectedThunks(listenerMiddleware, (action) => {
        // warn lightly in prod
        logger[__DEV__ ? 'warn' : 'info'](
          'Thunk rejected:',
          action.type,
          redactInProd(action, action.error?.stack ?? action.error?.message ?? '')
        );
        // Propagate up to the dev banner so we can see them in dev
        if (__DEV__) {
          logDevError(
            new Error(`Thunk rejected: "${action.type}". See console for details`),
            logger
          );
        }
      }),
    [listenerMiddleware]
  );

  return <Provider store={store}>{children}</Provider>;
};

export const TestAppStoreProvider: ReactFC<{ value: DeepPartial<AppStore> }> = ({
  children,
  value,
}) => {
  return <Provider store={value as AppStore}>{children}</Provider>;
};
