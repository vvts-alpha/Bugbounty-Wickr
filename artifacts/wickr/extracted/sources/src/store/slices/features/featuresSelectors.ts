import { createSelector } from '@reduxjs/toolkit';
import { selectAppStage, selectSetting } from '../settings';
import { AppRootState } from '@/store/models';
import { FeatureName } from './featuresModels';

const selectRoot = (state: AppRootState) => state.features;

export const selectAllFeatureConfigs = createSelector(selectRoot, (root) => root.configs);

export const selectFeatureConfig = createSelector(
  selectAllFeatureConfigs,
  (_: AppRootState, featureName: FeatureName) => featureName,
  (all, featureName) => {
    return all[featureName];
  }
);

export const selectIsNavRailEnabled = (state: AppRootState) => {
  return (
    selectIsFeatureEnabled(state, 'WickrMeetings') ||
    !selectSetting(state, 'isProduction') ||
    __DEV__
  );
};

export const selectAllLocalFeatureOverrides = createSelector(
  selectRoot,
  (root) => root.localFeatureOverrides
);

export const selectLocalFeatureOverride = createSelector(
  selectRoot,
  (_: any, featureName: FeatureName) => featureName,
  (root, featureName) => {
    return root.localFeatureOverrides[featureName] ?? undefined;
  }
);

export function selectIsFeatureEnabled(state: AppRootState, featureName: FeatureName): boolean {
  const rule = FEATURE_ENABLED_SELECTOR[featureName];
  const enabled = rule(state);
  return enabled;
}

export const selectAllFeaturesEnabled = createSelector(
  (state: AppRootState) => state,
  (state) => {
    return Object.fromEntries(
      Object.entries(FEATURE_ENABLED_SELECTOR).map(([featureName, selector]) => [
        featureName,
        selector(state),
      ])
    ) as Record<FeatureName, boolean>;
  }
);

export const selectIsFeatureAvailable = createSelector(
  selectAppStage,
  (state: AppRootState, featureName: FeatureName) => selectFeatureConfig(state, featureName),
  (state: AppRootState) => selectSetting(state, 'nightlyBetaRing'),
  (stage, config, isNightly) => {
    const availability = config.availability ?? 'prod';
    switch (availability) {
      case 'dev':
        return __DEV__;
      case 'nightly':
        return __DEV__ || isNightly;
      case 'beta':
        return __DEV__ || isNightly || ['alpha', 'beta'].includes(stage);
      case 'prod':
        return true;
    }
  }
);

export const selectIsFeatureExperimental = createSelector(selectFeatureConfig, (config) => {
  return config.experimental;
});

export const selectAvailableExperiments = createSelector(
  (state: AppRootState) => state,
  (state) => {
    return FEATURE_NAMES.filter(
      (name) => selectIsFeatureAvailable(state, name) && selectIsFeatureExperimental(state, name)
    );
  }
);

/**
 * All features are enabled/disabled through these derived selectors.
 * The features are in a Record so we get a TS error if any are missing
 *
 * - Experimental settings may be toggled locally, e.g., selectLocalFeatureOverride.
 *   Pair with ?? true to be on by default.
 * - Non-production settings must check to see if they are available, e.g., selectIsFeatureAvailable.
 *   It is redudant for prod features, as selectIsFeatureAvailable will always return true.
 * - Production features are controlled by other state, e.g., selectSetting only, and the flag can be deprecated.
 */
const FEATURE_ENABLED_SELECTOR: Record<FeatureName, (state: AppRootState) => boolean> = {
  CatMode: (state) => {
    return (
      selectIsFeatureAvailable(state, 'CatMode') && !!selectLocalFeatureOverride(state, 'CatMode')
    );
  },

  ConvoHistoryShortcuts: (state) => {
    return (
      selectIsFeatureAvailable(state, 'ConvoHistoryShortcuts') &&
      !!selectLocalFeatureOverride(state, 'ConvoHistoryShortcuts')
    );
  },

  CopyRoomMembers: (state) => {
    return (
      selectIsFeatureAvailable(state, 'CopyRoomMembers') &&
      (selectLocalFeatureOverride(state, 'CopyRoomMembers') ?? true)
    );
  },

  EmojiMartSearch: (state) => {
    return (
      selectIsFeatureAvailable(state, 'EmojiMartSearch') &&
      !!selectLocalFeatureOverride(state, 'EmojiMartSearch')
    );
  },

  FileManagement: (state) => selectSetting(state, 'fileManager'),

  IntegratedApps: (state) => {
    return (
      selectIsFeatureAvailable(state, 'IntegratedApps') &&
      !!selectLocalFeatureOverride(state, 'IntegratedApps')
    );
  },

  LargeText: (state) => {
    return (
      selectIsFeatureAvailable(state, 'LargeText') &&
      !!selectLocalFeatureOverride(state, 'LargeText')
    );
  },

  MarkConvoAsUnread: (state) => {
    return (
      selectIsFeatureAvailable(state, 'MarkConvoAsUnread') &&
      !!selectLocalFeatureOverride(state, 'MarkConvoAsUnread')
    );
  },

  SilenceConversations: (state) => {
    return (
      selectIsFeatureAvailable(state, 'SilenceConversations') &&
      !!selectLocalFeatureOverride(state, 'SilenceConversations')
    );
  },

  // Only honor showWebViewImmediately in nightly. This is for automated testing.
  // We do not show this in Labs because it is not marked as experimental.
  Signin: (state) => {
    return (
      selectIsFeatureAvailable(state, 'Signin') && selectSetting(state, 'showWebViewImmediately')
    );
  },

  Toasts: (state) => {
    return (
      selectIsFeatureAvailable(state, 'Toasts') &&
      (selectLocalFeatureOverride(state, 'Toasts') ?? true)
    );
  },

  Tours: (state) => {
    return selectIsFeatureAvailable(state, 'Tours') && !!selectLocalFeatureOverride(state, 'Tours');
  },

  WickrAI: (state) => {
    return (
      selectIsFeatureAvailable(state, 'WickrAI') && !!selectLocalFeatureOverride(state, 'WickrAI')
    );
  },

  WickrAIChat: (state) => {
    return (
      selectIsFeatureEnabled(state, 'WickrAI') &&
      selectIsFeatureAvailable(state, 'WickrAIChat') &&
      !!selectLocalFeatureOverride(state, 'WickrAIChat')
    );
  },

  WickrMeetings: (state) => __DEV__ && !!selectLocalFeatureOverride(state, 'WickrMeetings'),
};

export const FEATURE_NAMES = Object.keys(FEATURE_ENABLED_SELECTOR) as FeatureName[];
