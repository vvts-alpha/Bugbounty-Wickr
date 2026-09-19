export type ItemHeightType = 'static' | 'dynamic';

export interface VirtualListItem<T> {
  listInternalId: string;
  item: T;
  key: string;
  top: number;
  initialHeight: number;
  height?: number;
  index: number;
}

export interface VirtualListHeight {
  listInternalId: string;
  height: number;
}

export enum AnchorType {
  Primary,
  Secondary,
  Tertiary,
}

export enum VirtualListScrollToLocation {
  Top = 1,
  Bottom,
}

export type VirtualListScrollToItem = { listItemsId: string; itemKey: string; offset?: number };

export type VirtualListScrollTo = VirtualListScrollToItem | VirtualListScrollToLocation;
export type SingleVirtualListScrollTo =
  | Omit<VirtualListScrollToItem, 'listItemsId'>
  | VirtualListScrollToLocation;

export const DEFAULT_LIST_ITEMS_ID = 'default';
export const DEFAULT_HEADER_LIST_ITEMS_ID = 'default-header';
export const DEFAULT_FOOTER_LIST_ITEMS_ID = 'default-footer';

export const getDataScrollId = (listInternalId: string, itemKey: string) =>
  `${listInternalId}-${itemKey}`;
export const getDataScrollIdSelector = (listInternalId: string, itemKey: string) =>
  `[data-scroll-id='${getDataScrollId(listInternalId, itemKey)}']`;
