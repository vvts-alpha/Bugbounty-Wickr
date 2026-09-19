import { useMemo } from 'react';
import { useSetting } from './useSetting';

export const useSelfPresenceIcon = () => {
  // https://code.amazon.com/packages/WickrDesktopApp/blobs/mainline/--/clients/enterprise/qml/UserBadge.qml#L108
  const isPresenceEnabled = useSetting('isPresenceEnabled');
  const isServerConnected = useSetting('isServerConnected');
  const shouldShow = useMemo(
    () => isPresenceEnabled && isServerConnected,
    [isPresenceEnabled, isServerConnected]
  );
  return shouldShow;
};
