import { useEffect } from 'react';
import { useWebChannel } from '../context';
import { Logger } from '@/lib/logger';
import { useAppDispatch } from '@/store';
import { setSetting } from '@/store/slices/settings';
import { setConnectionStatus } from '@/store/slices/uiChat';

const logger = new Logger('ServerConnectivityTracker');

// Subscribes to server connection signals/properties and connects the handlers
export const ServerConnectivityTracker = () => {
  const { bridge, wickrSettings } = useWebChannel();
  const dispatch = useAppDispatch();

  useEffect(() => {
    // ===========================================
    // Connect signals to handlers
    // ===========================================
    let serverConnectionTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

    const unsubs: Array<() => void> = [
      /**
       * Determines internet connection status. WickrDesktop also controls this status in their UI.
       *
       * When `isServerConnected` changes to `false`, we set status to `"connecting"`
       *
       * After 30s we set status to `"noConnection"`
       *
       * If WOA (Wickr Open Access) setting is enabled, we call `retryWOAProxy()`
       *
       * If `isServerConnected` is `true` then status is `"connected"`
       *
       * WickrDesktop code: https://code.amazon.com/packages/WickrDesktopApp/blobs/400acdea3a1d8c0f53e2abb030ab9c696114ed8c/--/clients/enterprise/qml/ManageNetworkPopDown.qml#L68,L93
       *
       * WickrDesktop `retryWOAProxy()` implementation and comment: https://code.amazon.com/packages/WickrDesktopApp/blobs/7e4880b3808a71c67846d797313101a8813b1651/--/clients/enterprise/wickrquickmain.cpp#L3083
       */
      bridge.connectProperty('isServerConnectedChanged', async () => {
        // Clear the existing timer that was responding to the prev isServerConnected signal
        if (serverConnectionTimeout) {
          clearTimeout(serverConnectionTimeout);
          serverConnectionTimeout = undefined;
        }

        const NO_INTERNET_STATUS_DELAY = 30_000;
        let isServerConnected = await bridge.isServerConnected();
        logger.debug('isServerConnectedChanged', isServerConnected);
        dispatch(setSetting('isServerConnected', isServerConnected));

        if (isServerConnected) {
          dispatch(setConnectionStatus('connected'));
        } else {
          dispatch(setConnectionStatus('connecting'));

          serverConnectionTimeout = setTimeout(async () => {
            isServerConnected = await bridge.isServerConnected();
            logger.debug('serverConnectionTimeout::isServerConnected', isServerConnected);

            // Re-check the server status after the internet status delay
            if (isServerConnected) {
              dispatch(setConnectionStatus('connected'));
              return;
            }

            logger.debug('handleIsServerConnectedChanged::show no network connection banner');
            dispatch(setConnectionStatus('noConnection'));
            const isEnableWOAProxy = await wickrSettings.getIsEnableWOAProxy();
            if (isEnableWOAProxy) {
              bridge.sendRetryWOAProxy();
            }
          }, NO_INTERNET_STATUS_DELAY);

          return;
        }
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
      clearTimeout(serverConnectionTimeout);
    };
  }, [bridge, wickrSettings, dispatch]);

  return null;
};
