import { createContext } from 'react';
import { WickrMessage } from '@/lib/protobuf/messages';

/**
 * Triggered when the visibility of messages changes in the active convo
 */
export type VisibleMessagesChangeEvent = (data: {
  /** The current list of visible messages */
  visibleMessages: WickrMessage[];
  /** Messages that have just become visible */
  newVisibleMessages: WickrMessage[];
  /** Messages that have just been hidden */
  newHiddenMessages: WickrMessage[];
  /** Index of first visible message in active convo messages array */
  startIndex: number;
  /** Index of last visible message in active convo messages array */
  endIndex: number;
}) => void;

interface ContextType {
  subscribe: (listener: VisibleMessagesChangeEvent) => () => void;
}
export const VisibleMessagesContext = createContext<ContextType | null>(null);
