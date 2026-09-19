import { useAppSelectorExtra } from '..';
import { FeatureName, selectFeatureConfig, selectIsFeatureEnabled } from '../slices/features';

/**
 * @returns true if feature is enabled, false otherwise.
 */
export function useFeature(featureName: FeatureName): boolean {
  return useAppSelectorExtra(selectIsFeatureEnabled, featureName);
}

export function useFeatureConfig(featureName: FeatureName) {
  return useAppSelectorExtra(selectFeatureConfig, featureName);
}
