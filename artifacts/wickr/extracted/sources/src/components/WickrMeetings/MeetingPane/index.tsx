import { useState } from 'react';
import MeetingContent from '../MeetingContent';
import Sidebar from '../Sidebar';

import styles from './styles.module.less';

const WickrMeetings: React.FC = () => {
  const [sideBarToggled, setSideBarToggled] = useState(false);

  return (
    <div className={styles.meetingPane}>
      <Sidebar toggled={sideBarToggled} toggle={setSideBarToggled} />
      <MeetingContent />
    </div>
  );
};

export default WickrMeetings;
