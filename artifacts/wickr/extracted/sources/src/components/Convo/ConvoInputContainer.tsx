import { AnyExtension } from '@tiptap/react';
import Fuse from 'fuse.js';
import { useEffect, useMemo, useRef } from 'react';
import { createEmojiSearchExtension } from '../ComposeBox/Extensions/EmojiSearch/suggestion';
import { useBotMentionExtension } from '../ComposeBox/Extensions/Mention/Bot/BotMentionExtension';
import { IMentionModel } from '../ComposeBox/Extensions/Mention/MentionModel';
import { SendTextMessageMention, SendTextMessagePayload } from '@/apis/webChannel/BridgeWebChannel';
import { ComposeBox, EditorRef } from '@/components/ComposeBox';
import { useMentionExtension } from '@/components/ComposeBox/Extensions/Mention/Suggestion';
import useConvoExpirationTimes from '@/hooks/useConvoExpirationTimes';
import useFuse from '@/hooks/useFuse';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { WickrContact } from '@/lib/protobuf/contacts';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectActiveConvoType,
  selectActiveConvoMembers,
  selectActiveConvoCrossBoundary,
  selectActiveConvoCanSendMessage,
} from '@/store/slices/convos';
import { selectActiveConvoId } from '@/store/slices/shared';
import {
  clearDraftMessage,
  selectActiveConvoDraftMessage,
  selectActiveReplyOrEditMsg,
  selectVoiceMessage,
  setActiveReplyOrEditMsg,
  setDraftMessage,
  setVoiceMessage,
} from '@/store/slices/uiChat';
import { dispatchThrottledSendTypingActivity } from '@/store/thunks/convos';
import { sendTextMessage, sendVoiceMessage } from '@/store/thunks/messages';
import { openAlertModal } from '@/store/thunks/modals';
import { formatRelativeTime } from '@/utils/date';
import { queryEmojiSuggestions } from '@/utils/emoji/emojiSearch';
import { objectHasProperty } from '@/utils/lang';
import {
  blobToBase64,
  formatFileSize,
  getContactDisplayName,
  redactInProd,
  raw,
  aliasFromEmail,
} from '@/utils/strings';

const logger = new Logger('ConvoInputContainer');

interface ConvoInputContainerProps {
  onSubmit?: (message: string) => void;
}

const userToMentionModel = (user: WickrContact): IMentionModel => {
  return {
    alias: aliasFromEmail(user.id),
    id: user.idHash, // `id` used by mention extension
    label: getContactDisplayName(user),
    name: user.name ?? undefined,
    email: user.id,
  };
};

const ConvoInputContainer: React.FC<ConvoInputContainerProps> = ({ onSubmit }) => {
  const { t } = useAppTranslation();
  const appStore = useAppStore();
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const { displayedTTL, displayedBOR } = useConvoExpirationTimes(activeConvoId);
  const convoType = useAppSelector(selectActiveConvoType);
  const members = useAppSelector(selectActiveConvoMembers);
  const activeDraftMessage = useAppSelector(selectActiveConvoDraftMessage);
  const activeReplyOrEditMsg = useAppSelector(selectActiveReplyOrEditMsg);
  const voiceMessage = useAppSelector(selectVoiceMessage);
  const maxUploadSizeBytes = useSetting('maxUploadSizeBytes') as number;
  const crossBoundary = useAppSelector(selectActiveConvoCrossBoundary);
  const canSendMessage = useAppSelector(selectActiveConvoCanSendMessage);

  const editorRef = useRef<EditorRef>(null);
  const isFirstDraftRender = useRef(!!activeDraftMessage?.content);

  const getMemberSuggestions = (onlyBots = false) => {
    // Do not show suggestions if room type is DM or there are less than 2 members in the room
    if (convoType === WickrConvoType.DM || (members?.length ?? 0) < 2) {
      return [];
    }

    const mentionAll = t('Compose.MentionAll');
    const allMembers: IMentionModel = {
      id: mentionAll,
      alias: mentionAll,
      label: mentionAll,
      name: mentionAll,
    };

    const memberSuggestions = members
      .filter(
        (member) => (onlyBots && member.isBot) || (!onlyBots && !member.isBot && !member.selfUser)
      )
      .map(userToMentionModel)
      .sort((a, b) => a.label.localeCompare(b.label));

    if (!onlyBots) {
      memberSuggestions.unshift(allMembers);
    }

    return memberSuggestions;
  };

  const memberSuggestions = useMemo(() => getMemberSuggestions(), [members]);
  const botSuggestions = useMemo(() => getMemberSuggestions(true), [members]);

  const fuseOptions: Fuse.IFuseOptions<any> = {
    keys: ['name', 'alias', 'email', 'label'],
    isCaseSensitive: false,
    threshold: 0.2,
  };

  // Members fuse without bots
  const membersFuse = useFuse<IMentionModel>(memberSuggestions, fuseOptions);
  // Bots only fuse
  const botsFuse = useFuse<IMentionModel>(botSuggestions, fuseOptions);

  const mentionExtension = useMentionExtension((props: { query: string }): IMentionModel[] => {
    // Show all suggestions if query is empty
    if (props.query.length === 0) {
      return memberSuggestions;
    }

    const results = membersFuse.search(props.query) ?? [];
    return results.map((v) => v.item);
  });

  const botMentionExtension = useBotMentionExtension(
    (props: { query: string }): IMentionModel[] => {
      // Show all suggestions if query is empty
      if (props.query.length === 0) {
        return botSuggestions;
      }

      const results = botsFuse.search(props.query) ?? [];
      return results.map((v) => v.item);
    }
  );

  const isEmojiMartEnabled = useFeature('EmojiMartSearch');

  // extensions need to be stable to avoid unnecessary ComposeBox resets,
  // but must update when functionality changes (members, feature flags, etc.)
  const extensions = useMemo<AnyExtension[]>(
    () => [
      mentionExtension,
      botMentionExtension,
      createEmojiSearchExtension(queryEmojiSuggestions(isEmojiMartEnabled)),
    ],
    [mentionExtension, botMentionExtension, isEmojiMartEnabled]
  );

  const placeholderText = useLatestCallback(() => {
    if (!canSendMessage) return t('You do not have permission to send messages in this room.');
    if (crossBoundary) {
      return raw("Don't share CUI");
    } else if (displayedBOR) {
      const relativeTime = formatRelativeTime(displayedBOR);
      return t('Compose.Placeholder.BurnOnRead', {
        expireIn: relativeTime.amount,
        formatParams: {
          expireIn: {
            // Format as number since relativeTime always has 'in' before, or something similar
            style: 'unit',
            unitDisplay: 'long',
            unit: relativeTime.unit,
          },
        },
      });
    } else if (displayedTTL > 0) {
      const relativeShortTime = formatRelativeTime(displayedTTL);
      return t('Compose.Placeholder.Expires', {
        expireIn: relativeShortTime.amount,
        formatParams: { expireIn: { range: relativeShortTime.unit } },
      });
    } else {
      return t('Compose.Placeholder');
    }
  });

  useEffect(() => {
    // clear undo history whenever convo changes
    editorRef.current?.clearHistory();

    // Define this within the effect so it points to the correct convoId when switching conversations.
    // This function is not general purpose, since editor + convoId need to be "lined up" at the right time.
    const saveDraftMessage = (editor: EditorRef) => {
      // Active convo is is an empty string if previous route was not a room
      if (!activeConvoId || !editor.hasEditor()) {
        return;
      }

      const jsonContent = editor.getJSON();
      // Selectors use the future state (if in a useEffect return) and direct access uses previous state.
      // Because we are saving the previous state, direct access is necessary
      const prevActiveReplyOrEditMsg = selectActiveReplyOrEditMsg(appStore.getState());

      // Clear saved draft message if compose box is empty
      if (!jsonContent || (editor.isEmpty() && !prevActiveReplyOrEditMsg)) {
        dispatch(clearDraftMessage({ vGroupId: activeConvoId }));
        return;
      }

      // Otherwise, update saved draft message
      dispatch(
        setDraftMessage({
          message: {
            content: jsonContent,
            replyOrEditMsg: prevActiveReplyOrEditMsg,
          },
          vGroupId: activeConvoId,
        })
      );
    };

    return () => {
      const editor = editorRef.current;
      if (editor) {
        // save draft message on leaving a convo
        saveDraftMessage(editor);
        editor.clearContent();
      }
    };
  }, [activeConvoId]);

  useEffect(() => {
    editorRef.current?.setPlaceholderText(placeholderText());
  }, [displayedBOR, displayedTTL, crossBoundary]);

  useEffect(() => {
    dispatch(setActiveReplyOrEditMsg(activeDraftMessage?.replyOrEditMsg));
    isFirstDraftRender.current = !!activeDraftMessage?.content;
    editorRef.current?.setContent(activeDraftMessage?.content || '');
    // When mounted or convo changes, auto focus onto the input box and focus cursor to end of current text
    editorRef.current?.focus('end');
  }, [activeConvoId]);

  const handleSubmit = async (message: string, mentions?: SendTextMessageMention[]) => {
    if (!activeConvoId) {
      logger.warn('No conversation to send message to');
      return;
    }

    // Send the voice message if there is one
    if (voiceMessage?.duration && voiceMessage.data) {
      if (maxUploadSizeBytes > 0 && voiceMessage.data.size > maxUploadSizeBytes) {
        return dispatch(
          openAlertModal({
            title: t('Error'),
            body: t(
              'The file you are attempting to upload exceeds the maximum file size of {{size}} set by your administrator.',
              { size: formatFileSize(maxUploadSizeBytes) }
            ),
          })
        );
      }
      const base64Audio = await blobToBase64(voiceMessage.data);
      dispatch(
        sendVoiceMessage({
          audioData: base64Audio.split(',')[1], // Send without metadata, eg. data:audio/wav;base64,GkXfo5...
          recordingLength: voiceMessage.duration,
          vgroupId: activeConvoId,
        })
      );
      dispatch(setVoiceMessage());
      return;
    }

    if (!message.trim()) {
      return;
    }

    const payload: SendTextMessagePayload = {
      message,
      vgroupId: activeConvoId,
      replyTo: activeReplyOrEditMsg?.type === 'reply' ? activeReplyOrEditMsg.msgId : undefined,
      edit: activeReplyOrEditMsg?.type === 'edit' ? activeReplyOrEditMsg.msgId : undefined,
      mentions,
    };

    editorRef.current?.clearContent();
    onSubmit?.(message);
    const res = await dispatch(sendTextMessage(payload));
    dispatch(setActiveReplyOrEditMsg());
    dispatch(clearDraftMessage({ vGroupId: activeConvoId }));

    if (objectHasProperty(res, 'error')) {
      logger.error('dispatch failed with:', redactInProd(res.error));
    } else {
      logger.info('handleSubmit resolved with:', redactInProd(res));
    }
  };

  const isInputDisabled = Boolean(voiceMessage || !canSendMessage);

  const reportTypingActivity = () => {
    if (
      activeReplyOrEditMsg?.type === 'edit' ||
      !editorRef.current ||
      editorRef.current.isEmpty()
    ) {
      return;
    }
    if (isFirstDraftRender.current) {
      isFirstDraftRender.current = false;
      return;
    }
    dispatchThrottledSendTypingActivity(dispatch, { activity: 'typing' });
  };

  const handleRecordingOpen = (seconds: number) => {
    if (seconds) {
      dispatchThrottledSendTypingActivity(dispatch, { activity: 'voice' });
    }
  };

  return (
    <ComposeBox
      ref={editorRef}
      extensions={extensions}
      onSubmit={handleSubmit}
      initialContent={activeDraftMessage?.content}
      disabled={isInputDisabled}
      onChange={reportTypingActivity}
      onRecordingOpen={handleRecordingOpen}
      placeholder={placeholderText}
    />
  );
};

export default ConvoInputContainer;
