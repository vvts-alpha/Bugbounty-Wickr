import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useVisibleMessages } from '../VisibleMessagesProvider';
import { COMPOSE_WRAPPER_DOM_ID } from '@/components/ComposeBox/constants';
import useEventListener from '@/hooks/useEventListener';
import { useAppSelector } from '@/store';
import { selectActiveConvoMessages } from '@/store/slices/convos/convosSelectors';
import { selectActiveConvoId } from '@/store/slices/shared';
import { asHtmlElement, isElementInPopOver } from '@/utils/dom';
import { ArrowKeyNavigationContext } from './ArrowKeyNavigationContext';

export interface ArrowKeyNavigationProviderProps {
  enabled: boolean;
}

/** Handles arrow key navigation through messages in the current convo */
export const ArrowKeyNavigationProvider: ReactFC<ArrowKeyNavigationProviderProps> = ({
  children,
  enabled,
}) => {
  const [arrowKeyNavMode, setArrowKeyNavMode] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState('');

  const onRestoreFocus = useRef<Function | null>(null);

  const value = useMemo(
    () => ({
      setArrowKeyNavMode,
      activeMessageId,
      onRestoreFocus,
    }),
    [setArrowKeyNavMode, activeMessageId]
  );

  const msgs = useAppSelector(selectActiveConvoMessages);
  const messageIds = msgs.map((msg) => msg.msgId);
  const convoId = useAppSelector(selectActiveConvoId);

  useEffect(() => {
    setArrowKeyNavMode(false);
  }, [convoId]);

  useEffect(() => {
    if (!arrowKeyNavMode) setActiveMessageId('');
  }, [arrowKeyNavMode]);

  const [newestMsgIdInView, setNewestMsgIdInView] = useState('');
  useVisibleMessages(({ endIndex }) => {
    if (messageIds[endIndex]) setNewestMsgIdInView(messageIds[endIndex]);
  });

  const handleArrowUp = () => {
    if (!activeMessageId && newestMsgIdInView) {
      setActiveMessageId(newestMsgIdInView);
    } else {
      setActiveMessageId(messageIds[messageIds.length - 1]);
    }

    const currIndex = messageIds.indexOf(activeMessageId);
    // At the top
    if (currIndex <= 0) {
      return;
    }
    setActiveMessageId(messageIds[currIndex - 1]);
  };

  // Detect when nav mode is toggled on or off
  const shouldListen = arrowKeyNavMode && messageIds.length > 0 && enabled;

  const handleArrowDown = () => {
    const currIndex = messageIds.indexOf(activeMessageId);
    if (!activeMessageId || currIndex >= messageIds.length) {
      return;
    }

    setActiveMessageId(messageIds[currIndex + 1]);

    // if we're at the bottom return focus to the input
    if (currIndex === messageIds.length - 1) {
      return value.onRestoreFocus.current?.();
    }
  };

  useEventListener(shouldListen ? document : undefined, 'keydown', (e) => {
    // bail out when we are in a popover as they have their own keyboard shortcuts
    if (isElementInPopOver(e.target)) return;

    if (e.key === 'ArrowUp' && arrowKeyNavMode) {
      e.preventDefault();
      handleArrowUp();
    }
    if (e.key === 'ArrowDown' && arrowKeyNavMode) {
      e.preventDefault();
      handleArrowDown();
    }
  });

  useEventListener(shouldListen ? document : undefined, 'mousedown', (e) => {
    // If we click inside the compose box, keep nav mode as-is, but reset activeMessageId
    if (asHtmlElement(e.target)?.closest(`#${COMPOSE_WRAPPER_DOM_ID}`)) {
      setActiveMessageId('');
    } else {
      setArrowKeyNavMode(false);
    }
  });

  return (
    <ArrowKeyNavigationContext.Provider value={value}>
      {children}
    </ArrowKeyNavigationContext.Provider>
  );
};

export const useActiveMessageId = () => {
  const context = useContext(ArrowKeyNavigationContext);
  if (!context) throw new Error('useActiveMessageId: context undefined');
  return context.activeMessageId;
};

export const useSetArrowKeyNav = (enabled?: boolean) => {
  const context = useContext(ArrowKeyNavigationContext);
  if (!enabled) return () => undefined;
  if (!context) throw new Error('useSetArrowKeyNav: context undefined');
  return context.setArrowKeyNavMode;
};

export const useKeyboardRestoreFocusCallback = (callback: Function, enabled?: boolean) => {
  const context = useContext(ArrowKeyNavigationContext);
  if (!enabled) return () => undefined;
  if (!context) throw new Error('useKeyboardRestoreFocusCallback: context undefined');
  context.onRestoreFocus.current = callback;
};
