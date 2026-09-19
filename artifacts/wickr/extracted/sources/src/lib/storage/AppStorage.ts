import { WickrSettingsWebChannelAdapter } from '@/apis/webChannel/WickrSettingsWebChannelAdapter';

export type AsyncStorageMap = Record<string, any>;
export type AsyncStorageKey<T extends AsyncStorageMap> = string & keyof T;

export class AppStorage<T extends AsyncStorageMap> {
  constructor(private wickrSettings: WickrSettingsWebChannelAdapter) {}

  async clear(): Promise<void> {
    return this.wickrSettings.setUISettings({});
  }

  async size(): Promise<number> {
    const settings = await this.wickrSettings.getUISettings();
    return Object.keys(settings).length;
  }

  async get<K extends AsyncStorageKey<T>>(key: K): Promise<T[K] | undefined>;
  async get<K extends AsyncStorageKey<T>>(key: K, defaultValue: T[K]): Promise<T[K]>;
  async get<K extends AsyncStorageKey<T>>(
    key: K,
    defaultValue?: T[K] | undefined
  ): Promise<T[K] | undefined> {
    const settings = await this.wickrSettings.getUISettings();
    return settings[key] ?? defaultValue;
  }

  async set<K extends AsyncStorageKey<T>>(key: K, value: T[K]): Promise<boolean> {
    const settings = await this.wickrSettings.getUISettings();
    settings[key] = value;
    await this.wickrSettings.setUISettings(settings);
    return true;
  }

  async has<K extends AsyncStorageKey<T>>(key: K): Promise<boolean> {
    const settings = await this.wickrSettings.getUISettings();
    return key in settings;
  }

  async remove<K extends AsyncStorageKey<T>>(key: K): Promise<boolean> {
    const settings = await this.wickrSettings.getUISettings();
    if (key in settings) {
      delete settings[key];
      await this.wickrSettings.setUISettings(settings);
      return true;
    } else {
      return false;
    }
  }
}
