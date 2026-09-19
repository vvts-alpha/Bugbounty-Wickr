import { RefObject } from 'react';
import OrderedLinkedList from '@/lib/cache/OrderedLinkedList';
import { Logger } from '@/lib/logger';
import { isHtmlElement } from '@/utils/dom';
import { binarySearch } from '@/utils/math';
import { safeStringify } from '@/utils/strings';
import { ListManager } from './ListManager';
import {
  AnchorType,
  DEFAULT_LIST_ITEMS_ID,
  getDataScrollIdSelector,
  VirtualListHeight,
  VirtualListItem,
  VirtualListScrollTo,
  VirtualListScrollToLocation,
} from './types';
const anchorTypeValues = Object.values(AnchorType).filter(
  (value): value is AnchorType => typeof value === 'number'
);
// TODO: Add comments
export class CombinedListManager {
  private lists = new OrderedLinkedList<string, ListManager>(
    (a, b) => a.order - b.order,
    (list) => list.internalId
  );
  private isScrollAnchorEnabled = false;
  private isUpdateEnabled = true;
  private availableAnchors: Map<AnchorType, VirtualListScrollTo | undefined> = new Map();
  private anchorScrollTop: number | undefined;
  private anchorOffset = 0;
  public insideAnchorSelector: string | undefined;
  public visibleItems: VirtualListItem<any>[] = [];
  public renderableItems: VirtualListItem<any>[] = [];
  constructor(
    public virtualListId: string,
    private containerRef: RefObject<HTMLElement>,
    private logger = new Logger(`VirtualList[${virtualListId}] CombinedListManager`)
  ) {}

  addList = (internalId: string, externalId: string | undefined, order: number) => {
    this.lists.upsert(new ListManager(internalId, externalId, order));
  };

  removeList = (internalId: string) => {
    this.lists.delete(internalId);
  };

  updateListOrder = (id: string, order: number) => {
    const list = this.lists.get(id);
    if (!list) return;
    list.order = order;
    this.saveAnchorTop();
    this.lists.reorder(id);
  };

  setListItemKeys = <T>(
    id: string,
    items: T[],
    keySelector: (item: T, index: number, listId: string) => string,
    initialHeight: number | ((item: T) => number)
  ) => {
    this.saveAnchorTop();
    this.lists.get(id)?.setListItems(items, keySelector, initialHeight);
  };

  setListHeight = (id: string, height: number) => {
    const list = this.lists.get(id);
    if (!list) return;
    if (list.height === height) return;
    this.saveAnchorTop();
    list.height = height;
  };

  setListItemHeight = (id: string, key: string, height: number) => {
    if (!this.isUpdateEnabled) return;
    this.saveAnchorTop();
    this.lists.get(id)?.setListItemHeight(key, height);
  };

  setIsScrollAnchorEnabled = (enabled: boolean) => {
    this.isScrollAnchorEnabled = enabled;
  };

  setIsUpdateEnabled = (enabled: boolean) => {
    this.isUpdateEnabled = enabled;
  };

  saveAnchorTop = () => {
    if (this.anchorScrollTop) return;
    const anchorScrollId = this.getScrollAnchor();
    this.anchorScrollTop = anchorScrollId ? this.getScrollAnchorTop(anchorScrollId) : undefined;
  };

  private calculateListItemTops = () => {
    this.saveAnchorTop();
    for (const [_, list] of this.lists) {
      list.calculateItemTops();
    }

    const anchorScrollId = this.getScrollAnchor();
    if (anchorScrollId !== undefined) {
      const newAnchorTop = this.getScrollAnchorTop(anchorScrollId);
      if (
        this.anchorScrollTop !== undefined &&
        newAnchorTop !== undefined &&
        this.anchorScrollTop !== newAnchorTop
      ) {
        // items above anchor have changed
        this.anchorOffset = newAnchorTop - this.anchorScrollTop;
        this.logger.debug(
          `calculateListItemTops: anchor ${safeStringify(anchorScrollId)} changed, diff ${
            this.anchorOffset
          }`
        );
      }
    }
  };

  getScrollAnchorTop = (scrollTo: VirtualListScrollTo) => {
    if (scrollTo === VirtualListScrollToLocation.Top) {
      return 0;
    } else if (scrollTo === VirtualListScrollToLocation.Bottom) {
      return this.height;
    } else {
      const translatedId = this.getListInternalId(scrollTo.listItemsId) ?? scrollTo.listItemsId;
      let anchorTop = this.getListItemTop(translatedId, scrollTo.itemKey);

      if (anchorTop !== undefined && this.insideAnchorSelector && this.containerRef.current) {
        const container = this.containerRef.current;
        const anchorElement = container.querySelector(
          getDataScrollIdSelector(translatedId, scrollTo.itemKey)
        );
        if (anchorElement) {
          const innerAnchorElement = anchorElement.querySelector(this.insideAnchorSelector);
          if (innerAnchorElement && isHtmlElement(innerAnchorElement)) {
            anchorTop += innerAnchorElement.offsetTop;
          } else {
            this.logger.warn(
              `getScrollAnchorTop: innerAnchorElement not found or not a HTMLElement for ${getDataScrollIdSelector(
                scrollTo.listItemsId,
                scrollTo.itemKey
              )}`
            );
          }
        }
      }
      return anchorTop;
    }
  };

  getListItemTop = (listInternalId: string, key: string) => {
    const item = this.getListItem(listInternalId, key);
    if (!item) return;
    let top = item.top;
    for (const [_, list] of this.lists) {
      if (list.internalId === item.listInternalId) break;
      top += list.height;
    }
    return top;
  };

  hasListItem = (listInternalId: string, key: string) => {
    return !!this.getListItem(listInternalId, key);
  };

  getListItem = (listInternalId: string, key: string) => {
    for (const [_, list] of this.lists) {
      if (list.internalId === listInternalId) return list.getListItem(key);
    }
  };

  getListItemByIndex = (index: number) => {
    for (const [_, list] of this.lists) {
      if (index < list.size) return list.getListItemByIndex(index);
      index -= list.size;
    }
  };

  getListInternalId = (listExternalId: string) => {
    for (const [_, list] of this.lists) {
      if (list.externalId === listExternalId) return list.internalId;
    }
  };

  get height() {
    let height = 0;
    for (const [_, list] of this.lists) {
      height += list.height;
    }
    return height;
  }

  get size() {
    let size = 0;
    for (const [_, list] of this.lists) {
      size += list.size;
    }
    return size;
  }

  get listHeights(): VirtualListHeight[] {
    const listHeights: VirtualListHeight[] = [];
    for (const [_, list] of this.lists) {
      listHeights.push({
        listInternalId: list.internalId,
        height: list.height,
      });
    }
    return listHeights;
  }

  calculateRenderableKeys = (
    scrollTop: number,
    containerHeight: number,
    prerenderOffset: number,
    recalculateListItemsTops = true
  ) => {
    if (!this.isUpdateEnabled) return this.anchorOffset;
    if (recalculateListItemsTops) {
      this.calculateListItemTops();
    }
    const prerenderScrollTop = scrollTop - prerenderOffset;
    const prerenderHeight = containerHeight + prerenderOffset * 2;
    const visibleItems: VirtualListItem<any>[] = [];
    const renderableItems: VirtualListItem<any>[] = [];

    // Binary search to find the first potentially renderable item
    // The search returns the index where prerenderScrollTop should be placed within the sorted item tops:
    //  - If the index is positive, it means an exact match was found, and we can use the index directly.
    //  - If the index is negative, it means no exact match was found, and the returned value indicates the insertion point.
    //    Since the insertion point always points to an existing top that is greater than prerenderScrollTop,
    //    we need to subtract 1 to include one additional item above that point.
    const { index, insertionIndex } = binarySearch(
      this.size,
      (index) => {
        const item = this.getListItemByIndex(index);
        if (!item) return;
        const itemTop = this.getListItemTop(item.listInternalId, item.key);
        if (itemTop === undefined) return;
        return itemTop;
      },

      (itemTop) => {
        // if itemTop is undefined (which should not happen), stop searching
        if (itemTop === undefined) {
          this.logger.error(`calculateRenderableKeys: an itemTop is undefined`);
          return 0;
        }
        return prerenderScrollTop - itemTop;
      }
    );

    const firstRenderableIndex = index !== undefined ? index : Math.max(0, insertionIndex - 1); // Go back one item, see comments above

    // Check items from firstRenderableIndex until we find one that doesn't overlap
    for (let i = firstRenderableIndex; i < this.size; i++) {
      const item = this.getListItemByIndex(i);
      if (!item) continue;

      const itemHeight = item.height ?? item.initialHeight;
      const itemTop = this.getListItemTop(item.listInternalId, item.key);
      if (itemTop === undefined) continue;
      if (this.hasOverlap(prerenderScrollTop, prerenderHeight, itemTop, itemHeight)) {
        renderableItems.push(item);

        // Check if item is visible (without prerender offset)
        if (this.hasOverlap(scrollTop, containerHeight, itemTop, itemHeight)) {
          visibleItems.push(item);
        }
      } else if (itemTop > prerenderScrollTop + prerenderHeight) {
        // If we've gone past the prerender area, we can stop
        break;
      }
    }

    this.visibleItems = visibleItems;
    this.renderableItems = renderableItems;
    const prevAnchorOffset = this.anchorOffset;
    this.anchorOffset = 0;
    this.anchorScrollTop = undefined;
    return prevAnchorOffset;
  };

  private hasOverlap = (topA: number, heightA: number, topB: number, heightB: number) => {
    // calculate the bottom of each rectangle
    const bottomA = topA + heightA;
    const bottomB = topB + heightB;

    // checks if one rectangle is completely above the other.
    // if bottomA is less than or equal to topB, it means the first rectangle is entirely above the second one,
    // and there's no overlap, verse vice.
    if (bottomA <= topB || bottomB <= topA) {
      return false;
    }

    // If there is some overlap
    return true;
  };

  setScrollAnchor = (
    anchor: VirtualListScrollTo | undefined,
    type: AnchorType = AnchorType.Primary
  ) => {
    if (!this.isScrollAnchorEnabled || !this.isUpdateEnabled) return;
    if (safeStringify(this.availableAnchors.get(type)) !== safeStringify(anchor)) {
      this.logger.debug('setScrollAnchor', `${AnchorType[type]} anchor changed`, anchor);
      if (anchor && typeof anchor !== 'number' && !anchor.listItemsId) {
        anchor.listItemsId = DEFAULT_LIST_ITEMS_ID;
      }
      this.availableAnchors.set(type, anchor);
    }
  };

  getScrollAnchor = () => {
    if (!this.isScrollAnchorEnabled || !this.isUpdateEnabled) return;
    const firstAvailableAnchor = anchorTypeValues
      .map((typeValue) => this.availableAnchors.get(typeValue))
      .find((anchor) => anchor !== undefined);
    return firstAvailableAnchor;
  };
}
