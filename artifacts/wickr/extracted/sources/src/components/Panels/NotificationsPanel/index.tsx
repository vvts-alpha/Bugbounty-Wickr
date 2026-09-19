import { clsx } from 'clsx';
import { millisecondsToSeconds, secondsToMilliseconds } from 'date-fns';
import { FC, FormEvent, useEffect, useState } from 'react';
import {
  Button,
  CaretIcon,
  Checkbox,
  Panel,
  PanelHeader,
  PopOver,
  PopOverItem,
  PrimaryButton,
} from '@/componentlibrary';
import { useCloseUnsavedPanel } from '@/hooks/useCloseUnsavedPanel';
import { useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import { MuteNotificationsAttributes } from '@/lib/metrics/models';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import {
  CONVO_MUTE_OPTIONS,
  ConvoMuteOptions,
  selectActiveConvoIsMuted,
  selectActiveConvoMuteAllMentions,
  selectActiveConvoMuteExpiration,
  selectActiveConvoMuteSelfMentions,
  selectActiveConvoSilenced,
  selectActiveConvoSyncedNotificationPreferences,
  selectActiveConvoType,
} from '@/store/slices/convos';
import { clearPanelStack, NotificationsPanelArgs, popPanel } from '@/store/slices/panels';
import { selectActiveConvoId } from '@/store/slices/shared';
import { updateConvoNotificationPreferences } from '@/store/thunks/convos';
import { formatTimestampDateAndTime } from '@/utils/date';
import { raw } from '@/utils/strings';
import {
  ONE_HOUR_SECONDS,
  EIGHT_HOUR_SECONDS,
  ONE_WEEK_SECONDS,
  getMuteDurationSecondsByLabel,
} from './utils';

import styles from './styles.module.less';
import panelButtonStyles from '../buttonStyles.module.less';

const NotificationsPanel: FC<NotificationsPanelArgs> = ({ closeIcon }) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const convoType = useAppSelector(selectActiveConvoType);
  const isDM = convoType === WickrConvoType.DM;
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const use12HourFormat = useSetting('use12HourFormat');
  const isMuted = useAppSelector(selectActiveConvoIsMuted);
  const muteExpiration = useAppSelector(selectActiveConvoMuteExpiration);
  const sync = useAppSelector(selectActiveConvoSyncedNotificationPreferences);
  const muteSelfMentions = useAppSelector(selectActiveConvoMuteSelfMentions);
  const muteAllMentions = useAppSelector(selectActiveConvoMuteAllMentions);
  const silenced = useAppSelector(selectActiveConvoSilenced);
  const silenceConversationsEnabled = useFeature('SilenceConversations');

  // Unsaved local form state. If not muted, set all checkboxes to on by default.
  const [unsavedMuteExpiration, setUnsavedMuteExpiration] = useState(muteExpiration);
  const [unsavedMuteSelfMentions, setUnsavedMuteSelfMentions] = useState(
    isMuted ? muteSelfMentions : false
  );
  const [unsavedMuteAllMentions, setUnsavedMuteAllMentions] = useState(
    isMuted ? muteAllMentions : false
  );
  // If muted, reflect the mute state. Otherwise default to off.
  const [unsavedSync, setUnsavedSync] = useState(isMuted ? sync : false);
  const [unsavedSilenced, setUnsavedSilenced] = useState(silenced);

  // Assign 1 when muted or 0 when not to keep it type number
  const [unsavedMuteDuration, setUnsavedMuteDuration] = useState<number>(isMuted ? 1 : 0);
  const [muteDurationString, setMuteDurationString] = useState<ConvoMuteOptions>(null);
  const [changed, setChanged] = useState(false);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const isUnmuting = unsavedMuteDuration === 0;
    dispatch(
      updateConvoNotificationPreferences({
        vgroupId: activeConvoId,
        isMuted: !isUnmuting,
        muteExpiration: millisecondsToSeconds(unsavedMuteExpiration),
        muteSelfMentions: unsavedMuteSelfMentions,
        muteAllMentions: unsavedMuteAllMentions,
        sync: unsavedSync,
        silenced: isUnmuting ? false : unsavedSilenced, // Clear silenced when unmuting
      })
    );

    const metric =
      unsavedMuteDuration === 0
        ? 'MuteNotificationsStopped'
        : isMuted
        ? 'MuteNotificationsEdited'
        : 'MuteNotificationsStarted';
    metrics.addMetrics(metric, {
      attributes: {
        syncDevices: unsavedSync,
        convoType,
        eventUiLocation: 'in-convo',
        ...(!isMuted && { muteDuration: muteDurationString }),
        ...(!isDM &&
          ({
            allowSelfMentions: !unsavedMuteSelfMentions,
            allowAllMentions: !unsavedMuteAllMentions,
          } satisfies Partial<MuteNotificationsAttributes>)), // Needed for TS check
      },
    });
    dispatch(popPanel());
  };

  const handleClose = useCloseUnsavedPanel(changed, handleSubmit);
  const handleClickOutside = useCloseUnsavedPanel(changed, handleSubmit, () => {
    dispatch(clearPanelStack());
  });

  useEffect(() => {
    // If we have changed our muteDuration, display the local unsaved time.
    // If not, display the existing mute expiration.
    const duration = unsavedMuteDuration ? unsavedMuteDuration : muteExpiration;
    const str =
      duration === ONE_HOUR_SECONDS
        ? '1 hour'
        : duration === EIGHT_HOUR_SECONDS
        ? '8 hours'
        : duration === ONE_WEEK_SECONDS
        ? '1 week'
        : duration === -1
        ? 'Always'
        : null;
    setMuteDurationString(str);
  }, [isMuted, unsavedMuteDuration, muteExpiration]);

  useEffect(() => {
    const somethingChanged =
      isMuted !== !!unsavedMuteDuration ||
      unsavedMuteSelfMentions !== muteSelfMentions ||
      unsavedMuteAllMentions !== muteAllMentions ||
      (isMuted && unsavedSync !== sync) || // When muted, default to the existing state, when not muted default to true
      unsavedSilenced !== silenced;
    setChanged(somethingChanged);
  }, [
    unsavedMuteDuration,
    isMuted,
    unsavedMuteSelfMentions,
    muteSelfMentions,
    unsavedMuteAllMentions,
    muteAllMentions,
    unsavedSync,
    sync,
    unsavedSilenced,
    silenced,
  ]);

  const [expTimestamp, setExpTimestamp] = useState('');

  // Update the muteExpiration and the correlating timestamp
  useEffect(() => {
    // format existing muteExpiration if muted
    if (isMuted) {
      setExpTimestamp(formatTimestampDateAndTime(muteExpiration, use12HourFormat));
      return;
    }
    // format the unsavedMuteExpiration
    const futureTime = Date.now() + secondsToMilliseconds(unsavedMuteDuration);
    setUnsavedMuteExpiration(unsavedMuteDuration === -1 ? -1 : futureTime);
    setExpTimestamp(formatTimestampDateAndTime(futureTime, use12HourFormat));
  }, [muteDurationString, unsavedMuteDuration]);

  const getSubtitle = () => {
    if (muteExpiration > 0 && isMuted && unsavedMuteDuration) {
      return t('Muted until {{timestamp}}', { timestamp: expTimestamp });
    }
    if ((!muteDurationString && unsavedMuteDuration) || unsavedMuteDuration === -1) {
      return t('You will not be notified for new messages');
    } else if (muteDurationString === 'Always') {
      return t('You will be notified for all messages');
    } else if (muteDurationString) {
      return t('Mute until {{timestamp}}', { timestamp: expTimestamp });
    } else {
      return;
    }
  };

  const handleUnmute = () => {
    dispatch(
      updateConvoNotificationPreferences({
        vgroupId: activeConvoId,
        isMuted: false,
        sync: unsavedSync,
      })
    );
    metrics.addMetrics('MuteNotificationsStopped', {
      attributes: {
        syncDevices: unsavedSync,
        convoType,
        eventUiLocation: 'in-convo',
      },
    });
    dispatch(popPanel());
  };

  return (
    <Panel
      side="right"
      onClose={handleClose}
      onOutsideClick={handleClickOutside}
      closeIcon={closeIcon}
    >
      <form onSubmit={handleSubmit}>
        <PanelHeader
          title={t('Notifications')}
          closeLabel={t('Close')}
          trailingElement={
            changed ? <PrimaryButton type="submit">{t('Save')}</PrimaryButton> : undefined
          }
          className={styles.header}
        />
        <div className={styles.panelBody}>
          <PopOver
            placement="bottom-end"
            popoverContent={() => {
              return (
                <div>
                  {isMuted ? (
                    <PopOverItem onClick={handleUnmute}>{t('Unmute')}</PopOverItem>
                  ) : (
                    CONVO_MUTE_OPTIONS.map((option) => (
                      <PopOverItem
                        key={option}
                        onClick={() =>
                          setUnsavedMuteDuration(getMuteDurationSecondsByLabel(option))
                        }
                      >
                        {t(option)}
                      </PopOverItem>
                    ))
                  )}
                </div>
              );
            }}
          >
            <Button
              className={clsx(
                panelButtonStyles.fullWidthButton,
                panelButtonStyles.spaceBetween,
                panelButtonStyles.popoverButton
              )}
            >
              <div className={styles.buttonContent}>
                <div className={styles.buttonTitle}>
                  {!isMuted ? t('Mute message notifications') : t('Unmute message notifications')}
                </div>
                <div className={styles.buttonSubtitle}>{getSubtitle()}</div>
              </div>
              <CaretIcon direction="down" />
            </Button>
          </PopOver>
          {!!unsavedMuteDuration && (
            <>
              {!isDM && (
                <>
                  <div
                    onClick={() => setUnsavedMuteSelfMentions(!unsavedMuteSelfMentions)}
                    className={clsx(
                      styles.checkboxWrapper,
                      panelButtonStyles.fullWidthButton,
                      panelButtonStyles.spaceBetween
                    )}
                  >
                    <div className={styles.flex}>
                      <div className={styles.buttonTitle}>{t('Personal mentions')}</div>
                      <div className={styles.buttonSubtitle}>
                        {t('Allow notifications for @me')}
                      </div>
                    </div>
                    <Checkbox
                      aria-label={t('Allow notifications for @me')}
                      className={styles.checkbox}
                      checked={!unsavedMuteSelfMentions}
                    />
                  </div>
                  <div
                    onClick={() => setUnsavedMuteAllMentions(!unsavedMuteAllMentions)}
                    className={clsx(
                      styles.checkboxWrapper,
                      panelButtonStyles.fullWidthButton,
                      panelButtonStyles.spaceBetween
                    )}
                  >
                    <div className={styles.flex}>
                      <div className={styles.buttonTitle}>{t('Room mentions')}</div>
                      <div className={styles.buttonSubtitle}>
                        {t('Allow notifications for @all')}
                      </div>
                    </div>
                    <Checkbox
                      aria-label={t('Allow notifications for @all')}
                      className={styles.checkbox}
                      checked={!unsavedMuteAllMentions}
                    />
                  </div>
                </>
              )}
              <div className={styles.divider} />
              <div
                onClick={() => setUnsavedSync(!unsavedSync)}
                className={clsx(
                  styles.checkboxWrapper,
                  panelButtonStyles.fullWidthButton,
                  panelButtonStyles.spaceBetween
                )}
              >
                <div className={styles.flex}>
                  <div className={styles.buttonTitle}>{t('Sync notification settings')}</div>
                  <div className={styles.buttonSubtitle}>
                    {t('Sync all notification settings across all devices')}
                  </div>
                </div>
                <Checkbox
                  aria-label={t('Sync all notification settings across all devices')}
                  className={styles.checkbox}
                  checked={!!unsavedSync}
                />
              </div>
              {silenceConversationsEnabled && (
                <div
                  onClick={() => setUnsavedSilenced(!unsavedSilenced)}
                  className={clsx(
                    styles.checkboxWrapper,
                    panelButtonStyles.fullWidthButton,
                    panelButtonStyles.spaceBetween
                  )}
                >
                  <div className={styles.flex}>
                    <div className={styles.buttonTitle}>{raw('Silence conversation')}</div>
                    <div className={styles.buttonSubtitle}>
                      {raw('Hides all indications of unread messages (Desktop only)')}
                    </div>
                  </div>
                  <Checkbox
                    aria-label={raw('Silence conversation')}
                    className={styles.checkbox}
                    checked={!!unsavedSilenced}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </form>
    </Panel>
  );
};

export default NotificationsPanel;
