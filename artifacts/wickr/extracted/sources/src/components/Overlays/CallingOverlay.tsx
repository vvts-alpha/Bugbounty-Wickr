import { List, PanelOverlay, Toggle } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectActiveConvoActiveCall } from '@/store/slices/convos';
import {
  updateHDVideo,
  updateIsTcpCalling,
  updateParticipantLeaveSound,
} from '@/store/thunks/settings';
import SettingItem from './SettingItem';

const CallingOverlay = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const isTcpCalling = useSetting('isTcpCalling');
  const forceTcpCall = useSetting('forceTcpCall');
  const isEnableWOAProxy = useSetting('isEnableWOAProxy');
  const activeCall = useAppSelector(selectActiveConvoActiveCall);
  const HDVideo = useSetting('HDVideo');
  const participantLeaveSound = useSetting('participantLeaveSound');
  const isProd = useSetting('isProduction');

  return (
    <PanelOverlay title={t('Calling')}>
      <List>
        <SettingItem title={t('Enable TCP Calling')} description={t('Always use TCP for calls.')}>
          <Toggle
            label={t('Enable TCP Calling')}
            checked={!!isTcpCalling}
            onChange={() => dispatch(updateIsTcpCalling(!isTcpCalling))}
            aria-disabled={forceTcpCall || activeCall || isEnableWOAProxy}
          />
        </SettingItem>
        {!isProd && (
          <SettingItem
            title={t('Enable HD Calling')}
            description={t(
              'Enable high quality, 720p/30fps, video calls. This is on by default and AWS Wickr will automatically downgrade quality for bad connections. Users with limited bandwidth can disable to lower data usage.'
            )}
          >
            <Toggle
              label={t('Enable HD Calling')}
              checked={!!HDVideo}
              onChange={() => dispatch(updateHDVideo(!HDVideo))}
            />
          </SettingItem>
        )}
        <SettingItem
          title={t('Audio Notification')}
          description={t('Play a sound when participants leave.')}
        >
          <Toggle
            label={t('Audio Notification')}
            checked={!!participantLeaveSound}
            onChange={() => dispatch(updateParticipantLeaveSound(!participantLeaveSound))}
          />
        </SettingItem>
      </List>
    </PanelOverlay>
  );
};

export default CallingOverlay;
