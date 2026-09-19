import { forwardRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { clearOverlay, selectActiveOverlay } from '@/store/slices/overlay';
import { selectActivePanel } from '@/store/slices/panels';
import AppearanceOverlay from './AppearanceOverlay';
import BetaFeaturesOverlay from './BetaFeaturesOverlay';
import BlockedUsersOverlay from './BlockedUsersOverlay';
import CallingOverlay from './CallingOverlay';
import CloseAccountOverlay from './CloseAccountOverlay';
import ConnectivityOverlay from './ConnectivityOverlay';
import DataRetentionOverlay from './DataRetentionOverlay';
import DeviceManagementOverlay from './DeviceManagementOverlay';
import LocationSharingOverlay from './LocationSharingOverlay';
import NotificationsOverlay from './NotificationsOverlay';
import PrivacyAndSafetyOverlay from './PrivacyAndSafetyOverlay';
import SecureShredderOverlay from './SecureShredderOverlay';
import ServerConnectionOverlay from './ServerConnectionOverlay';
import SupportLoggingOverlay from './SupportLoggingOverlay';
import SupportOverlay from './SupportOverlay';
import TranslationOverlay from './TranslationOverlay';
import TwoFAOverlay from './TwoFAOverlay';
import WickrAIOverlay from './WickrAIOverlay';

interface Props {}

export const OverlayManager = forwardRef<HTMLDivElement, Props>((_, ref) => {
  const overlay = useAppSelector(selectActiveOverlay);
  const activePanel = useAppSelector(selectActivePanel);
  const dispatch = useAppDispatch();
  const wickrAIChatEnabled = useFeature('WickrAIChat');

  useEffect(() => {
    if (!activePanel && overlay) {
      dispatch(clearOverlay());
    }
  }, [activePanel, overlay]);
  let component = null;

  switch (overlay) {
    case 'Notifications':
      component = <NotificationsOverlay />;
      break;
    case 'PrivacyAndSafety':
      component = <PrivacyAndSafetyOverlay />;
      break;
    case 'DataRetention':
      component = <DataRetentionOverlay />;
      break;
    case 'Appearance':
      component = <AppearanceOverlay />;
      break;
    case 'Calling':
      component = <CallingOverlay />;
      break;
    case 'TwoFA':
      component = <TwoFAOverlay />;
      break;
    case 'LocationSharing':
      component = <LocationSharingOverlay />;
      break;
    case 'BlockedUsers':
      component = <BlockedUsersOverlay />;
      break;
    case 'SupportLogging':
      component = <SupportLoggingOverlay />;
      break;
    case 'DeviceManagement':
      component = <DeviceManagementOverlay />;
      break;
    case 'Connectivity':
      component = <ConnectivityOverlay />;
      break;
    case 'ServerConnection':
      component = <ServerConnectionOverlay />;
      break;
    case 'BetaFeatures':
      component = <BetaFeaturesOverlay />;
      break;
    case 'Support':
      component = <SupportOverlay />;
      break;
    case 'Translation':
      component = <TranslationOverlay />;
      break;
    case 'CloseAccount':
      component = <CloseAccountOverlay />;
      break;
    case 'SecureShredder':
      component = <SecureShredderOverlay />;
      break;
    case wickrAIChatEnabled && 'WickrAI':
      component = <WickrAIOverlay />;
      break;
  }
  return component ? <div ref={ref}>{component}</div> : null;
});
