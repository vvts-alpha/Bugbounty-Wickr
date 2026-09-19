import MeetingControls from '../MeetingControls';
import VideoLayout from './VideoLayout';

import styles from './styles.module.less';

const MeetingContent: React.FC = () => {
  return (
    <div className={styles.meetingContent}>
      <VideoLayout />
      <MeetingControls />
    </div>
  );
};

export default MeetingContent;
