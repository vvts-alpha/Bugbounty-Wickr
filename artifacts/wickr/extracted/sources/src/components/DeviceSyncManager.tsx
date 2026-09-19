import { useEffect } from 'react';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  deviceSyncActions,
  selectDeviceSyncCurrentView,
  selectDeviceSyncVerifyKey,
  selectNewDeviceKey,
} from '@/store/slices/deviceSync';
import { pushModal } from '@/store/slices/modal';
import { resetSlice } from '@/store/slices/shared';
import { closeModal, openModal, openAlertModal } from '@/store/thunks/modals';

// handles state changes in deviceSyncSlice.ts
export const DeviceSyncManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const currentView = useAppSelector(selectDeviceSyncCurrentView);
  const newDeviceKey = useAppSelector(selectNewDeviceKey);
  const deviceSyncVerifyKey = useAppSelector(selectDeviceSyncVerifyKey);

  useEffect(() => {
    // is this the current state?
    let current = true;

    const showDidYouJustSignIn = async () => {
      const approved = await dispatch(
        openModal({
          name: 'ConfirmModal',
          params: {
            title: t('Did you just sign-in?'),
            body: t('Your AWS Wickr account is being used to sign-in to a new device.'),
            cancelText: t('Deny'),
            confirmText: t('Approve'),
          },
        })
      ).unwrap();
      if (!current) return;
      if (approved) {
        dispatch(deviceSyncActions.signInApproved());
      } else {
        dispatch(resetSlice('deviceSync'));
      }
    };

    const showErrorModal = (title: string, body: string) => {
      dispatch(
        openAlertModal({
          title,
          body,
          buttonText: t('Done'),
        })
      ).then(() => {
        if (current) {
          dispatch(resetSlice('deviceSync'));
        }
      });
    };

    switch (currentView) {
      case 'Empty':
        return () => {
          current = false;
        };
      case 'DidYouJustSignIn':
        showDidYouJustSignIn();
        return () => {
          current = false;
        };
      case 'ScanQRCode':
        dispatch(pushModal({ name: 'ScanQRCodeModal', params: { newDeviceKey } }));
        return () => {
          current = false;
          dispatch(closeModal('ScanQRCodeModal'));
        };
      case 'EnterCodeManually':
        dispatch(pushModal({ name: 'EnterCodeManuallyModal', params: { deviceSyncVerifyKey } }));
        return () => {
          current = false;
          dispatch(closeModal('EnterCodeManuallyModal'));
        };
      case 'Uploading':
        dispatch(pushModal('SyncingDeviceModal'));
        return () => {
          current = false;
          dispatch(closeModal('SyncingDeviceModal'));
        };
      case 'CodeDoesntMatch':
        showErrorModal(
          t("Code doesn't match"),
          t('To try again resend notification from your new device.')
        );
        return () => {
          current = false;
        };
      case 'UnableToVerifyCode':
        showErrorModal(
          t('Unable to verify code'),
          t('Too many attempts. To try again resend notification from your new device.')
        );
        return () => {
          current = false;
        };
    }
  }, [currentView]);

  return null;
};
