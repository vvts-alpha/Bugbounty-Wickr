import { WickrConvo } from '@/lib/protobuf/convos';
import { WithMessagesEntities } from './messagesAdapter';

export type ConvoEntity = WickrConvo &
  ConvoMetadata &
  WithMessagesEntities &
  WebAppMetadata & {
    silenced?: boolean; // Labs feature: web-only, hides unread indicators
  };

export type ConvosState = {
  all: { [convoId: string]: ConvoEntity };
  // We need this duplicate state for silenecd convos because when we restore the state from storage on init
  // and attempt to set that convo.silenced state in redux, the convo may not have been fetched and may not exist yet
  silencedConvos: { [convoId: string]: boolean };
};

export const CONVO_MUTE_OPTIONS = ['1 hour', '8 hours', '1 week', 'Always'] as const;
export type ConvoMuteOptions = (typeof CONVO_MUTE_OPTIONS)[number] | null;

export type ConvoMetadata = {
  oldestMsgId?: string;
  newestMsgId?: string;
  oldestUnreadMsgId?: string;
  oldestUnreadMentionMsgId?: string;
  newestUnackErrorId?: string;
  activeConvoHasUnverifiedMembers?: boolean;
};

export type WebAppMetadata = {
  webApp?: {
    url?: string;
    loaded: boolean;
  };
};

export type SetActiveConvoHasUnverifiedMembersPayload = {
  vgroupId: string;
  activeConvoHasUnverifiedMembers: boolean;
};
