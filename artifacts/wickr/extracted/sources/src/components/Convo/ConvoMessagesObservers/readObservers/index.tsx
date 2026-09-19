import { useContext, useMemo, useRef } from 'react';
import { IntersectionOptions, InViewHookResponse, useInView } from 'react-intersection-observer';
import {
  ConvoMessagesReadObservers,
  ConvoMessagesReadObserversContext,
} from '@/components/Convo/ConvoMessagesObservers/readObservers/ConvoMessagesReadObserversContext';
import { useThrottledCallback } from '@/hooks/useDebouncedCallback';
import { Logger } from '@/lib/logger';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveConvoId } from '@/store/slices/shared';
import { markMessageRead } from '@/store/thunks/messages';

const logger = new Logger('ConvoMessagesObservers');

const MARK_MESSAGE_READ_DELAY_MS = 500;

export const ConvoMessagesReadObserversProvider: ReactFC = ({ children }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dispatch = useAppDispatch();
  const vGroupID = useAppSelector(selectActiveConvoId);

  const markReadDataRef = useRef({ newestTimeStamp: 0, msgId: '' });
  const markReadData = markReadDataRef.current;
  const dispatchMarkMessageReadThrottled = useThrottledCallback(
    () => {
      if (markReadData.newestTimeStamp) {
        dispatch(
          markMessageRead({
            vgroupId: vGroupID,
            timeStamp: markReadData.newestTimeStamp,
            messageId: markReadData.msgId,
          })
        );
        markReadData.newestTimeStamp = 0;
        markReadData.msgId = '';
      }
    },
    MARK_MESSAGE_READ_DELAY_MS,
    {
      leading: false,
      trailing: true,
    }
  );

  const contextValue = useMemo<ConvoMessagesReadObservers>(
    () => ({
      containerRef,
      markMessageReadThrottled: (timeStamp: number, msgId: string) => {
        if (timeStamp > markReadData.newestTimeStamp) {
          markReadData.newestTimeStamp = timeStamp;
          markReadData.msgId = msgId;
        }
        dispatchMarkMessageReadThrottled();
      },
    }),
    [containerRef, markReadData, dispatchMarkMessageReadThrottled]
  );

  return (
    <ConvoMessagesReadObserversContext.Provider value={contextValue}>
      {children}
    </ConvoMessagesReadObserversContext.Provider>
  );
};

export function useConvoInView(options: IntersectionOptions = {}): InViewHookResponse {
  const containerRef = useConvoContainerRef();
  const value = useInView({ ...options, root: containerRef.current });
  if (!containerRef) {
    // keep things false if the container is not set, we should NOT run into this case
    if (__DEV__) {
      logger.warn('Resize observed, but not with the containerEl; ignoring');
    }
    value[1] = false;
    value[2] = undefined;
  }
  return value;
}

export function useConvoContainerRef() {
  const ctx = useContext(ConvoMessagesReadObserversContext);
  if (!ctx) throw new Error('useConvoMessageContainer: context undefined');
  return ctx.containerRef;
}

export function useDispatchMarkMessageReadThrottled() {
  const ctx = useContext(ConvoMessagesReadObserversContext);
  if (!ctx) throw new Error('useDispatchMarkMessageReadThrottled: context undefined');
  return ctx.markMessageReadThrottled;
}
