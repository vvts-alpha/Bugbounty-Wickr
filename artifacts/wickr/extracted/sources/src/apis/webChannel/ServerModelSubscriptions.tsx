import { useEffect } from 'react';
import { Logger } from '@/lib/logger';
import { useAppDispatch } from '@/store';
import { setSetting } from '@/store/slices/settings';
import { useWebChannel } from './context';

const logger = new Logger('ServerModelSubscriptions');

// Subscribes to server model signals/properties and connects the handlers
export const ServerModelSubscriptions = () => {
  const { serverModel } = useWebChannel();
  const dispatch = useAppDispatch();

  useEffect(() => {
    // ===========================================
    // Connect signals to handlers
    // ===========================================
    const unsubs: Array<() => void> = [
      serverModel.connectProperty('isWOAProxyConfiguredChanged', async () => {
        const isWOAProxyConfigured = await serverModel.isWOAProxyConfigured();
        logger.info('isWOAProxyConfigured', isWOAProxyConfigured);
        dispatch(setSetting('isWOAProxyConfigured', isWOAProxyConfigured));
      }),

      serverModel.connectProperty('currentHostStatusChanged', async () => {
        const currentHostStatus = await serverModel.currentHostStatus();
        logger.info('currentHostStatus', currentHostStatus);
        dispatch(setSetting('currentHostStatus', currentHostStatus));
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [serverModel, dispatch]);

  return null;
};
