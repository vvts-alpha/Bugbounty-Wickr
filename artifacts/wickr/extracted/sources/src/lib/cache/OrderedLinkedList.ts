class ListNode<TId, TValue> {
  id: TId;
  value: TValue;
  next: ListNode<TId, TValue> | null = null;
  prev: ListNode<TId, TValue> | null = null;

  constructor(id: TId, value: TValue) {
    this.id = id;
    this.value = value;
  }
}

interface ListRecord<TId, TValue> {
  id: TId;
  value: TValue;
}

export default class OrderedLinkedList<TId, TValue> {
  private head: ListNode<TId, TValue> | null = null;
  private tail: ListNode<TId, TValue> | null = null;
  private idToNodeMap: Map<TId, ListNode<TId, TValue>> = new Map();

  constructor(
    private sortComparator: (a: TValue, b: TValue) => number,
    private idSelector?: (item: TValue) => TId
  ) {}

  upsert(item: TValue): void {
    this.upsertMany([item]);
  }

  upsertMany(items: TValue[]): void {
    if (!items || !items.length) return;
    const idSelector = this.idSelector;
    if (!idSelector) throw new Error('idSelector must be set for upsertMany');
    const records = items.map((item) => ({ id: idSelector(item), value: item }));
    this.upsertManyRecords(records);
  }

  upsertRecord(record: ListRecord<TId, TValue>): void {
    this.upsertManyRecords([record]);
  }

  upsertManyRecords(records: ListRecord<TId, TValue>[]): void {
    if (!records || !records.length) return;
    // remove items with duplicated id and keep the last ones
    const uniqueItems = records.length === 1 ? records : this.removeDuplicatesKeepLast(records);
    // sort the items based on a comparison function
    // ensures that items are processed in the correct order for insertion
    const sortedUniqueItems =
      records.length === 1
        ? records
        : uniqueItems.sort((a, b) => this.sortComparator(a.value, b.value));
    // delete any existing node in the list that has the same id
    // allowing us to correctly re-insert them at their updated positions based on their new values.
    sortedUniqueItems.forEach((i) => this.delete(i.id));
    // start from the head of the list
    let currentNode = this.head;
    // keep track of the previous node to manage insertions
    let prevNode: ListNode<TId, TValue> | null = null;
    // index to iterate over the sorted items
    let itemIndex = 0;

    // iterate over all items
    while (itemIndex < sortedUniqueItems.length) {
      const { id: currentId, value: currentValue } = sortedUniqueItems[itemIndex];

      // if list is empty or we reach the end of the list
      if (!currentNode) {
        const newNode = new ListNode(currentId, currentValue);
        // replace or insert node
        this.idToNodeMap.set(currentId, newNode);

        // link the new node with the previous node, if it exists
        if (prevNode) {
          prevNode.next = newNode;
          newNode.prev = prevNode;
        } else {
          // if the list is empty, set the new node as head
          this.head = newNode;
        }
        // set the new node as the new tail of the list
        this.tail = newNode;

        itemIndex++;
        prevNode = newNode;
      } else {
        // if the current value should be inserted before the current node
        if (this.sortComparator(currentValue, currentNode.value) < 0) {
          const newNode = new ListNode(currentId, currentValue);
          this.idToNodeMap.set(currentId, newNode);

          newNode.next = currentNode;
          newNode.prev = prevNode;

          if (prevNode) {
            // adjust the previous node's next pointer
            prevNode.next = newNode;
          } else {
            // if inserting at the beginning, update the head
            this.head = newNode;
          }
          // update the current node's previous pointer
          currentNode.prev = newNode;
          prevNode = newNode;
          itemIndex++;
        } else {
          // if the current value should be inserted after the current node (even if compare result is equal)
          // move to the next node for further comparison
          prevNode = currentNode;
          currentNode = currentNode.next;
        }
      }
    }
  }

  private removeDuplicatesKeepLast(items: ListRecord<TId, TValue>[]): ListRecord<TId, TValue>[] {
    const idToLastIndexMap = new Map<TId, number>();
    const uniqueItems = [];

    for (let i = 0; i < items.length; i++) {
      const currentItem = items[i];
      const lastIndex = idToLastIndexMap.get(currentItem.id);
      if (lastIndex === undefined) {
        // if the id is unique so far, push it to the uniqueItems array
        // and store its index
        idToLastIndexMap.set(currentItem.id, uniqueItems.length);
        uniqueItems.push(items[i]);
      } else {
        // found a duplicated id, update the result with its latest appearance
        uniqueItems[lastIndex] = items[i];
      }
    }

    return uniqueItems;
  }

  reorder(id: TId) {
    if (this.size <= 1) return;
    const node = this.idToNodeMap.get(id);
    if (!node) return;

    const prevCompare = node.prev ? this.sortComparator(node.prev.value, node.value) : 0;
    const nextCompare = node.next ? this.sortComparator(node.next.value, node.value) : 0;

    // if the node is already in the correct order, do nothing
    if (prevCompare <= 0 && nextCompare >= 0) return;

    let currentNode = node;
    if (prevCompare > 0) {
      do {
        if (!currentNode.prev) break;
        this.swap(currentNode, currentNode.prev);
        currentNode = currentNode.prev;
      } while (
        currentNode.prev &&
        this.sortComparator(currentNode.prev.value, currentNode.value) > 0
      );
    } else if (nextCompare < 0) {
      do {
        if (!currentNode.next) break;
        this.swap(currentNode, currentNode.next);
        currentNode = currentNode.next;
      } while (
        currentNode.next &&
        this.sortComparator(currentNode.next.value, currentNode.value) < 0
      );
    }
  }

  private swap(a: ListNode<TId, TValue>, b: ListNode<TId, TValue>) {
    const tempId = a.id;
    const temp = a.value;
    a.value = b.value;
    a.id = b.id;
    b.id = tempId;
    b.value = temp;
    this.idToNodeMap.set(a.id, a);
    this.idToNodeMap.set(b.id, b);
  }

  toArray(): TValue[] {
    const values: TValue[] = new Array(this.size);
    let currentNode = this.head;

    for (let i = 0; i < this.size; i++) {
      if (!currentNode) break;
      values[i] = currentNode.value;
      currentNode = currentNode.next;
    }

    return values;
  }

  delete(id: TId): boolean {
    const node = this.idToNodeMap.get(id);

    if (!node) return false;

    if (node.prev) {
      // if previous node is not null
      // connect previous node to next node
      node.prev.next = node.next;
    } else {
      // if previous node is null, meaning the node is the head node
      // set new head to next node
      this.head = node.next;
    }

    if (node.next) {
      // if next node is not null
      // connect previous node to next node
      node.next.prev = node.prev;
    } else {
      // if next node is null, meaning the node is the tail node
      // set new tail to previous node
      this.tail = node.prev;
    }

    this.idToNodeMap.delete(id);

    return true;
  }

  clear(): void {
    this.head = null;
    this.tail = null;
    this.idToNodeMap.clear();
  }

  toArrayByRange(
    id: TId,
    before: number | 'infinite',
    after: number | 'infinite',
    interruptCallback = (_id: TId): boolean => true
  ): TValue[] | false {
    const node = this.idToNodeMap.get(id);
    if (!node) return false;

    const values: TValue[] = [];
    let currentNode = node.prev;
    while ((before === 'infinite' || before > 0) && currentNode) {
      if (!interruptCallback(currentNode.id)) return false;
      values.unshift(currentNode.value);
      currentNode = currentNode.prev;
      before === 'infinite' || before--;
    }

    values.push(node.value);

    currentNode = node.next;
    while ((after === 'infinite' || after > 0) && currentNode) {
      if (!interruptCallback(currentNode.id)) return false;
      values.push(currentNode.value);
      currentNode = currentNode.next;
      after === 'infinite' || after--;
    }

    return values;
  }

  get first(): TValue | undefined {
    return this.head?.value;
  }

  get last(): TValue | undefined {
    return this.tail?.value;
  }

  get size(): number {
    return this.idToNodeMap.size;
  }

  has(id: TId): boolean {
    return this.idToNodeMap.has(id);
  }

  get(id: TId): TValue | undefined {
    return this.idToNodeMap.get(id)?.value;
  }

  getPrevious(id: TId): TValue | undefined {
    const node = this.idToNodeMap.get(id);
    return node?.prev?.value;
  }

  getNext(id: TId): TValue | undefined {
    const node = this.idToNodeMap.get(id);
    return node?.next?.value;
  }

  find(predicate: (value: TValue) => boolean): TValue | undefined {
    let currentNode = this.head;

    while (currentNode) {
      if (predicate(currentNode.value)) {
        return currentNode.value;
      }
      currentNode = currentNode.next;
    }
  }

  findLast(predicate: (value: TValue) => boolean): TValue | undefined {
    let currentNode = this.tail;

    while (currentNode) {
      if (predicate(currentNode.value)) {
        return currentNode.value;
      }
      currentNode = currentNode.prev;
    }
  }

  *[Symbol.iterator](): IterableIterator<[TId, TValue]> {
    let current = this.head;
    while (current) {
      yield [current.id, current.value] as [TId, TValue];
      current = current.next;
    }
  }

  forEach(
    callbackfn: (value: TValue, id: TId, list: OrderedLinkedList<TId, TValue>) => void,
    thisArg?: any
  ): void {
    let current = this.head;
    while (current) {
      callbackfn.call(thisArg, current.value, current.id, this);
      current = current.next;
    }
  }
}
