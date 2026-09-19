import { createContext } from 'react';
import { VirtualListItem } from './types';

export interface ICombinedListManager {
  addList: (internalId: string, externalId: string | undefined, order: number) => void;
  removeList: (internalId: string) => void;
  updateListOrder(internalId: string, order: number): void;
  setListItemKeys: <T>(
    internalId: string,
    items: T[],
    keySelector: (item: T, index: number, listId: string) => string,
    initialHeight: number | ((item: T) => number)
  ) => void;
  hasListItem: (internalId: string, key: string) => boolean;
  getListItem: <T>(internalId: string, key: string) => VirtualListItem<T> | undefined;
  setListHeight: (internalId: string, height: number) => void;
  setListItemHeight: (internalId: string, key: string, height: number) => void;
}

export interface VirtualListContextType extends ICombinedListManager {
  id: string;
  useRenderableListItems: <T>(internalId: string) => VirtualListItem<T>[];
  useListHeight: (internalId: string) => number;
}
export const VirtualListContext = createContext<VirtualListContextType | null>(null);
