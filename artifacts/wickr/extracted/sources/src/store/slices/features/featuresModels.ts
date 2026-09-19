export type FeaturesState = {
  /**
   * Feature state overrides that the app may honor
   * This is used primarily for features that do not have external controls (settings/env/server) that we are testing locally.
   */
  localFeatureOverrides: Partial<Record<FeatureName, boolean>>;
  /**
   * Current lab features that were visible the last time the user opened the Labs menu
   * Used to determine which features are "new" and should show a badge
   */
  previousLabFeatures: FeatureName[];
  configs: AllFeatures;
};

export type FeatureName = keyof AllFeatures;

export type AllFeatures = {
  CatMode: FeatureConfig<'CatMode'>;
  ConvoHistoryShortcuts: FeatureConfig<'ConvoHistoryShortcuts'>;
  CopyRoomMembers: FeatureConfig<'CopyRoomMembers'>;
  EmojiMartSearch: FeatureConfig<'EmojiMartSearch'>;
  FileManagement: FeatureConfig<'FileManagement'>;
  IntegratedApps: FeatureConfig<'IntegratedApps'>;
  LargeText: FeatureConfig<'LargeText'>;
  MarkConvoAsUnread: FeatureConfig<'MarkConvoAsUnread'>;
  SilenceConversations: FeatureConfig<'SilenceConversations'>;
  Signin: FeatureConfig<'Signin'>;
  Toasts: FeatureConfig<'Toasts'>;
  Tours: FeatureConfig<'Tours'>;
  WickrAI: FeatureConfig<'WickrAI'>;
  WickrAIChat: FeatureConfig<'WickrAIChat'>;
  WickrMeetings: FeatureConfig<'WickrMeetings'>;
};

/**
 * Configs hold data about each feature. Enabled state is derived (see FEATURE_ENABLED_SELECTOR in featureSelectors.ts).
 * Configs have availability and experimental props for similar but slightly different purposes:
 *
 * - Availability -- The enabled selectors always check availability.
 *   This prevents features from being enabled outside of the desired environments.
 *
 * - Experimental -- Experimental features are visible to users in Labs where they are available.
 *   This typically means the user can toggle them.
 *
 * We have situations where a feature is being developed and needs to be _available_ in non-dev environments,
 * but we do not want users playing with the feature state. An example of this is Signin. We need this in beta
 * environments so automated testing can use it. But we do not want users enabling the feature manually.
 */
export type FeatureConfig<Name extends FeatureName> = {
  name: Name;
  title: string;
  description: string;
  /** Determines which environments the feature can be used in. Defaults to prod */
  availability: 'dev' | 'nightly' | 'beta' | 'prod';
  /** If true, visible to users in Labs. Defaults to false */
  experimental: boolean;
  /** 'YYYY-MM-DD' string for easy sorting **/
  dateAdded: string;
};

export const createFeatureConfig = <Name extends FeatureName>(
  name: Name,
  {
    title,
    description = '',
    availability,
    experimental,
    dateAdded,
  }: Omit<FeatureConfig<Name>, 'name' | 'title' | 'description'> & {
    title?: string;
    description?: string;
  }
): FeatureConfig<Name> => ({
  name,
  title: title || name,
  description,
  availability,
  experimental,
  dateAdded,
});
