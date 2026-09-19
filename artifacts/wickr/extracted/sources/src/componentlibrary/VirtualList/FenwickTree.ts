/**
 * A Fenwick / Binary-Indexed Tree that stores a sequence of numbers
 * and supports O(log N) prefix-sum queries and point updates.
 *
 *   heights[i]  = height of row i          (0-based)
 *   prefixSum(i) = Σ heights[0 … i-1]      (exclusive prefix)
 *
 *   Example usage for vList:
 *   // height change of one row:
 *   tree.update(index, newH - oldH);
 *
 *   // Y-offset of row i:
 *   const topPx = tree.prefixSum(i);
 *
 *   // full list scroll height:
 *   const totalPx = tree.total();
 */
export class FenwickTree {
  /**
   * Use Float32Array to optimize both memory consumption and computational performance
   *
   *  Type	        Per Item Size	           100M Elements
   *  Float32Array	4 bytes	                 ~400 MB
   *  Float64Array	8 bytes	                 ~800 MB
   *  number[]	    8 bytes + overhead	     ~1.6–3.2 GB+
   */
  private readonly bit: Float32Array; // 1-based: bit[0] is unused
  readonly length: number;
  private readCache = new Map<number, number>();

  /** Create an empty tree that can hold `n` values. */
  constructor(n: number) {
    if (n < 0) throw new Error('FenwickTree length must be ≥ 0');
    this.length = n;
    this.bit = new Float32Array(n + 1); // 1-based
  }

  /** O(log N) – add delta to element at position i (0-based). */
  update(index: number, delta: number): void {
    if (index < 0 || index >= this.length) {
      throw new RangeError(`index ${index} out of [0, ${this.length})`);
    }
    // Convert to 1-based index inside the loop
    for (let i = index + 1; i <= this.length; i += FenwickTree.getLSB(i)) {
      this.bit[i] += delta;
    }
    // clear all cache on any update
    this.readCache.clear();
  }

  /**
   * O(log N) – prefix sum up to and excluding index `i`:
   *   prefixSum(i) = Σ values[0 … i-1]
   *   Use i = 0 for 0, i = length for the total
   */
  prefixSum(index: number): number {
    if (index < 0 || index > this.length) {
      throw new RangeError(`i ${index} out of [0, ${this.length}]`);
    }
    // Reduce prefix sum to O(1) for repeated call for the same index
    const cachedSum = this.readCache.get(index);
    if (cachedSum !== undefined) {
      return cachedSum;
    }
    let sum = 0;
    for (let i = index; i > 0; i -= FenwickTree.getLSB(i)) {
      sum += this.bit[i];
    }
    this.readCache.set(index, sum);
    return sum;
  }

  /** O(log N) – inclusive prefix up to and including index `i`. */
  prefixSumInclusive(index: number): number {
    return this.prefixSum(index + 1);
  }

  /** O(1) – total of all elements. */
  total(): number {
    return this.prefixSum(this.length);
  }
  /**
   * Calculates the Least Significant Bit of a given index.
   *
   * The LSB is the rightmost bit that is set to 1 in the binary representation of the number, used to get the size of the range that index convers.
   */
  private static getLSB(index: number) {
    return index & -index;
  }

  /**
   * O(N) - build a tree directly from an existing array.
   */
  static fromArray(values: readonly number[]): FenwickTree {
    const tree = new FenwickTree(values.length);
    // Copy values (1-based) then build in one pass.
    tree.bit.set(values, 1);
    for (let i = 1; i <= values.length; ++i) {
      const parent = i + FenwickTree.getLSB(i);
      if (parent <= values.length) tree.bit[parent] += tree.bit[i];
    }
    return tree;
  }
}
