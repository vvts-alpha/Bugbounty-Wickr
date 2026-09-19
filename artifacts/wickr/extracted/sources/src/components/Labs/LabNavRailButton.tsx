import { useEffect } from 'react';
import NavRailButton from '../NavRail/NavRailButton';
import { FlaskIcon } from '@/componentlibrary';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import { selectAvailableExperiments } from '@/store/slices/features';
import { openModal } from '@/store/thunks/modals';

export const LabNavRailButton: React.FC = () => {
  const dispatch = useAppDispatch();
  const isProduction = useSetting('isProduction');
  const isLargeText = useFeature('LargeText');
  const previousLabFeatures = useAppSelector((state) => state.features.previousLabFeatures);

  useEffect(() => {
    if (isLargeText && !isProduction) {
      const style = document.createElement('style');
      style.textContent = `html { font-size: 19px; }`;
      document.body.append(style);
      return () => style.remove();
    }
  }, [isLargeText, isProduction]);

  const labs = useAppSelector(selectAvailableExperiments);
  if (!labs.length || isProduction) return null;

  // Calculate new features since last app restart
  const newFeaturesSet = new Set(labs.filter((lab) => !previousLabFeatures.includes(lab)));

  const handleClick = () => {
    dispatch(openModal('LabFeatureModal'));
  };

  return (
    <NavRailButton
      icon={<FlaskIcon size={20} />}
      label="Labs"
      badgeCount={newFeaturesSet.size}
      onClick={handleClick}
    />
  );
};
