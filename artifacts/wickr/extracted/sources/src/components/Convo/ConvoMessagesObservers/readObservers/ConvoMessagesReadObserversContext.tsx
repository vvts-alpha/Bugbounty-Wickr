import { createContext, MutableRefObject } from 'react';

export type ConvoMessagesReadObservers = {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  markMessageReadThrottled: (timeStamp: number, msgId: string) => void;
};

const noopValue: ConvoMessagesReadObservers = {
  containerRef: { current: null },
  markMessageReadThrottled() {},
};

export const ConvoMessagesReadObserversContext =
  createContext<ConvoMessagesReadObservers>(noopValue);
