import { FC } from 'react';
import { List, PanelOverlay, Toggle } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import {
  updateEnableNotifications,
  updateOnlyShow1To1Notifications,
  updateShowAnonymousNotifications,
} from '@/store/thunks/settings';
import SettingItem from './SettingItem';

export const NotificationsOverlay: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const enableNotifications = useSetting('enableNotifications');
  const isOnlyShow1To1NotificationsEnabled = useSetting('onlyShow1To1Notifications');
  const isShowAnonymousNotificationsEnabled = useSetting('showAnonymousNotifications');
  const enableNotificationSenderInfo = useSetting('enableNotificationSenderInfo');

  return (
    <PanelOverlay title={t('Notifications')}>
      <List>
        <SettingItem
          title={t('Enable Notifications')}
          description={t('Notifications will be shown for new messages')}
        >
          <Toggle
            label={t('Enable Notifications')}
            checked={!!enableNotifications}
            onChange={() => dispatch(updateEnableNotifications(!enableNotifications))}
          />
        </SettingItem>
        {enableNotifications && (
          <SettingItem
            title={t('Only Show 1:1 Notifications')}
            description={t('Notifications will only be shown for 1:1')}
          >
            <Toggle
              label={t('Only Show 1:1 Notifications')}
              checked={!!isOnlyShow1To1NotificationsEnabled}
              onChange={() =>
                dispatch(updateOnlyShow1To1Notifications(!isOnlyShow1To1NotificationsEnabled))
              }
            />
          </SettingItem>
        )}
        {enableNotifications && (
          <SettingItem
            title={t('Anonymous Notifications')}
            description={t(
              'Enable this to hide sender and conversation/room names from notifications'
            )}
          >
            <Toggle
              label={t('Anonymous Notifications')}
              checked={!!isShowAnonymousNotificationsEnabled || !enableNotificationSenderInfo}
              onChange={() =>
                dispatch(updateShowAnonymousNotifications(!isShowAnonymousNotificationsEnabled))
              }
              aria-disabled={!enableNotificationSenderInfo}
            />
          </SettingItem>
        )}
      </List>
    </PanelOverlay>
  );
};

export default NotificationsOverlay;
