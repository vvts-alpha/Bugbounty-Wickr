import { useEffect, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConvoRouteParams, generateChatRoute } from '@/chat/routes';
import ConvoContainer from '@/components/Convo';
import LoadingPage from '@/components/LoadingPage';
import usePrevious from '@/hooks/usePrevious';
import { Logger } from '@/lib/logger';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectActiveConvoId } from '@/store/slices/shared';
import {
  clearActiveConvoId,
  clearHighlightedMsgId,
  clearScrollToMsgId,
  clearActiveTab,
  selectScrollToMsgId,
  setHighlightedMsgId,
  setActiveTab,
  clearTypingActivities,
} from '@/store/slices/uiChat';
import { removeWebApp } from '@/store/thunks/convos';
import { setAppState } from '@/store/thunks/files';
import { switchActiveConvoAndMessage } from '@/store/thunks/messages';

const logger = new Logger('ChatPage');
const ChatPage = () => {
  // eslint-disable-next-line no-restricted-syntax
  const params = useParams<ConvoRouteParams>();
  const { convoId, tab } = params;
  const previousConvoId = usePrevious(convoId);
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const msgId = tab === 'messages' ? params.itemId : undefined;

  const dispatch = useAppDispatch();
  const scrollToMsgId = useAppSelector(selectScrollToMsgId);
  const prevScrollToMsgId = usePrevious(scrollToMsgId);
  const navigate = useNavigate();
  const isBeta = useSetting('isBeta');

  useLayoutEffect(() => {
    if (!convoId) {
      dispatch(clearActiveConvoId());
      dispatch(clearScrollToMsgId());
      dispatch(clearHighlightedMsgId());
      dispatch(clearTypingActivities());
      if (isBeta && previousConvoId) {
        dispatch(removeWebApp({ id: previousConvoId }));
      }
      return;
    }
    // return if convo id hasn't changed and the msgId becomes undefined
    // meaning that we are just clearing msgId, no need to refresh convo
    if ((convoId === activeConvoId || convoId === previousConvoId) && !msgId) {
      return;
    }
    logger.info('URL changed, switching convo', convoId, msgId);
    dispatch(switchActiveConvoAndMessage({ vGroupID: convoId, scrollToMsgId: msgId }));
    if (isBeta && previousConvoId) {
      dispatch(removeWebApp({ id: previousConvoId }));
    }
    // searched message, etc.
    if (msgId) {
      dispatch(setHighlightedMsgId(msgId));
    }
  }, [convoId, msgId]);

  useEffect(() => {
    if (tab) {
      if (tab === 'files') {
        dispatch(setActiveTab('files'));
        dispatch(setAppState({ fileManagement: true }));
      } else if (isBeta && tab === 'webApp') {
        dispatch(setActiveTab('webApp'));
        dispatch(setAppState({}));
      } else {
        dispatch(setActiveTab('messages'));
        dispatch(setAppState({}));
      }
    } else {
      dispatch(clearActiveTab());
    }
  }, [tab]);

  useLayoutEffect(() => {
    if (!convoId || !msgId) return;

    // When we get a /convo/msg we scroll to it, and then scrollToMsgId is cleared
    // We want to update the route accordingly, i.e.: /convo/msg ==> /convo/
    // That will make sure future requests to jump to the same message will work
    // when there are no intermediate navigations
    if (prevScrollToMsgId === msgId && !scrollToMsgId) {
      navigate(generateChatRoute.convo(convoId));
    }
  }, [convoId, msgId, prevScrollToMsgId, scrollToMsgId]);

  return convoId ? <ConvoContainer /> : <LoadingPage />;
};

export default ChatPage;
