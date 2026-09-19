import { FC, lazy, Suspense } from 'react';
import { useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { selectActiveTourId } from '@/store/slices/coachMarks';

// lazy load each tour. network time is zero, so there's no real waiting,
const TutorialTour = lazy(() => import('./TutorialTour'));

export const ToursManager: FC = () => {
  const toursEnabled = useFeature('Tours');
  const activeTourId = useAppSelector(selectActiveTourId);

  if (!toursEnabled || !activeTourId) {
    return null;
  }

  const renderTour = () => {
    switch (activeTourId) {
      case 'tutorial-tour':
        return <TutorialTour />;
      default:
        return null;
    }
  };

  return <Suspense fallback={null}>{renderTour()}</Suspense>;
};
