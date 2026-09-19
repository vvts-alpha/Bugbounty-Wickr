import { useEffect } from 'react';
import { useWebChannel } from '../context';
import { useAppDispatch } from '@/store';

// Subscribes to compliance connection signals/properties and connects the handlers
export const ComplianceBotSubscriptions = () => {
  const { environmentMgr, wickrSettings } = useWebChannel();
  const dispatch = useAppDispatch();

  useEffect(() => {
    // ===========================================
    // Connect signals to handlers
    // ===========================================

    // TODO: enable these after login is webified, race condition where signal is not received on startup
    const unsubs: Array<() => void> = [
      // environmentMgr.connect('signalComplianceBotFirstSet', async () => {
      //   const isPro = await wickrSettings.getIsPro();
      //   if (isPro) {
      //     dispatch(
      //       pushModal({ name: 'DataRetentionModal', params: { isValid: true } })
      //     );
      //   }
      // }),
      // environmentMgr.connect('signalComplianceBotInvalidName', async () => {
      //   const isPro = await wickrSettings.getIsPro();
      //   if (isPro) {
      //     dispatch(
      //       pushModal({ name: 'DataRetentionModal', params: { isValid: false } })
      //     );
      //   }
      // })
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [environmentMgr, wickrSettings, dispatch]);

  return null;
};
