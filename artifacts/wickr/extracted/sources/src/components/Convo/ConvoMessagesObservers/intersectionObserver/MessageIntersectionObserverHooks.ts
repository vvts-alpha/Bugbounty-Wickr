import {
  createIntersectionObserverHooks,
  IntersectionObserverEntryAndData,
} from '@/components/Convo/ConvoMessagesObservers/intersectionObserver';
import { WickrMessage } from '@/lib/protobuf/messages';

export type MessageObservingData = {
  messageIsLocked: boolean;
  message: WickrMessage;
};

export type MessageObservingEntry = IntersectionObserverEntryAndData<MessageObservingData>;

export const {
  useIntersectionObserve: useMessageIntersectionObserve,
  useIntersectionCallback: useMessageIntersectionCallback,
} = createIntersectionObserverHooks<MessageObservingData>();
