import { clsx } from 'clsx';
import { useEffect, useRef } from 'react';
import { setFetchWorkerContext } from '@/apis/webFetch';
import { ChatAppSubscriptions } from '@/chat/components/ChatAppSubscriptions';
import { ChatRoutes } from '@/chat/routes';
import DelayRender from '@/componentlibrary/DelayRender';
import { ConsentPopup } from '@/components/ConsentPopup';
import { ConvoHistoryShortcuts } from '@/components/ConvoHistoryShortcuts';
import ConvoList from '@/components/ConvoList';
import { DeviceSyncManager } from '@/components/DeviceSyncManager';
import NavRail from '@/components/NavRail';
import { PanelManager } from '@/components/Panels/PanelManager';
import PreloadedEmojiPicker from '@/components/PreloadedEmojiPicker';
import { useMessageCaches } from '@/lib/cache/context';
import { devErrorTracker } from '@/lib/devErrors';
import { Logger } from '@/lib/logger';
import { checkProtobufsExist } from '@/lib/protobuf';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import { selectIsNavRailEnabled } from '@/store/slices/features';
import { selectActiveModal } from '@/store/slices/modal';
import { selectActiveOverlay } from '@/store/slices/overlay';
import { selectActivePanel } from '@/store/slices/panels';
import { selectActiveConvoId } from '@/store/slices/shared';
import { setUIAppName } from '@/store/slices/uiApp';
import { selectIsMessagesViewActive } from '@/store/slices/uiChat';
import { hydrateTourState } from '@/store/thunks/coachMarks';
import { fetchAllConvoListItems, handleActiveConvoSwitched } from '@/store/thunks/convos';
import {
  hydrateLocalFeatureOverridesFromStorage,
  hydratePreviousLabFeaturesFromStorage,
} from '@/store/thunks/features';
import { loginUser, logoutUser } from '@/store/thunks/identity';
import { setSupportedSdkErrors } from '@/store/thunks/sdkErrorCode';
import { fetchSessionExpiresAt } from '@/store/thunks/session';
import {
  fetchAppProperties,
  fetchAppStage,
  fetchIsAutoUpdateSupported,
  fetchIsGuardEnabled,
} from '@/store/thunks/settings';
import { restoreSavedState } from '@/store/thunks/ui';
import { initAccountState, resetDirectory, updateContacts } from '@/store/thunks/users';
import { MILLISECONDS_PER_HOUR } from '@/utils/date';
import { safeInterval } from '@/utils/safeInterval';

import styles from './ChatContent.module.less';

const logger = new Logger('ChatContainer');

const ChatContainer = () => {
  const isNavRailEnabled = useAppSelector(selectIsNavRailEnabled);
  const isMessagesView = useAppSelector(selectIsMessagesViewActive);
  const activeOverlay = useAppSelector(selectActiveOverlay);
  const activeModal = useAppSelector(selectActiveModal);
  const activePanel = useAppSelector(selectActivePanel);
  const navShortcuts = useFeature('ConvoHistoryShortcuts');
  const dispatch = useAppDispatch();

  useEffect(
    () => () => {
      logger.info('Exiting chat app');
      // In prod, clear identity state so stale data is never visible in the signin app.
      // In dev, skip this so HMR and manual signin-app switching don't wipe the store.
      if (!__DEV__) dispatch(logoutUser());
    },
    [dispatch]
  );

  // cleanup message caches on unmount
  const messageCaches = useMessageCaches();
  useEffect(() => () => messageCaches.clear(), [messageCaches]);

  // Reset directory on an interval to ensure it is fresh
  // safe interval returns the cleanup
  useEffect(
    () =>
      safeInterval(() => {
        dispatch(resetDirectory());
      }, MILLISECONDS_PER_HOUR),
    [dispatch]
  );

  useEffect(() => {
    dispatch(setUIAppName('chat'));
  }, [dispatch]);

  // handle convo switching
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip the initial render when activeConvoId is empty — the URL already
    // encodes the active convo and ChatPage will restore it from params.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!activeConvoId) return;
    }
    dispatch(handleActiveConvoSwitched(activeConvoId));
  }, [dispatch, activeConvoId]);

  const isAlpha = useSetting('isAlpha');
  const isBeta = useSetting('isBeta');
  const isEnterprise = useSetting('isEnterprise');
  const isGovCloudEnabled = useSetting('isGovCloudEnabled');
  const isPro = useSetting('isPro');
  const isProduction = useSetting('isProduction');
  useEffect(() => {
    const ctx = {
      isAlpha,
      isBeta,
      isEnterprise,
      isGovCloudEnabled,
      isPro,
      isProduction,
    };
    setFetchWorkerContext(ctx);
  }, [isAlpha, isBeta, isEnterprise, isGovCloudEnabled, isPro, isProduction]);

  // login user, report error if the self user is not found
  useEffect(() => {
    dispatch(loginUser()).then(
      () => {},
      (reason) => {
        devErrorTracker.addError(
          new Error('Failed to loginUser', { cause: reason }),
          'ChatContainer'
        );
      }
    );
  }, [dispatch]);

  // setup chat app state
  useEffect(() => {
    logger.info('Dispatching chat app');
    dispatch(initAccountState());

    // fetching on load is good for performance because we start
    // on the landing page where before any room fetching takes place
    dispatch(fetchAllConvoListItems());
    dispatch(fetchAppStage());
    dispatch(fetchAppProperties());
    dispatch(updateContacts());
    dispatch(fetchIsAutoUpdateSupported());
    dispatch(hydrateLocalFeatureOverridesFromStorage());
    dispatch(hydratePreviousLabFeaturesFromStorage());
    dispatch(hydrateTourState());
    dispatch(restoreSavedState());

    // Dispatch the thunk to set supported errors in the bridge when initialized
    dispatch(setSupportedSdkErrors());

    dispatch(fetchIsGuardEnabled());
    dispatch(fetchSessionExpiresAt());

    checkProtobufsExist();
  }, [dispatch]);

  return (
    <>
      <ConsentPopup />
      <ChatAppSubscriptions />
      <div
        className={clsx(styles.chatContent)}
        aria-hidden={!!activeOverlay || !!activeModal || !!activePanel}
      >
        {isNavRailEnabled && <NavRail />}
        {isMessagesView && <ConvoList />}
        <ChatRoutes />
      </div>
      <DelayRender mode="idle" maxWait={5000}>
        <PreloadedEmojiPicker />
      </DelayRender>
      <DeviceSyncManager />
      <PanelManager />
      {navShortcuts && <ConvoHistoryShortcuts />}
    </>
  );
};

export default ChatContainer;
