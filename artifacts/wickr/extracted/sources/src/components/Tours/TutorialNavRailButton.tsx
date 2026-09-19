import NavRailButton from '../NavRail/NavRailButton';
import { OrderedListIcon } from '@/componentlibrary';
import { useAppDispatch, useAppSelectorExtra } from '@/store';
import { selectIsTourCompleted } from '@/store/slices/coachMarks';
import { resumeTour, startTour } from '@/store/thunks/coachMarks';

const TOUR_ID = 'tutorial-tour';

export const TutorialNavRailButton = () => {
  const dispatch = useAppDispatch();
  const isCompleted = useAppSelectorExtra(selectIsTourCompleted, TOUR_ID);

  const handleClick = () => {
    if (isCompleted) {
      dispatch(startTour(TOUR_ID));
    } else {
      dispatch(resumeTour(TOUR_ID));
    }
  };

  return <NavRailButton label="Tutorial" icon={<OrderedListIcon />} onClick={handleClick} />;
};
