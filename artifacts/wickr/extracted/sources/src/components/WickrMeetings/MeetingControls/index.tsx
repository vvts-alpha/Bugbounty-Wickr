import { ControlBar, IconButton, PhoneIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import AudioControl from './AudioControl';
import ControlBarButton from './ControlBarButton';
import ScreenShareControl from './ScreenShareControl';
import VideoControl from './VideoControl';

import styles from './styles.module.less';

const MeetingControls: React.FC = () => {
  const { t } = useAppTranslation();
  const canEndMeeting = true;
  const endMeetingLabel = canEndMeeting ? t('End') : t('Leave');

  const endOrLeaveMeeting = () => {
    console.log('End or leave meeting');
  };

  return (
    <div className={styles.meetingControls}>
      <ControlBar showLabels={false}>
        <AudioControl />
        <VideoControl />
        <ScreenShareControl />
        <ControlBarButton
          type="endMeeting"
          label={endMeetingLabel}
          onClick={endOrLeaveMeeting}
          a11yLabel={endMeetingLabel}
          icon={
            <IconButton label={endMeetingLabel} className={styles.controlButton}>
              <PhoneIcon />
            </IconButton>
          }
        />
      </ControlBar>
    </div>
  );
};

export default MeetingControls;
