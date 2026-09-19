import {
  FeatureName,
  selectAllLocalFeatureOverrides,
  setLocalFeatureOverrides,
  setPreviousLabFeatures,
} from '../slices/features';
import { createAppAsyncThunk } from '../utils';

export const hydrateLocalFeatureOverridesFromStorage = createAppAsyncThunk(
  'features/hydrateLocalFeatureOverrideList',
  async (_: never, { dispatch, extra }) => {
    const savedFeatures = await extra.storage.get('LocalFeatures', {});
    await dispatch(updateLocalFeatureOverrides(savedFeatures));
  }
);

/** Update the local feature override state of one or more features */
export const updateLocalFeatureOverrides = createAppAsyncThunk(
  'features/updateLocalFeatureOverrides',
  async (updates: Partial<Record<FeatureName, boolean>>, { getState, dispatch }) => {
    const local = selectAllLocalFeatureOverrides(getState());
    const features = { ...local, ...updates };
    dispatch(setLocalFeatureOverrides(features));
    await dispatch(syncLocalFeatureOverridesInternal('merge'));
  }
);

/**
 * Sync features to app storage
 * @param strategy 'local' to only persist what is in redux, 'merge' to combine redux and what is in app storage
 */
const syncLocalFeatureOverridesInternal = createAppAsyncThunk(
  'features/syncLocalFeatureOverrides',
  async (strategy: 'local' | 'merge', { getState, extra }) => {
    const saved = strategy === 'local' ? {} : await extra.storage.get('LocalFeatures', {});
    const local = selectAllLocalFeatureOverrides(getState());
    const features = { ...saved, ...local };
    await extra.storage.set('LocalFeatures', features);
  }
);

export const resetLocalFeatureOverrides = createAppAsyncThunk(
  'features/resetLocalFeatureOverrides',
  async (_: never, { dispatch }) => {
    dispatch(setLocalFeatureOverrides({}));
    await dispatch(syncLocalFeatureOverridesInternal('local'));
  }
);

export const hydratePreviousLabFeaturesFromStorage = createAppAsyncThunk(
  'features/hydratePreviousLabFeatures',
  async (_: never, { dispatch, extra }) => {
    const featureNames = await extra.storage.get('PreviousLabFeatures', []);
    dispatch(setPreviousLabFeatures(featureNames));
  }
);

/** Update the current lab features and persist to storage */
export const updatePreviousLabFeatures = createAppAsyncThunk(
  'features/updatePreviousLabFeatures',
  async (featureNames: FeatureName[], { dispatch, extra }) => {
    dispatch(setPreviousLabFeatures(featureNames));
    await extra.storage.set('PreviousLabFeatures', featureNames);
  }
);
