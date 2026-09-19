import { useEffect } from 'react';
import { useWebChannel } from '@/apis/webChannel/context';
import { Logger } from '@/lib/logger';
import { setInviteCodeVerificationErrorMsg } from '@/signin/signinSlice';
import {
  handleCheckEmailResult,
  handleCheckUserExistsResult,
  handleLoadBootstrapFileResult,
  handleLoginResult,
  handleOnboardingPageChanged,
  handleOnboardingPushDeviceSyncVerifyNewDevice,
  handleOnboardingSSOResult,
  handleProcessRegistrationResult,
  handleSSOAccountHandlerResult,
} from '@/signin/signinThunks';
import { useAppDispatch } from '@/store';
import { openAlertModal } from '@/store/thunks/modals';

const logger = new Logger('SigninAppSubscriptions');

// Subscribes to signals/properties and connects the handlers
// For the signin app (not the chat app)
export const SigninAppSubscriptions = () => {
  const { onboardingBridge } = useWebChannel();
  const dispatch = useAppDispatch();

  useEffect(() => {
    // ===========================================
    // Connect signals to handlers
    // ===========================================

    const unsubs: Array<() => void> = [
      onboardingBridge.connect('checkUserExistsResult', (result) => {
        logger.info('checkUserExistsResult', result);
        dispatch(handleCheckUserExistsResult(result));
      }),

      onboardingBridge.connect('onboardingPageChanged', (page) => {
        logger.info('onboardingPageChanged', page);
        dispatch(handleOnboardingPageChanged(page));
      }),

      onboardingBridge.connect('onboardingUsernameExists', (result) => {
        logger.info('usernameExists');
        dispatch(setInviteCodeVerificationErrorMsg(result.message));
      }),

      onboardingBridge.connect('onboardingInvalidInviteCode', (result) => {
        logger.info('invalidInviteCode');
        dispatch(setInviteCodeVerificationErrorMsg(result.message));
      }),

      onboardingBridge.connect('onboardingUsernameInvalid', (result) => {
        logger.info('usernameInvalid');
        dispatch(setInviteCodeVerificationErrorMsg(result.message));
      }),

      onboardingBridge.connect('processRegistrationResult', (result) => {
        dispatch(handleProcessRegistrationResult(result));
      }),

      onboardingBridge.connect('onboardingLoginResult', (result) => {
        dispatch(handleLoginResult(result));
      }),

      onboardingBridge.connect('checkEmailResult', (result) => {
        dispatch(handleCheckEmailResult(result));
      }),

      onboardingBridge.connect('ssoAccountHandlerResult', (result) => {
        dispatch(handleSSOAccountHandlerResult(result));
      }),

      onboardingBridge.connect('onboardingResetDeviceResult', (result) => {
        // only for error, and getting it is very bad (should never happen) if it does the app probably wouldn't work in the first place
        dispatch(openAlertModal({ title: '', body: result.errorMsg }));
      }),

      onboardingBridge.connect('onboardingSSOResult', (result) => {
        dispatch(handleOnboardingSSOResult(result));
      }),

      onboardingBridge.connect('loadBootstrapFileResult', (result) => {
        logger.info('loadBootstrapFileResult', result);
        dispatch(handleLoadBootstrapFileResult(result));
      }),

      onboardingBridge.connect('onboardingPushDeviceSyncVerifyNewDevice', (result) => {
        logger.info('onboardingPushDeviceSyncVerifyNewDevice', result);
        dispatch(handleOnboardingPushDeviceSyncVerifyNewDevice(result.deviceVerifyKey));
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [onboardingBridge, dispatch]);

  return null;
};
