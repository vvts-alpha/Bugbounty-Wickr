export type RoomSearchState = {
  results: SearchItem[];
};

export type SearchItemType = 'file' | 'message' | 'convo' | 'search' | 'star';

interface BaseSearchItem<T extends SearchItemType> {
  type: T;
}

export interface StarrableSearchItem {
  starred: boolean;
}

export interface NavigableSearchItem {
  convoName: string;
  vgroupId: string;
}

interface BaseMessageSearchItem<T extends SearchItemType>
  extends BaseSearchItem<T>,
    StarrableSearchItem,
    NavigableSearchItem {
  senderDisplayName: string;
  msgId: string;
  timestamp: number;
}

export interface FileSearchItem extends BaseMessageSearchItem<'file'> {
  fileName: string;
  fileType: string;
  fileUUID: string;
}

export interface MessageSearchItem extends BaseMessageSearchItem<'message'> {
  messageBody: string;
  mentions?: { start: number; end: number }[];
}

export interface ConvoSearchItem extends BaseSearchItem<'convo'>, NavigableSearchItem {
  isRoom: boolean;
}

export interface SearchSearchItem extends BaseSearchItem<'search'> {
  content: string;
}

interface BaseStarSearchItem extends BaseSearchItem<'star'> {}

export type StarFileSearchItem = BaseStarSearchItem & Omit<FileSearchItem, 'type'>;
export type StarMessageSearchItem = BaseStarSearchItem & Omit<MessageSearchItem, 'type'>;

export type StarSearchItem = StarFileSearchItem | StarMessageSearchItem;

export type SearchItem =
  | FileSearchItem
  | MessageSearchItem
  | ConvoSearchItem
  | SearchSearchItem
  | StarSearchItem;

export function isStarrableSearchItem(item: SearchItem) {
  return 'starred' in item;
}

export function isNavigableSearchItem(item: SearchItem) {
  return 'vgroupId' in item;
}

export function isMessageSearchItem(item: SearchItem): item is MessageSearchItem {
  return 'messageBody' in item && !!item.messageBody;
}

export function isFileSearchItem(item: SearchItem): item is FileSearchItem {
  return 'fileUUID' in item;
}
