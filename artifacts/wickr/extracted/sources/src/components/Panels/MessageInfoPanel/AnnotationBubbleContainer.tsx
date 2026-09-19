import { clsx } from 'clsx';
import { HTMLAttributes, forwardRef } from 'react';
import { useIsExpired } from '@/components/Convo/ExpirationIntervalContext';
import { ExpirationTime } from '@/components/Convo/ExpirationTime';
import { useAppTranslation } from '@/lib/i18n';
import { WickrMessage, WickrOutboxStatus, WickrSourceDevice } from '@/lib/protobuf/messages';
import { useAppDispatch } from '@/store';
import { popPanel } from '@/store/slices/panels';
import { RelativeTime } from '@/utils/date';
import AnnotationBubble from './AnnotationBubble';

import styles from './AnnotationBubbleContainer.module.less';

const SOURCE_DEVICE_NAMES: { [key: number]: string } = {
  [WickrSourceDevice.IOS]: 'iOS',
  [WickrSourceDevice.ANDROID]: 'Android',
  [WickrSourceDevice.MACOS]: 'MacOS',
  [WickrSourceDevice.LINUX]: 'Linux',
  [WickrSourceDevice.WINDOWS]: 'Windows',
};

export interface AnnotationBubbleContainerProps extends HTMLAttributes<HTMLDivElement> {
  message: WickrMessage;
}

export const AnnotationBubbleContainer = forwardRef<HTMLDivElement, AnnotationBubbleContainerProps>(
  ({ className, message, ...rest }, ref) => {
    const dispatch = useAppDispatch();
    const isExpired = useIsExpired(message.destructTime);
    const { t } = useAppTranslation();
    if (isExpired || message.outboxStatus !== WickrOutboxStatus.Outbox_Sent) {
      return null;
    }

    const onExpirationTimeChanged = (time: RelativeTime) => {
      if (time.unit === 'second' && time.amount === 0) {
        dispatch(popPanel());
      }
    };

    const isBor = message.bor > 0;

    const uploadErrors = message?.uploadErrors ?? [];
    const sourceDevice = uploadErrors?.[0]?.sourceDevice;
    const sourceDeviceName =
      (typeof sourceDevice === 'number' && SOURCE_DEVICE_NAMES[sourceDevice]) || undefined;
    const sourceDeviceText = t('Sent from your {{device}} device', {
      device: sourceDeviceName,
    });

    return (
      <div className={clsx(styles.annotationBubbleContainer, className)} {...rest} ref={ref}>
        <AnnotationBubble>
          <ExpirationTime
            expiresAt={message.destructTime}
            labelFormat="panel"
            onExpirationTimeChanged={onExpirationTimeChanged}
            isBor={isBor}
          />
        </AnnotationBubble>
        {sourceDeviceName && <AnnotationBubble>{sourceDeviceText}</AnnotationBubble>}
      </div>
    );
  }
);

if (__DEV__) AnnotationBubbleContainer.displayName = 'AnnotationBubbleContainer';

export default AnnotationBubbleContainer;
