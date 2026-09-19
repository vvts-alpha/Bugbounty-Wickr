import { useEffect } from 'react';
import { Logger } from '@/lib/logger';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectUIAppName } from '@/store/slices/uiApp';
import { signOut } from '@/store/thunks/identity';
import { signingOutGuard } from '@/store/thunks/signingOutGuard';
import { OnboardingPage } from './OnboardingWebChannel';
import { useWebChannel } from './context';

const logger = new Logger('OnboardingSubscriptions');

// Subscribes to onboarding signals/properties and connects the handlers
export const OnboardingSubscriptions = () => {
  const { onboardingBridge } = useWebChannel();
  const dispatch = useAppDispatch();
  const uiAppName = useAppSelector(selectUIAppName);

  useEffect(() => {
    // ===========================================
    // Connect signals to handlers
    // ===========================================

    const unsubs: Array<() => void> = [
      // Connect perpetual signals here. Connect signin UI app only signals in SigninSignalHandlers.ts

      // Handle native-initiated sign out: when the native side signals EnterEmail while we're
      // in the chat app, it means the user has been signed out (e.g. via bridge.signOut()).
      // Dispatch signOut thunk for full coordination: clears persistent storage, resets the
      // store, and navigates based on native session state.
      // Guard against re-entrant calls: if signingOutGuard is set, this signal was emitted
      // by our own bridge.signOut() call — skip it to avoid a second signOut() dispatch.
      onboardingBridge.connect('onboardingPageChanged', (result) => {
        logger.info('onboardingPageChanged:', result);
        if (
          result.page === OnboardingPage.EnterEmail &&
          uiAppName === 'chat' &&
          !signingOutGuard.current
        ) {
          dispatch(signOut());
        }
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [onboardingBridge, dispatch, uiAppName]);

  return null;
};
