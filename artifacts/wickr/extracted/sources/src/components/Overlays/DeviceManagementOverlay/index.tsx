import { useEffect } from 'react';
import SettingItem from '../SettingItem';
import { Button, Heading, List, PanelOverlay } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { ActiveDevice } from '@/store/models';
import { pushModal } from '@/store/slices/modal';
import { fetchActiveDevices } from '@/store/thunks/settings';
import { formatRelativeDateWithTime } from '@/utils/date';

import styles from './styles.module.less';

export const DeviceManagementOverlay = () => {
  const activeDevices = useSetting('activeDevices') as ActiveDevice[];
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();

  useEffect(() => {
    dispatch(fetchActiveDevices());
  }, []);

  return (
    <PanelOverlay title={t('Device Management')} className={styles.deviceManagementOverlay}>
      <List className={styles.list}>
        {activeDevices.map((device) => (
          <SettingItem
            title={`${device.type}(${device.description})`}
            description={t('Last Login: {{date}}', {
              date: formatRelativeDateWithTime(device.lastLoginTime * 1000, t),
            })}
            className={device.thisDevice ? styles.thisDeviceItem : ''}
            key={device.appId}
          >
            {device.thisDevice ? (
              <Heading level={3} as="h2" className={styles.thisDeviceText}>
                {t('This Device')}
              </Heading>
            ) : (
              <Button
                className={styles.suspendBtn}
                color="red"
                onClick={() =>
                  dispatch(
                    pushModal({
                      name: 'SuspendDeviceModal',
                      params: { activeDevice: device },
                    })
                  )
                }
              >
                {t('Suspend from account')}
              </Button>
            )}
          </SettingItem>
        ))}
      </List>
    </PanelOverlay>
  );
};

export default DeviceManagementOverlay;
