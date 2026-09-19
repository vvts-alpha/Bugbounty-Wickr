import { Emitter } from '@amzn/async-utils';

type HistoryState<T> = {
  index: number;
  length: number;
  currentValue: T;
};

type HistoryEvent<T> = HistoryState<T> & { amount: number };

export class HistoryStack<T> extends Emitter<{ navigate: HistoryEvent<T> }> {
  private stack: T[] = [];
  private index = -1;

  constructor(readonly maxLength: number = Infinity) {
    super();
  }

  back(): boolean {
    return this.go(-1);
  }

  forward(): boolean {
    return this.go(1);
  }

  getState(): HistoryState<T | undefined> {
    const { index } = this;
    return {
      index,
      length: this.stack.length,
      currentValue: this.stack[index],
    };
  }

  go(amount: number): boolean {
    if (amount === 0) return true; // No change needed for zero movement

    const nextIndex = this.index + amount;
    if (nextIndex >= 0 && nextIndex < this.stack.length) {
      this.index = nextIndex;
      // We know state is defined here
      const state = this.getState() as HistoryState<T>;
      this.emit('navigate', { ...state, amount });
      return true;
    } else {
      return false;
    }
  }

  push(next: T) {
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }

    // If we've exceeded maxLength, remove oldest item
    if (this.stack.length >= this.maxLength) {
      this.stack.shift();
      this.index = Math.max(-1, this.index - 1);
    }

    this.index = this.stack.length;
    this.stack.push(next);
  }

  replace(item: T): void {
    if (this.index >= 0) {
      this.stack[this.index] = item;
    } else if (this.stack.length === 0) {
      // If the stack is empty, this is equivalent to push
      this.push(item);
    }
  }
}
