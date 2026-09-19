import { WickrMessage } from '@/lib/protobuf/messages';

import OrderedLinkedList from './OrderedLinkedList';

export const DEFAULT_MAX_CACHE_SIZE = 300;
export const CACHE_OVER_CLEAR_RATIO = 0.25;
/**
 * Cache messages into memory efficiently
 *
 */
export class MessageCache {
  // messages will be divided into different groups
  // messages in a same group are considered as consecutive messages
  private msgIdToMetadataMap = new Map<string, { groupId: number; lastAccessTime: number }>();

  private msgIdToSubscriptionMap = new Map<
    string,
    Set<(message: WickrMessage | undefined) => void>
  >();

  // incremental group id, used for creating new group
  // We intentionally set the initial value to 1 here, so that we can do simple compare like if (currentGroupId)
  private currentGroupId = 1;
  // contains the actual messages
  private messages: OrderedLinkedList<string, WickrMessage> = new OrderedLinkedList(
    (a, b) => a.timeStamp - b.timeStamp,
    (m) => m.msgId
  );
  private oldestMsgId?: string;
  private newestMsgId?: string;

  public lastAccessTime = 0;

  constructor(private maxCacheSize = DEFAULT_MAX_CACHE_SIZE) {}

  /**
   * Update messages boundary for cache to check if requested messages are all cached
   */
  public updateBoundary(oldestMsgId?: string, newestMsgId?: string) {
    this.oldestMsgId = oldestMsgId ?? this.oldestMsgId;
    this.newestMsgId = newestMsgId ?? this.newestMsgId;
  }

  /**
   * Update or insert new messages
   */
  public upsertMany(newMessages: WickrMessage[]) {
    if (!newMessages?.length) return;
    // shallow copy
    newMessages = [...newMessages];
    // ideally the newMessages are in timeStamp order already, but just in case
    newMessages.sort((a, b) => a.timeStamp - b.timeStamp);
    // find existing messages that has the same ids compare to new messages, return their group ids
    const overlappedGroupIds = new Set(
      newMessages
        .map((m) => this.msgIdToMetadataMap.get(m.msgId)?.groupId)
        .filter((id) => id !== undefined)
    );

    // get first group id of the set
    let [groupId] = overlappedGroupIds;

    if (overlappedGroupIds.size === 0) {
      // no overlap, create a new group
      groupId = this.currentGroupId++;
    } else if (overlappedGroupIds.size > 1 && groupId) {
      // multiple overlaps, merge all overlapped groups to a same group
      for (const msgId of this.msgIdToMetadataMap.keys()) {
        const metadata = this.msgIdToMetadataMap.get(msgId);
        if (metadata && overlappedGroupIds.has(metadata.groupId)) {
          metadata.groupId = groupId;
        }
      }
    }

    if (groupId) {
      const accessTime = Date.now();
      // assign new messages to the determined group
      newMessages.forEach((m) =>
        this.msgIdToMetadataMap.set(m.msgId, { groupId: groupId!, lastAccessTime: accessTime })
      );
    }

    this.messages.upsertMany(newMessages);
    newMessages.forEach((m) => this.msgIdToSubscriptionMap.get(m.msgId)?.forEach((c) => c(m)));

    // delete old messages if cache size exceeds maxCacheSize
    if (this.messages.size > this.maxCacheSize) {
      const metadata = Array.from(this.msgIdToMetadataMap);
      // sort by last access time, oldest first
      const sortedMetadata = metadata.sort((a, b) => a[1].lastAccessTime - b[1].lastAccessTime);
      // keep only 75% maxCacheSize messages and delete the rest
      const toDelete = sortedMetadata.slice(
        0,
        this.messages.size -
          this.maxCacheSize +
          Math.round(this.maxCacheSize * CACHE_OVER_CLEAR_RATIO)
      );
      this.removeMany(toDelete.map((m) => m[0]));
    }
  }

  public removeMany(msgIds: string[]) {
    return msgIds.filter((id) => this.remove(id)).length;
  }

  /**
   * remove a message from cache, call this when the actual message is not deleted
   */
  private remove(msgId: string) {
    // if the actual message is not deleted, we will split the message group in addition to deleting the message
    // otherwise, messages might be incorrectly linked
    const groupId = this.msgIdToMetadataMap.get(msgId)?.groupId;
    const prevMsg = this.messages.getPrevious(msgId);
    let nextMsg = this.messages.getNext(msgId);
    // if the message to be deleted is in between other messages
    if (groupId && prevMsg && nextMsg) {
      // divide the group that the message belongs to into two
      const newGroupId = this.currentGroupId++;
      // messages before the deleted messages remain unchanged
      // messages after the deleted messages will be assigned to a new group
      // loop through all messages after the deleted messages that are in the group
      let nextMsgMeta = this.msgIdToMetadataMap.get(nextMsg.msgId);
      while (nextMsgMeta?.groupId === groupId) {
        // continue as long as the next message is in the same group
        nextMsgMeta.groupId = newGroupId; // assign it to new group
        nextMsg = this.messages.getNext(nextMsg.msgId);
        if (!nextMsg) break;
        nextMsgMeta = this.msgIdToMetadataMap.get(nextMsg.msgId);
      }
    }
    return this.delete(msgId);
  }

  /**
   * delete a message
   */
  public delete(msgId: string) {
    this.msgIdToMetadataMap.delete(msgId);
    this.msgIdToSubscriptionMap.get(msgId)?.forEach((c) => c(undefined));
    return this.messages.delete(msgId);
  }

  /**
   * delete many messages, return actual deleted count
   */
  public deleteMany(msgIds: string[]) {
    return msgIds.filter((id) => this.delete(id)).length;
  }

  /**
   * clear all messages
   */
  public clear() {
    this.msgIdToMetadataMap.clear();
    this.messages.clear();
    this.currentGroupId = 1;
  }

  private updateAccessTime(messages: (WickrMessage | undefined)[]) {
    const accessTime = Date.now();
    messages.forEach((m) => {
      if (!m) return;
      const metadata = this.msgIdToMetadataMap.get(m.msgId);
      if (metadata) {
        metadata.lastAccessTime = accessTime;
      }
    });
    this.lastAccessTime = accessTime;
  }

  public getRange(
    id: string,
    before: number | 'infinite',
    after: number | 'infinite'
  ): WickrMessage[] | false {
    const groupId = this.msgIdToMetadataMap.get(id)?.groupId;
    if (groupId === undefined) {
      return false;
    }
    const messages = this.messages.toArrayByRange(
      id,
      before,
      after,
      (id) => groupId === this.msgIdToMetadataMap.get(id)?.groupId
    );
    /**
     * The checks below assume message boundary is set properly via updateBoundary
     */
    // return false if toArrayByRange returns nothing (out of current group range)
    if (messages === false) return false;
    // ignore before check if
    // oldestMsgId is defined and match the first message id in requested messages
    // OR before is 'infinite'
    if ((this.oldestMsgId && this.oldestMsgId === messages[0]?.msgId) || before === 'infinite') {
      before = 0;
    }
    // ignore after check if
    // newestMsgId is defined and match the last message id in requested messages
    // OR after is 'infinite'
    if (
      (this.newestMsgId && this.newestMsgId === messages[messages.length - 1]?.msgId) ||
      after === 'infinite'
    ) {
      after = 0;
    }
    // return false if we requested more than one message but get only one or nothing
    if (before + after > 0 && messages.length <= 1) return false;
    // return results if there's no need to check
    this.updateAccessTime(messages);
    if (before + after === 0) return messages;

    const targetMessageIndex = messages.findIndex((m) => m.msgId === id);
    // return false if the number of messages before target message doesn't match requested number
    if (before > 0 && targetMessageIndex !== before) return false;
    // return false if the number of messages after target message doesn't match requested number
    if (after > 0 && messages.length - targetMessageIndex - 1 !== after) return false;
    // all checks passed!!
    this.updateAccessTime(messages);
    return messages;
  }

  public get(msgId: string): WickrMessage | undefined {
    const messages = this.getRange(msgId, 0, 0);
    if (!messages) return;
    return messages[0];
  }

  public get first(): WickrMessage | undefined {
    this.updateAccessTime([this.messages.first]);
    return this.messages.first;
  }

  public get last(): WickrMessage | undefined {
    this.updateAccessTime([this.messages.last]);
    return this.messages.last;
  }
  public isLastOfGroup(msgId: string): boolean {
    const messages = this.messages.toArrayByRange(msgId, 0, 1);
    return messages && messages.length === 1;
  }
  public getFirstUnread(): WickrMessage | undefined {
    const firstUnread = this.messages.find((m) => !m.isRead);
    this.updateAccessTime([firstUnread]);
    return firstUnread;
  }

  /**
   * subscribe message change
   */
  public subscribe(msgId: string, callback: (message: WickrMessage | undefined) => void) {
    if (!msgId) return () => {};

    if (!this.msgIdToSubscriptionMap.has(msgId)) {
      this.msgIdToSubscriptionMap.set(msgId, new Set());
    }

    this.msgIdToSubscriptionMap.get(msgId)!.add(callback);

    return () => {
      this.msgIdToSubscriptionMap.get(msgId)?.delete(callback);
    };
  }
}
