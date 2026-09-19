import { useEffect } from 'react';
import { WickrMessage } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveOverlay } from '@/store/slices/overlay';
import { selectChatWindowHasFocus } from '@/store/slices/windows';
import { ackMessageSendFailure } from '@/store/thunks/messages';
import { useConvoInView, useDispatchMarkMessageReadThrottled } from '.';

type Props = {
  message: WickrMessage;
  messageIsLocked: boolean;
};

// This needs to be rendered within the actual message/control message, and never in the container list
// directly, otherwise these divs render first and their observers incorrectly trip.
const MessageReadObserver: React.FC<Props> = ({
  message: { isRead, msgId, vGroupID, timeStampMicroseconds, unacknowledgedSendError },
  messageIsLocked,
}) => {
  const dispatch = useAppDispatch();
  const [setBottomRef, inView] = useConvoInView();
  const chatWindowFocused = useAppSelector(selectChatWindowHasFocus);
  const activeOverlay = useAppSelector(selectActiveOverlay);
  const dispatchMarkMessageReadThrottled = useDispatchMarkMessageReadThrottled();

  // Make assignBottomRef a no-op once the message is read so we can stop observing intersection
  const assignBottomRef = isRead && !unacknowledgedSendError ? undefined : setBottomRef;

  useEffect(() => {
    if (isRead || messageIsLocked || !chatWindowFocused || activeOverlay) return;

    if (inView) {
      dispatchMarkMessageReadThrottled(timeStampMicroseconds, msgId);
    }
  }, [
    isRead,
    messageIsLocked,
    chatWindowFocused,
    activeOverlay,
    inView,
    dispatchMarkMessageReadThrottled,
  ]);

  useEffect(() => {
    if (!chatWindowFocused) return;

    if (inView && unacknowledgedSendError) {
      dispatch(
        ackMessageSendFailure({
          msgId: msgId ?? '',
          vgroupId: vGroupID,
        })
      );
    }
  }, [inView, chatWindowFocused]);

  return (
    <div
      data-read={isRead}
      data-id={msgId}
      data-time-us={timeStampMicroseconds}
      ref={assignBottomRef}
    />
  );
};

export default MessageReadObserver;
