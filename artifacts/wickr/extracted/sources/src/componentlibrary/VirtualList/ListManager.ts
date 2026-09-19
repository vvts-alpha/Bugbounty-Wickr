import { Logger } from '@/lib/logger';
import { ListLayoutManager } from './ListLayoutManager';
import { VirtualListItem } from './types';

export class ListManager {
  private keyItemMap = new Map<string, VirtualListItem<any>>();
  private keyIndexMap = new Map<string, number>();
  private listItemKeys: string[] = [];
  private listLayout = new ListLayoutManager();

  constructor(
    public readonly internalId: string,
    public readonly externalId: string | undefined,
    public order: number,
    private logger = new Logger(`VirtualList[${externalId ?? internalId}][${order}] ListManager`)
  ) {}

  setListItems = <T>(
    items: T[],
    keySelector: (item: T, index: number, listId: string) => string,
    initialHeight: number | ((item: T) => number)
  ) => {
    const keys = items.map((item, index) =>
      keySelector(item, index, this.externalId ?? this.internalId)
    );
    // remove deleted items from keyItemMap
    const keysSet = new Set(keys);
    for (const key of this.listItemKeys) {
      if (!keysSet.has(key)) {
        this.keyItemMap.delete(key);
      }
    }

    this.keyIndexMap.clear();
    const length = keys.length;
    // store heights to create FenwickTree in one pass
    const heights: number[] = [];
    for (let i = 0; i < length; i++) {
      const key = keys[i];
      const item = items[i];
      this.keyIndexMap.set(key, i);
      const virtualListItem = this.keyItemMap.get(key);
      const getTop = () => {
        try {
          return this.listLayout.getListItemTop(i);
        } catch (error) {
          this.logger.warn(`Failed to get prefix sum of index ${i}`, error);
          return 0;
        }
      };
      if (virtualListItem) {
        virtualListItem.item = item;
        virtualListItem.index = i;
        // assign a new top function since index has changed
        Object.defineProperty(virtualListItem, 'top', {
          get() {
            return getTop();
          },
        });
        heights.push(virtualListItem.height ?? virtualListItem.initialHeight);
      } else {
        const height = typeof initialHeight === 'number' ? initialHeight : initialHeight(items[i]);
        this.keyItemMap.set(key, {
          listInternalId: this.internalId,
          key,
          item,
          get top() {
            return getTop();
          },
          initialHeight: height,
          index: i,
        });
        heights.push(height);
      }
    }

    this.listLayout.updateList(heights);
    this.listItemKeys = keys;
  };

  /**
   * Updates the height of a specific list item
   *
   * The height change affects the total list height immediately,
   * but individual item position updates are deferred until calculateItemTops()
   * is called.
   *
   * @param key - The unique identifier of the list item
   * @param height - The new height of the list item
   */
  setListItemHeight(key: string, height: number): void {
    const item = this.keyItemMap.get(key);
    if (!item) return;

    const diff = height - (item.height ?? item.initialHeight);
    item.height = height;
    // Queue the update for later application to the FenwickTree
    this.listLayout.addListItemHeightUpdate(key, diff);
  }

  /**
   * Applies all pending height changes to update item positions
   *
   * This recalculates the cumulative top position of each item
   * by applying the pending height changes to the FenwickTree.
   * Call this method after scroll anchoring calculations to
   * finalize the new item positions.
   *
   * This is O(log N) where N is the number of items in the list
   */
  calculateItemTops() {
    this.listLayout.forEachListItemHeightUpdate((key, diff) => {
      const index = this.keyIndexMap.get(key);
      if (index !== undefined) {
        this.listLayout.updateListItemHeight(index, diff);
      }
    });
    this.listLayout.clearHeightUpdates();
  }

  getListItemKey(index: number): string | undefined {
    return this.listItemKeys[index];
  }

  getListItem(key: string): VirtualListItem<any> | undefined {
    return this.keyItemMap.get(key);
  }

  getListItemRect(key: string): VirtualListItem<any> | undefined;
  getListItemRect(index: number): VirtualListItem<any> | undefined;
  getListItemRect(id: string | number): VirtualListItem<any> | undefined {
    const key = typeof id === 'number' ? this.getListItemKey(id) : id;
    if (!key) return;
    return this.keyItemMap.get(key);
  }

  getListItemByIndex(index: number): VirtualListItem<any> | undefined {
    const key = this.getListItemKey(index);
    if (!key) return;
    return this.keyItemMap.get(key);
  }

  get size(): number {
    return this.listItemKeys.length;
  }

  /**
   * Returns the current total height of the list
   *
   * This includes both the committed height in the FenwickTree
   * and any pending height changes that haven't been applied yet.
   * This ensures the list container has the correct size even before
   * individual item positions are updated.
   */
  get height(): number {
    return this.listLayout.listHeight;
  }

  set height(height: number) {
    // We should not set list height directly since it's calculated by FenwickTree
    // but I don't want to create a different ListManager for non-vList items so there's a workaround
    // which creates a FenwickTree with single row
    this.listLayout.updateList([height]);
  }
}
