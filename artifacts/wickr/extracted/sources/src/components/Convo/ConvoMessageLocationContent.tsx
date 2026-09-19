import { secondsToMilliseconds } from 'date-fns';
import React from 'react';
import { LastLocationIcon, LiveLocationIcon, LockIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useSetting } from '@/store/hooks/useSetting';
import { LocationParams } from '@/store/slices/modal';
import ConvoMessageLocationText from './ConvoMessageLocationText';
import { useIsExpired } from './ExpirationIntervalContext';
import { GeoLocationMap } from './MessageContent/GeoLocationMap';

import styles from './ConvoMessageLocationContent.module.less';

interface ConvoMessageLocationContentProps extends LocationParams {
  onClickLocation?: () => void;
}

interface RenderLiveLocationProps {
  shareExpiration?: number | null;
  lastUpdated?: number | null;
}

export const LiveLocationContentLabel: React.FC<RenderLiveLocationProps> = ({
  shareExpiration,
  lastUpdated,
}) => {
  const { t } = useAppTranslation();
  const isExpired = useIsExpired(shareExpiration ?? 0);

  if (!shareExpiration) return null;
  let liveLocation;

  if (shareExpiration === -1 || isExpired) {
    liveLocation = (
      <>
        <LastLocationIcon className={styles.lastLocationIcon} size="20" />
        {t('Message.Location.LastLocationSent')}
      </>
    );
  } else if (shareExpiration > 0) {
    liveLocation = (
      <>
        <LiveLocationIcon className={styles.liveLocationIcon} size="24" />
        {t('Message.Location.LiveUntil', {
          shareExpiration: secondsToMilliseconds(shareExpiration),
          formatParams: {
            shareExpiration: {
              timeStyle: 'short',
            },
          },
        })}
      </>
    );
  }

  return (
    <div className={styles.tileContent}>
      <div className={styles.liveLocationStatus}>{liveLocation}</div>
      {!!lastUpdated && (
        <div className={styles.lastUpdatedTimestamp}>
          {t('Message.Location.LastUpdated', {
            lastUpdated: lastUpdated,
            formatParams: {
              lastUpdated: {
                timeStyle: 'short',
              },
            },
          })}
        </div>
      )}
    </div>
  );
};

const ConvoMessageLocationContent: React.FC<ConvoMessageLocationContentProps> = ({
  latitude,
  longitude,
  shareExpiration,
  lastUpdated,
  senderName,
  onClickLocation,
}) => {
  const { t } = useAppTranslation();
  const locationEnabled = useSetting('locationEnabled');
  const locationAllowMaps = useSetting('locationAllowMaps');
  const displayMaps = useSetting('displayMaps');

  if (locationEnabled) {
    if (locationAllowMaps && displayMaps) {
      return (
        <div className={styles.convoMessageLocationContent}>
          <GeoLocationMap
            interactive={false}
            longitude={longitude}
            latitude={latitude}
            senderName={senderName}
            onClick={onClickLocation}
          />
          <LiveLocationContentLabel lastUpdated={lastUpdated} shareExpiration={shareExpiration} />
        </div>
      );
    } else {
      return <ConvoMessageLocationText latitude={latitude ?? 0} longitude={longitude ?? 0} />;
    }
  } else {
    return (
      <div className={styles.convoMessageLocationDisabled}>
        <LockIcon size="1.5rem" />
        <p>
          {t(
            'Your administrator has disabled this feature. Please contact your administrator if you think this is an error.'
          )}
        </p>
      </div>
    );
  }
};

const MemoComponent = React.memo(ConvoMessageLocationContent);
if (__DEV__) MemoComponent.displayName = 'ConvoMessageLocationContent';

export default MemoComponent;
