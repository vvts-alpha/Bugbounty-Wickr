import {
  MessageObservingData,
  useMessageIntersectionObserve,
} from '@/components/Convo/ConvoMessagesObservers/intersectionObserver/MessageIntersectionObserverHooks';

const MessageIntersectionObserver: ReactFC<MessageObservingData> = ({ children, ...data }) => {
  const observeIntersection = useMessageIntersectionObserve(data);

  return <div ref={observeIntersection}>{children}</div>;
};

export default MessageIntersectionObserver;
