import { clsx } from 'clsx';
import { Button, NotificationsIcon, CaretIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectActiveConvoIsMuted, selectActiveConvoMuteExpiration } from '@/store/slices/convos';
import { pushPanel } from '@/store/slices/panels';
import { formatTimestampDateAndTime } from '@/utils/date';

import panelButtonStyles from '../Panels/buttonStyles.module.less';

const NotificationsPanelButton = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const use12HourFormat = useSetting('use12HourFormat');
  const isMuted = useAppSelector(selectActiveConvoIsMuted);
  const muteExpiration = useAppSelector(selectActiveConvoMuteExpiration);

  return (
    <Button
      className={clsx(panelButtonStyles.fullWidthButton, panelButtonStyles.popoverButton)}
      onClick={() => dispatch(pushPanel({ name: 'NotificationsPanel' }))}
    >
      <div className={panelButtonStyles.rowWithGap}>
        <NotificationsIcon size="20px" muted={isMuted} />
        <div className={panelButtonStyles.buttonLabel}>
          <div className={panelButtonStyles.left}>{t('Notifications')}</div>
          {isMuted && (
            <div className={panelButtonStyles.subtitle}>
              {muteExpiration === -1 ? (
                <>{t('You will not be notified for new messages')}</>
              ) : (
                <>
                  {t('Muted until {{timestamp}}', {
                    timestamp: formatTimestampDateAndTime(muteExpiration, use12HourFormat),
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={clsx(panelButtonStyles.rowWithGap, panelButtonStyles.textWithCaret)}>
        <CaretIcon direction="right" />
      </div>
    </Button>
  );
};

export default NotificationsPanelButton;
