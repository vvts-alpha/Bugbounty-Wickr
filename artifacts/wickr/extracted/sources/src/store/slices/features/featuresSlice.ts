import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { isMac } from '@/utils/platform';
import { createFeatureConfig, FeatureName, FeaturesState } from './featuresModels';

// Track labs (experimental) at: https://quip-amazon.com/2SaJA5trKUBb/Desktop-Labs
const initialState: FeaturesState = {
  localFeatureOverrides: {},
  previousLabFeatures: [],
  configs: {
    Tours: createFeatureConfig('Tours', {
      title: 'Tours',
      description: 'Guided tour of application features. Toggle off/on to restart the tour.',
      availability: 'beta',
      experimental: true,
      dateAdded: '2025-11-10',
    }),
    CatMode: createFeatureConfig('CatMode', {
      title: 'Cat Mode',
      description: 'Replace all profile photos with adorable cats 🐱',
      availability: 'beta',
      experimental: true,
      dateAdded: '2025-10-24',
    }),
    ConvoHistoryShortcuts: createFeatureConfig('ConvoHistoryShortcuts', {
      title: 'Conversation history shortcuts',
      description: `Navigate conversation history with ${isMac() ? 'Cmd' : 'Ctrl'}+Shift+[ and ${
        isMac() ? 'Cmd' : 'Ctrl'
      }+Shift+]`,
      availability: 'beta',
      experimental: true,
      dateAdded: '2025-07-29',
    }),
    CopyRoomMembers: createFeatureConfig('CopyRoomMembers', {
      title: 'Copy room members',
      description:
        'Copy room member names and/or emails from the room details pane. (Room info > Scroll to bottom > Copy members / emails buttons)',
      availability: 'beta',
      experimental: true,
      dateAdded: '2025-08-05',
    }),
    EmojiMartSearch: createFeatureConfig('EmojiMartSearch', {
      title: 'Enhanced emoji search',
      description:
        'Use emoji-mart for improved emoji shortcode search (:smile:) with better keyword matching',
      availability: 'beta',
      experimental: true,
      dateAdded: '2025-08-01',
    }),
    FileManagement: createFeatureConfig('FileManagement', {
      availability: 'prod',
      experimental: false,
      dateAdded: '2025-01-01',
    }),
    IntegratedApps: createFeatureConfig('IntegratedApps', {
      title: 'Integrated Apps',
      description: 'Integrate external web apps',
      availability: 'dev',
      experimental: true,
      dateAdded: '2025-07-29',
    }),
    LargeText: createFeatureConfig('LargeText', {
      title: 'Large Text',
      description: 'Use larger fonts',
      availability: 'beta',
      experimental: true,
      dateAdded: '2025-07-29',
    }),
    MarkConvoAsUnread: createFeatureConfig('MarkConvoAsUnread', {
      title: 'Mark Convos as Read/Unread',
      description:
        'Mark a conversation as read to clear unread badge, or mark them as unread until your next visit',
      availability: 'beta',
      experimental: true,
      dateAdded: '2025-10-31',
    }),
    SilenceConversations: createFeatureConfig('SilenceConversations', {
      title: 'Silence Conversations',
      description:
        'Hide all unread indicators for muted conversations. Silenced convos stay in their section (Rooms/DMs/Bots) instead of moving to Unread. Desktop only.',
      availability: 'beta',
      experimental: true,
      dateAdded: '2025-12-01',
    }),
    Signin: createFeatureConfig('Signin', {
      title: 'Web Signin',
      description: 'Web signin workflow',
      // Available on nightly for automated testing, but not experimental (i.e., hidden in Labs)
      // UI to enable in DevMenu. For automated testing to enable this, it needs to both set
      // showWebViewImmediately and nightlyBetaRing settings to true.
      availability: 'nightly',
      experimental: false,
      dateAdded: '2025-08-07',
    }),
    Toasts: createFeatureConfig('Toasts', {
      title: 'Copy notifications',
      description: 'Display notifications when copying from Wickr',
      availability: 'beta',
      experimental: true,
      dateAdded: '2025-07-29',
    }),
    WickrAI: createFeatureConfig('WickrAI', {
      title: 'WickrAI',
      description: 'Generated conversation summaries',
      availability: 'dev',
      experimental: true,
      dateAdded: '2025-07-29',
    }),
    WickrAIChat: createFeatureConfig('WickrAIChat', {
      availability: 'dev',
      experimental: true,
      dateAdded: '2025-08-01',
    }),
    WickrMeetings: createFeatureConfig('WickrMeetings', {
      title: 'Wickr Meetings',
      description: 'Powered by Chime SDK',
      availability: 'dev',
      experimental: true,
      dateAdded: '2025-07-29',
    }),
  },
};

export const featuresSlice = createSlice({
  name: 'features',
  initialState,
  reducers: {
    setLocalFeatureOverrides: (
      state,
      { payload }: PayloadAction<Partial<Record<FeatureName, boolean>>>
    ) => {
      state.localFeatureOverrides = payload;
    },
    setPreviousLabFeatures: (state, { payload }: PayloadAction<FeatureName[]>) => {
      state.previousLabFeatures = payload;
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('features', initialState));
  },
});

export const featuresReducer = featuresSlice.reducer;

export const { setLocalFeatureOverrides, setPreviousLabFeatures } = featuresSlice.actions;
