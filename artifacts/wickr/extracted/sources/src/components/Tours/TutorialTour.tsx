import { FC } from 'react';
import { CoachMarks } from '../CoachMarks';
import { Logger } from '@/lib/logger';

const logger = new Logger('TutorialTour');

// This is a sample app tour, loosely based on the iOS one.
// It is not meant to ship, rather it shows a sample of what's possible.
const TutorialTour: FC = () => (
  <CoachMarks
    id="tutorial-tour"
    steps={[
      {
        stepId: 'messages',
        title: 'Messages',
        description:
          'Stay up-to-date on all your conversations. Search to quickly find a conversation.',
        placement: 'top-start',
        offset: [150, 30],
        markerTheme: 'dark-theme',
        markerOffset: [70, 70],
      },
      {
        stepId: 'new-message',
        title: 'New message',
        description: 'Create a new room, group, or direct message.',
        placement: 'right-end',
        offset: [0, 10],
        markerTheme: 'dark-theme',
        markerOffset: [-9, -7],
      },
      {
        stepId: 'search',
        title: 'Search',
        description:
          'Looking for a file or something else? Use keywords to search conversations, specific messages, or files.',
        placement: 'left-start',
        offset: [0, 10],
        markerOffset: [-7, -7],
      },
      {
        stepId: 'settings',
        title: 'Settings and Contacts',
        description: 'Customize Wickr and search your contacts here.',
        placement: 'left-start',
        markerTheme: 'dark-theme',
        markerOffset: [1, 1],
      },
    ]}
    onStart={() => logger.info('started')}
    onStep={(event) => logger.info('current step:', event)}
    onEnd={() => logger.info('completed')}
    onCancel={(event) => logger.info('canceled:', event)}
  />
);

export default TutorialTour;
