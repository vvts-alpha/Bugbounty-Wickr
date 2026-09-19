import { createSelector } from '@reduxjs/toolkit';
import { AppStage } from '@/apis/webChannel/WickrSettingsWebChannel';
import { AppRootState } from '@/store/models';
import { SettingName } from './settingsModels';

const selectSettings = (state: AppRootState) => state.settings;

/**
 * In components, prefer useSetting() hook to select the setting you need.
 * Outside of components, use selectSetting directly. Only create selectors
 * for settings that are computed values.
 */
export function selectSetting<K extends SettingName>(state: AppRootState, name: K) {
  return selectSettings(state)[name];
}

// Computed value selectors:

export const selectAppStage = createSelector(selectSettings, (settings): AppStage => {
  if (settings.isBeta) return 'beta';
  if (settings.isAlpha) return 'alpha';
  if (settings.isGamma) return 'gamma';
  return 'production';
});

export const selectWickrAppName = createSelector(selectSettings, (settings) => {
  if (settings.isEnterprise) {
    return 'Wickr';
  } else if (settings.isGovCloudEnabled) {
    return 'AWS WickrGov';
  } else {
    return 'AWS Wickr';
  }
});
