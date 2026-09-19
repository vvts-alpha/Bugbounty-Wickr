import { Logger } from '../logger';
import { Disposable } from '@/utils/disposable';
import { MessageCache } from './MessageCache';

const logger = new Logger('MessageCaches');

export const MAX_MESSAGE_CACHE_COUNT = 20;

export class MessageCaches implements Disposable {
  private caches = new Map<string, MessageCache>();

  get size() {
    return this.caches.size;
  }

  getOrCreate(vGroupID: string): MessageCache {
    if (!vGroupID) {
      logger.error('getMessageCache:: invalid vGroupID', vGroupID);
    }
    const isFull = this.isFull();
    const messageCache = this.caches.get(vGroupID) ?? new MessageCache();
    if (!this.caches.has(vGroupID)) {
      this.caches.set(vGroupID, messageCache);
    }
    if (__DEV__) {
      // assuming the most recent get is the current convoId
      Object.assign(globalThis, { _msgCache: messageCache });
    }
    if (isFull) {
      const leastRecentCache = Array.from(this.caches.entries()).reduce((leastRecent, current) => {
        return !leastRecent || current[1].lastAccessTime < leastRecent[1].lastAccessTime
          ? current
          : leastRecent;
      }, undefined as [string, MessageCache] | undefined);
      const leastRecentVGroupID = leastRecentCache?.[0];
      if (leastRecentVGroupID && leastRecentVGroupID !== vGroupID) {
        this.caches.delete(leastRecentVGroupID);
      }
    }
    return messageCache;
  }

  has(vGroupID: string) {
    return this.caches.has(vGroupID);
  }

  delete(vGroupID: string) {
    if (!vGroupID) {
      logger.error('deleteMessageCache:: invalid vGroupID', vGroupID);
    }
    const cache = this.caches.get(vGroupID);
    if (cache) {
      cache.clear();
      this.caches.delete(vGroupID);
    }
  }

  clear() {
    for (const vGroupID of this.caches.keys()) {
      this.delete(vGroupID);
    }
  }

  dispose() {
    this.clear();
  }

  /** @returns true if the cache is full, i.e. adding new caches will remove old ones */
  isFull() {
    return this.caches.size >= MAX_MESSAGE_CACHE_COUNT;
  }
}
