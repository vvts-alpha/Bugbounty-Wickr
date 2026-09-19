export const CMD_OR_CTRL = 'CommandOrControl';

type ShortcutKeys = string;

export type ShortcutConfig = {
  name: string;
  description?: string;
  category?: string;
  /** Default shortcut keys. Must be supplied, even if it's an empty string */
  defaultKeys: ShortcutKeys;
  /** Mac-specific override */
  nativeMac?: ShortcutKeys;
  /** Windows-specific override */
  nativeWindows?: ShortcutKeys;
  /** Linux-specific override */
  nativeLinux?: ShortcutKeys;
};

// TODO: map name/description/category to i18n keys
export const ALL_SHORTCUTS = {
  DebugActiveMessages: {
    name: `Log active messages`,
    defaultKeys: `${CMD_OR_CTRL}+shift+1`,
  },
  OpenNavMenu: {
    name: `Focus chat input`,
    defaultKeys: `${CMD_OR_CTRL}+/`,
  },
  OpenSettings: {
    name: `Open settings`,
    defaultKeys: `${CMD_OR_CTRL}+,`,
  },
  NextRoom: {
    name: `Next Room`,
    defaultKeys: `alt+down`,
  },
  PreviousRoom: {
    name: `Previous Room`,
    defaultKeys: `alt+up`,
  },
  NextConversation: {
    name: `Next Conversation`,
    defaultKeys: `shift+alt+down`,
  },
  PreviousConversation: {
    name: `Previous Conversation`,
    defaultKeys: `shift+alt+up`,
  },
  UploadFile: {
    name: `Upload File`,
    defaultKeys: `${CMD_OR_CTRL}+shift+u`,
  },
  QuickResponses: {
    name: `Quick Responses`,
    defaultKeys: `${CMD_OR_CTRL}+[`,
  },
  Tab: {
    name: `Tab Forward`,
    defaultKeys: `tab`,
  },
  ShiftTab: {
    name: `Tab Backward`,
    defaultKeys: `shift+tab`,
  },
  Reload: {
    name: `Reload`,
    defaultKeys: `${CMD_OR_CTRL}+r`,
  },
  VoiceMemo: {
    name: `Record Voice Memo`,
    defaultKeys: `${CMD_OR_CTRL}+shift+v`,
  },
  ZoomIn: {
    name: `Zoom In`,
    defaultKeys: `${CMD_OR_CTRL}+=`,
  },
  ZoomOut: {
    name: `Zoom Out`,
    defaultKeys: `${CMD_OR_CTRL}+-`,
  },
  ShareLocation: {
    name: `Share Location`,
    defaultKeys: `${CMD_OR_CTRL}+shift+l`,
  },
  EmojiMenu: {
    name: `Toggle Emoji Menu`,
    defaultKeys: `${CMD_OR_CTRL}+shift+\\`,
  },
  Escape: {
    name: `Escape`,
    defaultKeys: `escape`,
  },
  AdminControls: {
    name: 'Open Admin Controls',
    defaultKeys: `${CMD_OR_CTRL}+'`,
  },
  OpenContacts: {
    name: 'Open Contacts',
    defaultKeys: `${CMD_OR_CTRL}+shift+e`,
  },
  OpenDirectory: {
    name: 'Open Directory',
    defaultKeys: `${CMD_OR_CTRL}+shift+d`,
  },
  CreateRoom: {
    name: 'Creat Room',
    defaultKeys: `${CMD_OR_CTRL}+shift+r`,
  },
  CreateDM: {
    name: 'Create Direct Message',
    defaultKeys: `${CMD_OR_CTRL}+shift+m`,
  },
  UniversalSearch: {
    name: 'Universal Search',
    defaultKeys: `${CMD_OR_CTRL}+f`,
  },
  UniversalSearchStarredItems: {
    name: 'Universal Search - Starred Items',
    defaultKeys: `${CMD_OR_CTRL}+shift+f`,
  },
  FocusFindRoomsAndDMs: {
    name: 'Focus Find Rooms & DMs',
    defaultKeys: `${CMD_OR_CTRL}+j`,
  },
  LeaveConvo: {
    name: 'Leave Convo',
    defaultKeys: `${CMD_OR_CTRL}+l`,
  },
  DeleteConvo: {
    name: 'Delete Convo',
    defaultKeys: `${CMD_OR_CTRL}+d`,
  },
  ShowPinnedItems: {
    name: 'Show Pinned Items',
    defaultKeys: `${CMD_OR_CTRL}+p`,
  },
  TogglePresence: {
    name: 'Toggle Presence',
    defaultKeys: `${CMD_OR_CTRL}+shift+p`,
  },
  SupportScreen: {
    name: 'Show Support Screen',
    defaultKeys: `f1`,
  },
  ViewConversation: {
    name: 'View Room Or Group',
    defaultKeys: `${CMD_OR_CTRL}+e`,
  },
  CodeBlock: {
    name: 'Code Block',
    defaultKeys: `${CMD_OR_CTRL}+shift+c`,
  },
  ScrollToBottom: {
    name: 'Scroll to bottom',
    defaultKeys: `shift+down`,
  },
  StartCall: {
    name: 'Start Call',
    defaultKeys: `${CMD_OR_CTRL}+k`,
  },
  ToggleMic: {
    name: 'Toggle Mic',
    defaultKeys: `${CMD_OR_CTRL}+y`,
  },
  ToggleVideo: {
    name: 'Toggle Video',
    defaultKeys: `${CMD_OR_CTRL}+alt+v`,
  },
  ToggleScreenShare: {
    name: 'Toggle Screen Share',
    defaultKeys: `${CMD_OR_CTRL}+alt+s`,
  },
  ConversationBack: {
    name: 'Go back to most recent conversation',
    defaultKeys: `${CMD_OR_CTRL}+shift+[`,
  },
  ConversationForward: {
    name: 'Go forward to most recent conversation',
    defaultKeys: `${CMD_OR_CTRL}+shift+]`,
  },
} satisfies Record<string, ShortcutConfig>;

export type KeyboardShortcuts = keyof typeof ALL_SHORTCUTS;
