import { FenwickTree } from './FenwickTree';

/**
 * Manages list height, item top calculation, and item height updates
 */
export class ListLayoutManager {
  private topsTree = new FenwickTree(0);
  // Maps item keys to their pending height changes
  private updates = new Map<string, number>();
  // Tracks the total impact of pending changes on list height
  public pendingTotalChange = 0;

  /**
   * Initialize or re-initialize the list with the given heights
   */
  updateList(heights: number[]) {
    this.topsTree = FenwickTree.fromArray(heights);
  }

  /**
   * Updates the height of a list item
   * @param diff - The change in height (positive or negative)
   */
  updateListItemHeight(index: number, diff: number) {
    this.topsTree.update(index, diff);
  }

  /**
   * Registers a height change for a list item that will be applied later
   *
   * @param key - The id of the list item
   * @param diff - The change in height (positive or negative)
   */
  addListItemHeightUpdate(key: string, diff: number): void {
    // If we already have a pending update for this key, combine them
    const existingDiff = this.updates.get(key) || 0;
    const newDiff = existingDiff + diff;

    // Update the total height change for immediate height calculation
    this.pendingTotalChange += diff;
    this.updates.set(key, newDiff);
  }

  /**
   * Consumes all stored updates by applying a callback function to each key-diff pair
   */
  forEachListItemHeightUpdate(fn: (key: string, diff: number) => void): void {
    for (const [key, diff] of this.updates.entries()) {
      fn(key, diff);
    }
  }

  getListItemTop(index: number): number {
    return this.topsTree.prefixSum(index);
  }

  get listHeight(): number {
    return this.topsTree.total() + this.pendingTotalChange;
  }

  /**
   * Clears all pending updates
   */
  clearHeightUpdates(): void {
    this.updates.clear();
    this.pendingTotalChange = 0;
  }
}
