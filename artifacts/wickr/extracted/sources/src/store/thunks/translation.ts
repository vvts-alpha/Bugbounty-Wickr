import { selectActiveConvoMessage, setMessageTranslationPending } from '../slices/convos';
import { setOverlay } from '../slices/overlay';
import { pushPanel } from '../slices/panels';
import { createAppAsyncThunk } from '../utils';
import { TranslateMessagePayload } from '@/apis/webChannel/BridgeWebChannel';
import { Logger } from '@/lib/logger';
import { markdownToPlainText } from '@/utils/tiptap/markdown';

const logger = new Logger('store/translation');

export const translateMessage = createAppAsyncThunk(
  `translation/translateMessage`,
  async (payload: Omit<TranslateMessagePayload, 'text'>, { dispatch, getState, extra }) => {
    logger.info('translateMessage', payload);
    const message = selectActiveConvoMessage(getState(), payload.messageId);

    if (!message?.textContent) return;

    dispatch(
      setMessageTranslationPending({
        vgroupId: payload.vgroupId,
        messageId: payload.messageId,
        msgTranslationPending: true,
      })
    );
    return extra.bridge.translateMessage({
      vgroupId: payload.vgroupId,
      messageId: payload.messageId,
      text: markdownToPlainText(message.textContent),
    });
  }
);

export const showTranslationSettings = createAppAsyncThunk(
  `translation/showTranslationSettings`,
  async (_: undefined, { dispatch }) => {
    logger.info('showTranslationSettings');
    dispatch(pushPanel({ name: 'SettingsPanel' }));
    dispatch(setOverlay(['Translation', { directedFromMessages: true }]));
  }
);
