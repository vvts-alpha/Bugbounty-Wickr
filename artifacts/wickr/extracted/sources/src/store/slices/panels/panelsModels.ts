import { PanelSide } from '@/componentlibrary/Panel';
import { ContactsPanelTab } from '@/components/Panels/ContactsPanel/ContactsPanel';

type Panels = {
  [K in PanelName]: PanelSide;
};

export type PanelName =
  | 'MessageInfoPanel'
  | 'ContactDetailsPanel'
  | 'EditContactPanel'
  | 'MainMenuPanel'
  | 'SettingsPanel'
  | 'RoomHistoryPanel'
  | 'SavedLinksPanel'
  | 'ConvoDetailsPanel'
  | 'EditConvoPanel'
  | 'AllConvoMembersPanel'
  | 'VerifyContactPanel'
  | 'SearchPanel'
  | 'LearnMoreVerificationPanel'
  | 'ContactsPanel'
  | 'NotificationsPanel'
  | 'ManageUsersPanel'
  | 'WickrAIChatPanel'
  | 'ViewUsersPanel';

export const PANEL_SIDES: Panels = {
  MessageInfoPanel: 'right',
  ContactDetailsPanel: 'right',
  EditContactPanel: 'right',
  MainMenuPanel: 'left',
  SettingsPanel: 'left',
  RoomHistoryPanel: 'right',
  SavedLinksPanel: 'right',
  ConvoDetailsPanel: 'right',
  EditConvoPanel: 'right',
  AllConvoMembersPanel: 'right',
  VerifyContactPanel: 'right',
  SearchPanel: 'right',
  LearnMoreVerificationPanel: 'right',
  ContactsPanel: 'right',
  ManageUsersPanel: 'right',
  NotificationsPanel: 'right',
  WickrAIChatPanel: 'right',
  ViewUsersPanel: 'right',
};

export const WIDE_PANELS: PanelName[] = ['SearchPanel'];

export type PanelsState = {
  panelStack: Panel[];
};

export type PanelCloseIcon = 'left-caret' | 'close';

export type BasePanel = {
  name: PanelName;
  closeIcon?: PanelCloseIcon;
};

export type Panel =
  | ContactDetailsPanelArgs
  | MessageInfoPanelArgs
  | MainMenuPanelArgs
  | SettingsPanelArgs
  | EditContactPanelArgs
  | RoomHistoryPanelArgs
  | SavedLinksPanelArgs
  | ConvoDetailsPanelArgs
  | EditConvoPanelArgs
  | AllConvoMembersPanelArgs
  | VerifyContactPanelArgs
  | SearchPanelArgs
  | LearnMoreVerificationPanelArgs
  | ContactsPanelArgs
  | NotificationsPanelArgs
  | ManageUsersPanelArgs
  | WickrAIChatPanelArgs
  | ViewUsersPanelArgs;

export interface MessageInfoPanelArgs extends BasePanel {
  name: 'MessageInfoPanel';
}

export interface RoomHistoryPanelArgs extends BasePanel {
  convoId: string;
  highlightedMsgId: string | undefined;
  name: 'RoomHistoryPanel';
}

export interface EditConvoPanelArgs extends BasePanel {
  convoId: string;
  name: 'EditConvoPanel';
}

export interface MainMenuPanelArgs extends BasePanel {
  name: 'MainMenuPanel';
}

export interface SettingsPanelArgs extends BasePanel {
  name: 'SettingsPanel';
}

export interface EditContactPanelArgs extends BasePanel {
  name: 'EditContactPanel';
  currentName: string;
  userIdHash: string;
}

export interface ContactDetailsPanelArgs extends BasePanel {
  name: 'ContactDetailsPanel';
  userIdHash?: string;
}

export interface ConvoDetailsPanelArgs extends BasePanel {
  name: 'ConvoDetailsPanel';
}

export interface SavedLinksPanelArgs extends BasePanel {
  name: 'SavedLinksPanel';
}

export interface AllConvoMembersPanelArgs extends BasePanel {
  convoId: string;
  name: 'AllConvoMembersPanel';
}

export interface VerifyContactPanelArgs extends BasePanel {
  name: 'VerifyContactPanel';
  userIdHash: string;
}

export interface SearchPanelArgs extends BasePanel {
  name: 'SearchPanel';
  initialStarred?: boolean;
}

export interface LearnMoreVerificationPanelArgs extends BasePanel {
  name: 'LearnMoreVerificationPanel';
}

export interface ContactsPanelArgs extends BasePanel {
  name: 'ContactsPanel';
  initialTab?: ContactsPanelTab;
}

export interface NotificationsPanelArgs extends BasePanel {
  name: 'NotificationsPanel';
}

export interface ManageUsersPanelArgs extends BasePanel {
  name: 'ManageUsersPanel';
}

export interface WickrAIChatPanelArgs extends BasePanel {
  name: 'WickrAIChatPanel';
  initialMessage?: string;
  systemPrompt?: string;
}

export interface ViewUsersPanelArgs extends BasePanel {
  name: 'ViewUsersPanel';
}
