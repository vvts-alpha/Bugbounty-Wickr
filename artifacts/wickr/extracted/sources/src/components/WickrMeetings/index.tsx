import { useAppSelector } from '@/store';
import { selectMeetingState } from '@/store/slices/meetings';
import MeetingPane from './MeetingPane';

const WickrMeetings: React.FC = () => {
  const meetingState = useAppSelector(selectMeetingState);

  const render = () => {
    switch (meetingState) {
      case 'READY':
        return <MeetingPane />;
      default:
        return null;
    }
  };

  return render();
};

export default WickrMeetings;
