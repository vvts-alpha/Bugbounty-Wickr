import { useEffect } from 'react';
import { getUser } from '../webFetch';
import { devErrorTracker } from '@/lib/devErrors';
import { Logger } from '@/lib/logger';
import { WickrUser } from '@/lib/protobuf/users';
import { useAppDispatch } from '@/store';
import { setSelfAttributes } from '@/store/slices/account';
import { setSelfCallStatus, setIsCallShuttingDown } from '@/store/slices/calls';
import { deviceSyncActions } from '@/store/slices/deviceSync';
import { pushModal } from '@/store/slices/modal';
import { setIsOSSleep } from '@/store/slices/os';
import { setSetting, removeActiveDevice } from '@/store/slices/settings';
import { setClientSynchronization } from '@/store/slices/uiChat';
import { incrementAvatarVersion, upsertUsers } from '@/store/slices/users';
import { setChatWindowFocused } from '@/store/slices/windows';
import { processFileStatusChanged } from '@/store/thunks/files';
import { closeModal } from '@/store/thunks/modals';
import { pushSdkErrorModal } from '@/store/thunks/sdkErrorCode';
import { handleReauthenticationResult } from '@/store/thunks/session';
import { bufferUntil } from '@/utils/function';
import { UserChangeMaskValues, WindowFocusedResult } from './BridgeWebChannel';
import { useWebChannel } from './context';

const logger = new Logger('BridgeSubscriptions');

// Subscribes to bridge signals/properties and connects the handlers
export const BridgeSubscriptions = () => {
  const dispatch = useAppDispatch();
  const { bridge } = useWebChannel();

  useEffect(() => {
    // ===========================================
    // Connect bridge signals to handlers
    // ===========================================

    const handleUserUpsert = bufferUntil<[string]>(async (idHashArrays) => {
      logger.debug(`handleUserUpsert: ${idHashArrays.length} users`, idHashArrays);
      const users = (await Promise.allSettled(idHashArrays.map(([idHash]) => getUser(idHash))))
        .map((result) => (result.status === 'fulfilled' ? result.value : null))
        .filter((user): user is WickrUser => !!user);

      if (users.length > 0) {
        dispatch(upsertUsers(users));
      }
    }, 100);

    // TODO: make this a property
    const handleWindowFocusChanged = ({ hasFocus }: WindowFocusedResult) => {
      logger.info('bridge.isWindowFocused()', hasFocus);
      dispatch(setChatWindowFocused(hasFocus));
    };
    bridge.isWindowFocused().then(
      (hasFocus) => {
        handleWindowFocusChanged({ hasFocus });
      },
      (reason) => {
        devErrorTracker.addError(new Error('Failed to check if window focused', { cause: reason }));
      }
    );

    const unsubs: Array<() => void> = [
      bridge.connect('userChanged', (idHash, changeMask) => {
        logger.debug(`handleUserChanged: idHash: ${idHash}, changeMask: ${changeMask}`);
        handleUserUpsert(idHash);

        // Avatar Image Updates
        if (changeMask & UserChangeMaskValues.AvatarChange) {
          dispatch(incrementAvatarVersion(idHash));
        }
      }),

      bridge.connect('userAdded', handleUserUpsert),

      bridge.connect('errorCodeEmitted', (errorInfo) => {
        dispatch(pushSdkErrorModal(errorInfo));
      }),

      bridge.connect('windowFocusChanged', handleWindowFocusChanged),

      bridge.connectProperty('callStatusChanged', async () => {
        const selfCallStatus = await bridge.getSelfCallStatus();
        logger.debug('callStatusChanged', selfCallStatus);
        dispatch(setSelfCallStatus(selfCallStatus));
      }),

      bridge.connectProperty('isCallShuttingDownChanged', async () => {
        const isCallShuttingDown = await bridge.getIsCallShuttingDown();
        logger.debug('isCallShuttingDownChanged', isCallShuttingDown);
        dispatch(setIsCallShuttingDown(isCallShuttingDown));
      }),

      bridge.connect('fileStatusChanged', (payload) => {
        logger.debug('fileStatusChanged', payload);
        dispatch(processFileStatusChanged(payload));
      }),

      bridge.connectProperty('clientSynchronizedChanged', async () => {
        const isSynced = await bridge.clientSynchronized();
        logger.debug('onClientSynchronizedChanged', isSynced);
        dispatch(setClientSynchronization(isSynced));
      }),

      bridge.connect('sleepChanged', (isSleep) => {
        dispatch(setIsOSSleep(isSleep));
      }),

      bridge.connect('devicesChanged', (payload) => {
        if (payload.action === 'added') {
          dispatch(setSetting('activeDevices', payload.devices));
        } else {
          dispatch(removeActiveDevice(payload.appId));
        }
      }),

      bridge.connect('guardEnabledChanged', async () => {
        const result = await bridge.isGuardEnabled();
        dispatch(setSetting('guardEnabled', result));
      }),

      bridge.connect('accountAttributesChanged', async () => {
        const attrs = await bridge.getSelfAccountAttributes();
        dispatch(setSelfAttributes(attrs));
      }),

      bridge.connect('triggerDeviceAddRequest', (acceptMsgBackup, newDeviceKey, hideRequest) => {
        if (!hideRequest) {
          dispatch(deviceSyncActions.triggerDeviceAddRequest(newDeviceKey));
        }
      }),

      bridge.connect('showDeviceSyncingScreen', (shouldShowScreen) => {
        dispatch(deviceSyncActions.showDeviceSyncingScreen(shouldShowScreen));
      }),

      bridge.connect('switchedToCode', (deviceSyncVerifyKey, _supportBackup) => {
        dispatch(deviceSyncActions.switchedToCode(deviceSyncVerifyKey));
      }),

      bridge.connect('atoDeviceAddRequest', (show, code) => {
        dispatch(closeModal('AtoVerificationCodeModal')).then(() => {
          if (show) {
            dispatch(
              pushModal({
                name: 'AtoVerificationCodeModal',
                params: { code },
              })
            );
          }
        });
      }),

      bridge.connectProperty('updateAvailableChanged', async () => {
        const updateAvailable = await bridge.updateAvailable();
        logger.info('updateAvailableChanged', updateAvailable);
        dispatch(setSetting('updateAvailable', updateAvailable));
      }),

      // ideally we want to use connect here since it isn't a property.
      // currently we need to check forcedUpdateAvailable once on startup because the first changed signal can come before web view loaded
      bridge.connectProperty('forcedUpdateChanged', async () => {
        const forcedUpdateAvailable = await bridge.forcedUpdateAvailable();
        if (forcedUpdateAvailable) {
          dispatch(pushModal('ForceUpdateModal'));
        }
      }),

      bridge.connectProperty('brandingLinksChanged', async () => {
        const brandingLinks = await bridge.getBrandingLinks();
        logger.info('brandingLinksChanged', brandingLinks);
        dispatch(setSetting('brandingLinks', brandingLinks));
      }),

      bridge.connect('reauthenticationResult', (result) => {
        logger.info('reauthenticationResult', result);
        dispatch(handleReauthenticationResult(result));
      }),

      bridge.connect('logsReady', (success, content) => {
        logger.info('logsReady', success);
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [bridge, dispatch]);

  return null;
};
