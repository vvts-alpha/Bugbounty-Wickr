import { useState, useEffect } from 'react';
import { Logger } from '@/lib/logger';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveConvoId } from '@/store/slices/shared';
import { switchActiveConvoAndMessage } from '@/store/thunks/messages';
import { HistoryStack } from '@/utils/HistoryStack';
import { useKeyboardShortcut } from './KeyboardShortcut';

const logger = new Logger('ConvoHistoryShortcuts');

export const ConvoHistoryShortcuts: React.FC = () => {
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const [convoHistory] = useState(() => new HistoryStack<string>());

  useEffect(() => {
    const unsub = convoHistory.on('navigate', ({ amount, currentValue }) => {
      logger.info('Navigate', amount > 0 ? 'forward' : 'backward', 'to', currentValue);
      dispatch(switchActiveConvoAndMessage({ vGroupID: currentValue }));
    });
    return unsub;
  }, [convoHistory]);

  useEffect(() => {
    if (activeConvoId && convoHistory.getState().currentValue !== activeConvoId) {
      convoHistory.push(activeConvoId);
    }
  }, [activeConvoId, convoHistory]);

  useKeyboardShortcut('ConversationBack', () => convoHistory.back());
  useKeyboardShortcut('ConversationForward', () => convoHistory.forward());

  return null;
};
