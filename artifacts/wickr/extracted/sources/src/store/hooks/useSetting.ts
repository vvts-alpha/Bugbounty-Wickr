import { SettingName } from '../slices/settings';
import { selectSetting } from '../slices/settings/settingsSelectors';
import { useAppSelectorExtra } from '@/store';

/** Select a setting from the store with the proper type */
export function useSetting<K extends SettingName>(name: K) {
  return useAppSelectorExtra(selectSetting, name);
}
