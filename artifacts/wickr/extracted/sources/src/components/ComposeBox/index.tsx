import { Placeholder } from '@tiptap/extension-placeholder';
import { Slice } from '@tiptap/pm/model';
import { EditorView } from '@tiptap/pm/view';
import {
  EditorContent as TipTapEditorContent,
  AnyExtension,
  useEditor,
  Content,
  JSONContent,
  FocusPosition,
  Editor,
} from '@tiptap/react';
import { clsx } from 'clsx';
import React, { forwardRef, useRef, useState, useEffect, useMemo, useId } from 'react';
import {
  useKeyboardRestoreFocusCallback,
  useSetArrowKeyNav,
} from '../Convo/ArrowKeyNavigationProvider';
import { EmojiPopperRef } from '../Convo/EmojiPicker/EmojiPopper';
import { withErrorBoundary } from '../Errors/withErrorBoundary';
import { KeyboardShortcut } from '../KeyboardShortcut';
import { SendTextMessageMention } from '@/apis/webChannel/BridgeWebChannel';
import { Button, IconButton, MicrophoneSolidIcon, Tooltip } from '@/componentlibrary';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { metrics } from '@/lib/metrics';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { WickrMessageMentions } from '@/lib/protobuf/messages';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectQuickResponses } from '@/store/slices/account';
import { selectSelfCallStatus } from '@/store/slices/calls';
import { selectActiveConvoMembersMap, selectActiveConvoType } from '@/store/slices/convos';
import { selectActiveConvoId } from '@/store/slices/shared';
import {
  MessagePreviewType,
  selectActiveReplyOrEditMsg,
  selectIsMessagesTabActive,
} from '@/store/slices/uiChat';
import { pasteImage } from '@/store/thunks/messages';
import { openAlertModal } from '@/store/thunks/modals';
import { adaptiveRequestAnimationFrame } from '@/utils/dom';
import { assignRef } from '@/utils/react';
import {
  getEditorMultilineTextParser,
  getDefaultMarkdownExtensions,
  markdownToJSON,
  removeTrailingBackticks,
  getEditorMarkdown,
  prepareTextMessageForSending,
  hardBreaksToParagraphsFragment,
  triggerAutoLink,
} from '@/utils/tiptap/markdown';
import { ComposeBottomRow } from './ComposeBottomRow';
import { ComposeTopRow } from './ComposeTopRow';
import { ByteCount } from './Extensions/ByteCount/ByteCount';
import { CustomCommandsExtension } from './Extensions/CustomCommands/CustomCommands';
import { EmojiReplacer } from './Extensions/EmojiReplacer/EmojiReplacer';
import { KeyBindingsExtension } from './Extensions/KeyBinding/KeyBindingsExtension';
import { AT_MENTION_PREFIX } from './Extensions/Mention/MentionList';
import MessagePreviewWithClose from './MessagePreviewWithClose';
import VoiceRecordingBox from './VoiceRecordingBox';
import {
  COMPOSE_WRAPPER_DOM_ID,
  MAX_MESSAGE_TEXT_IN_BYTES,
  NEW_LINE_HINT_DISPLAY_THRESHOLD_IN_CHARS,
  SIMPLE_WRAPPER_DOM_PREFIX,
} from './constants';
import { ensureCurrentLineIsNotAHardBreak } from './utils';

import styles from './ComposeBox.module.less';
import markdownStyles from '@/components/MarkdownText/MarkdownText.module.less';

const logger = new Logger('ComposeBox');

export interface ComposeBoxProps {
  /**
   * Simple mode: Enter adds newlines, no auto-focus, external mentions, no attachments/shortcuts
   * Full mode: Enter submits, auto-focus, active conversation mentions, full messaging features
   */
  simple?: boolean;
  placeholder?: string | (() => string);
  editorState?: any;
  extensions?: AnyExtension[];
  disabled?: boolean;
  autoMarkdown?: boolean;
  className?: string;
  onFilePaste?: (files: FileList) => void;
  onChange?: () => void;
  onSubmit?: (message: string, mentions?: SendTextMessageMention[]) => void;
  onRecordingOpen?: (durationSeconds: number) => void;
  sendButtonLabel?: string;
  hasAttachment?: boolean;
  initialContent?: Content;
  mentionsEnabled?: boolean;
  availableMembers?: Map<string, any>; // Members available for mentioning when not composing for the active convo
}

export interface EditorRef {
  /** @returns true if there is an underlaying editor */
  hasEditor: () => boolean;
  /** @returns true if the editor has not been destroyed (removed from view; state remains in tact regardless) */
  isDestroyed: () => boolean;
  /** Clears all text in the editor, if not destroyed. */
  clearContent: () => void;
  /** Clear editor undo history */
  clearHistory: () => void;
  /** Sets the text in the editor to the given string. */
  setContent: (content: Content) => void;
  /** @returns the current text in the editor as JSONContent. */
  getJSON: () => JSONContent | undefined;
  /** Focuses the input field of the editor. */
  focus: (position?: FocusPosition) => void;
  /** @returns if the editor is empty. */
  isEmpty: () => boolean;
  /** Sets the updated placeholder text */
  setPlaceholderText: (text: string) => void;
}

function createEditorRef(editor: Editor | null): EditorRef {
  return {
    hasEditor: () => !!editor,
    isDestroyed: () => (editor ? editor.isDestroyed : true),
    clearContent: () => {
      editor?.commands.clearContent(true);
    },
    clearHistory: () => {
      try {
        const editorHistory = (editor?.state as any)?.history$;
        if (editorHistory) {
          editorHistory.prevRanges = null;
          editorHistory.done.eventCount = 0;
          editorHistory.done.items.values.length = 0;
          editorHistory.undone.eventCount = 0;
          editorHistory.undone.items.values.length = 0;
        }
      } catch (error) {
        logger.error('Failed to clear editor history', error);
      }
    },
    setContent: (content: Content) => {
      editor?.commands.setContent(content, true);
    },
    getJSON: () => {
      return editor?.getJSON();
    },
    focus: (position?: FocusPosition) => {
      editor?.commands.focus(position || null);
    },
    isEmpty: () => editor?.isEmpty ?? true,
    setPlaceholderText: (text: string) => {
      if (editor && text) {
        const placeholderExtension = editor.extensionManager.extensions.find(
          (extension) => extension.name === Placeholder.name
        );
        if (placeholderExtension) placeholderExtension.options['placeholder'] = text;
        editor.view.dispatch(editor.state.tr);
      }
    },
  };
}

const ComposeBoxImpl = forwardRef(
  (props: ComposeBoxProps, ref: React.ForwardedRef<EditorRef | null>) => {
    const { simple } = props;
    const dispatch = useAppDispatch();
    const composeBoxId = useId();

    // Use local state for markdown controls in simple mode, Redux for normal mode
    const markdownControlsVisible = useSetting('markdownControlsVisible');
    const [isRecordingOpen, setIsRecordingOpen] = useState(false);
    // Tracks whether or not the voice message is recording
    const [isVoiceRecording, setIsVoiceRecording] = useState(false);
    const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
    const [editorFocused, setEditorFocused] = useState(false);
    const [newLineHintVisible, setNewLineHintVisible] = useState(false);

    const { t } = useAppTranslation();

    const activeReplyOrEditMsg = useAppSelector(selectActiveReplyOrEditMsg);
    const activeConvoMembersMap = useAppSelector(selectActiveConvoMembersMap);
    const activeConvoId = useAppSelector(selectActiveConvoId);
    const activeConvoType = useAppSelector(selectActiveConvoType);
    const filesEnabled = useSetting('filesEnabled');
    const locationEnabled = useSetting('locationEnabled');
    const hasQuickResponses = useAppSelector(selectQuickResponses).length > 0;
    const isMessagesActive = useAppSelector(selectIsMessagesTabActive);
    const editorWrapperEl = useRef<HTMLDivElement>(null);
    const emojiPopperRef = useRef<EmojiPopperRef>(null);
    const setArrowKeyNavMode = useSetArrowKeyNav(!simple);
    const selfCallStatus = useAppSelector(selectSelfCallStatus);
    const showAddbutton = filesEnabled || locationEnabled || hasQuickResponses;

    useEffect(() => {
      setIsRecordingOpen(false);
    }, [activeConvoId]);

    useEffect(() => {
      if (!simple) {
        editor?.commands.focus();
      }
    }, [activeReplyOrEditMsg, simple]);

    useEffect(() => {
      if (isRecordingOpen) {
        props.onRecordingOpen?.(voiceRecordingSeconds);
      }
    }, [isRecordingOpen, voiceRecordingSeconds]);

    const handleEnterKeyPress = useLatestCallback(() => {
      if (!editor) {
        return;
      }

      // In simple mode, Enter should just add a new line instead of submitting
      if (simple) {
        editor.commands.splitBlock();
        return true;
      }

      setIsRecordingOpen(false);
      // try to trigger auto link on current line
      triggerAutoLink(editor);
      const jsonContent = editor.getJSON();

      try {
        // Convert Map to Record format expected by prepareTextMessageForSending
        const membersRecord = simple
          ? Object.fromEntries(props.availableMembers || new Map())
          : activeConvoMembersMap;

        const { message, mentions } = prepareTextMessageForSending({
          jsonContent,
          extensions,
          allUsersLabel: t('Compose.MentionAll'),
          members: membersRecord,
        });
        props.onSubmit?.(message, mentions);
        editor.commands.clearContent(true);
      } catch (err) {
        // FIXME: If we get here, the message was not sent and the contents of the editor will remain.
        // There is no notification for the users, who can attempt to send again. We should have some recourse.
        logger.error('Error parsing or submitting; restoring editor content', err);
      }
    });

    const shouldEnableMentions = useMemo(() => {
      if (simple) {
        return props.mentionsEnabled && (props.availableMembers?.size ?? 0) > 0;
      }
      return activeConvoType === WickrConvoType.Group || activeConvoType === WickrConvoType.Room;
    }, [
      simple,
      props.mentionsEnabled,
      props.availableMembers,
      ...(simple ? [] : [activeConvoType]),
    ]);

    /**
     * When enter is pressed along with Control, Alt, or Shift
     */
    const handleAltEnterKeyPress = useLatestCallback((): boolean => {
      // Return true to prevent default behavior, false to allow default behavior
      if (!editor) {
        return false;
      }

      // Inside a code block, the user types three backticks and hit Enter to exit it
      if (editor.isActive('codeBlock')) {
        const { $from } = editor.view.state.selection;
        const nodeBefore = $from.nodeBefore;
        if (nodeBefore?.textContent.endsWith('```')) {
          const backTickTrimmedJsonContent = removeTrailingBackticks(editor.getJSON());
          editor.commands.setContent(backTickTrimmedJsonContent, true);
          editor.commands.exitCode();
          return true;
        }
      }

      const isList = editor.isActive('bulletList') || editor.isActive('orderedList');
      if (isList) {
        // Split list item if there is text (new line with bullet/list point)
        if (!editor.can().liftEmptyBlock()) {
          editor.commands.splitListItem('listItem');
          return true;
        }
      } else if (editor.isActive('codeBlock')) {
        const { from, $from } = editor.view.state.selection;
        const currentNode = $from.node();
        const textContent = currentNode.textContent;

        /**
         * Exit the code block if alternate enter is pressed 3 times.
         */
        if (textContent.endsWith('\n\n')) {
          editor
            .chain()
            // Delete the last 2 empty newlines when exiting the code block
            .deleteRange({ from: from - 2, to: from })
            .splitBlock()
            .run();
          return true;
        }

        // Add a newline in code on alternate enter.
        editor.commands.newlineInCode();
        return true;
      }

      if (editor.isActive('heading')) {
        editor.commands.splitBlock();
        return true;
      }

      // If the line is empty in a block (quote, list, etc), remove the block
      if (editor.can().liftEmptyBlock()) {
        editor.commands.liftEmptyBlock();
        return true;
      }

      // Handle any line breaks in paragraphs manually.
      // By default, tiptap creates hard breaks, but
      // we want to override that behavior to add empty
      // paragraphs, which makes markdown serialization
      // more consistent (and makes a few other things better).
      if (editor.isActive('paragraph')) {
        editor.commands.splitBlock();
        return true;
      }

      // Fallback to false to allow default behavior
      return false;
    });

    const handleImagePaste = () => {
      dispatch(pasteImage());
    };

    const handlePaste = useLatestCallback(
      (_view: EditorView, event: ClipboardEvent, _slice: Slice) => {
        // Handle image pasting, if there is one
        handleImagePaste();

        const copiedText = event.clipboardData?.getData('Text');
        if (copiedText && copiedText.length > MAX_MESSAGE_TEXT_IN_BYTES) {
          dispatch(
            openAlertModal({
              title: t('Compose.Input.MaxLengthDialog.Title'),
              body: t('Compose.Input.MaxLengthDialog.Message'),
            })
          );
          return;
        }

        // Convert hardBreak nodes to paragraphs if pasted on (empty lines)
        ensureCurrentLineIsNotAHardBreak(editor);

        return false;
      }
    );

    const handleUpdate = useLatestCallback(() => {
      setNewLineHintVisible(
        editor?.storage.byteCount?.charCount >= NEW_LINE_HINT_DISPLAY_THRESHOLD_IN_CHARS
      );
      props.onChange?.();
    });

    const enableArrowKeyNavMode = useLatestCallback((enable: boolean) => {
      setArrowKeyNavMode(enable);
    });

    // Used by real editor and headless editor on send
    const extensions = useMemo(
      () => [
        ...getDefaultMarkdownExtensions(),
        KeyBindingsExtension.configure({
          onEnterKeyPress: handleEnterKeyPress,
          onAltEnterKeyPress: handleAltEnterKeyPress,
          onControlEnterKeyPress: handleAltEnterKeyPress,
          onShiftEnterKeyPress: handleAltEnterKeyPress,
        }),
        Placeholder.configure({
          placeholder: props.placeholder ?? t('Compose.Placeholder'),
          showOnlyWhenEditable: false,
        }),
        ByteCount.configure({
          limit: MAX_MESSAGE_TEXT_IN_BYTES,
        }),
        CustomCommandsExtension,
        EmojiReplacer,
        ...(props.extensions || []),
      ],
      [props.extensions, props.placeholder]
    );

    const transformPasted = useLatestCallback((slice: Slice, view: EditorView): Slice => {
      const newSlice = new Slice(
        hardBreaksToParagraphsFragment(slice.content, view),
        slice.openStart,
        slice.openEnd
      );
      return newSlice;
    });

    const editor = useEditor(
      {
        extensions,
        editable: !props.disabled,
        onUpdate: handleUpdate,
        content: props.initialContent ?? '',
        onTransaction: ({ editor }) => {
          enableArrowKeyNavMode(editor.state.selection?.anchor === 1 && editorFocused);
        },
        editorProps: {
          handlePaste,
          clipboardTextParser: getEditorMultilineTextParser,
          transformPasted,
        },
      },
      [extensions, props.disabled]
    );

    // useImperativeHandle has an issue keeping up
    // assign it manually via a memo so it runs before effects are called
    useMemo(() => {
      const editorRef = createEditorRef(editor);
      assignRef(ref, editorRef);

      if (__DEV__) {
        Object.assign(globalThis, {
          _editor: editorRef,
          _getMarkdown: () => getEditorMarkdown(editor),
        });
      }
    }, [editor, ref]);

    useEffect(
      () => () => {
        if (__DEV__) {
          // don't leak these on unmount
          Object.assign(globalThis, {
            _editor: undefined,
            _getMarkdown: undefined,
          });
        }
      },
      []
    );

    useKeyboardRestoreFocusCallback(() => {
      editor?.commands.focus();
    }, !simple);

    useEffect(() => {
      if (editor?.isEmpty && editorFocused) {
        enableArrowKeyNavMode(true);
      }
    }, [editor?.isEmpty, editorFocused]);

    useEffect(() => {
      editor?.commands.setContent(props.initialContent || '', true);
    }, [editor, props.initialContent]);

    useEffect(() => {
      if (!simple) {
        editor?.commands.focus('end');
      }

      // Inspect in dev, but no meme leaks pls!
      if (__DEV__ && editor) {
        Object.assign(globalThis, {
          _editor: editor,
          _getMarkdown: () => getEditorMarkdown(editor),
        });
        return () => {
          Object.assign(globalThis, {
            _editor: undefined,
            _getMarkdown: undefined,
          });
        };
      }
    }, [editor, simple]);

    if (!editor) return null;

    const handleMessageEdit = (content: string, mentions?: WickrMessageMentions) => {
      if (!editor) return;
      editor.commands.clearContent(true);
      // Wait a frame before adding the content
      adaptiveRequestAnimationFrame(() => {
        const jsonContent = markdownToJSON(content, mentions);
        editor.commands.setContent(jsonContent, true);
      });
    };

    const handleClosePreview = (type?: MessagePreviewType) => {
      if (type === 'edit') {
        editor?.commands.clearContent(true);
      }
    };

    const handleMentionClick = () => {
      // This function adds a @ to the input which triggers the mention suggestions extension.
      // If the character @ is the last character in the editor, clicking the button should
      // remove the @ which removes the mention suggestions menu. This should simulate
      // basic toggle functionality for the button.
      ensureCurrentLineIsNotAHardBreak();
      const { anchor } = editor.state.selection;
      const getLastWord = (node: any): any => {
        return node.lastChild ? getLastWord(node.lastChild) : node.text;
      };
      const lastChar = getLastWord(editor.state.doc.content)?.slice(-1);

      if (lastChar === AT_MENTION_PREFIX) {
        return editor
          .chain()
          .focus()
          .deleteRange({ from: anchor - 1, to: anchor })
          .run();
      }
      // Add a space if the last character is not whitespace
      const startWithSpace = lastChar && !lastChar.match(/\s/);
      const textToAdd = `${startWithSpace ? ' ' : ''}${AT_MENTION_PREFIX}`;
      editor.chain().focus().insertText(textToAdd).run();
    };

    const handleCodeBlockClick = () => {
      if (editor.isActive('codeBlock')) {
        return editor.commands.toggleCodeBlock();
      } else {
        metrics.addCount('Markdown:CodeBlock');
      }

      const fragment = editor.view.state.selection.content().content;
      let text = '';
      fragment.forEach((n, _offset, index) => {
        const lastChild = index == fragment.childCount - 1;
        text += n.textContent;
        if (!lastChild) {
          text += '\n';
        }
      });

      // Replace selection with a single merged paragraph of all nodes
      // so that the code block can wrap all of the text.
      // This method also preserves newlines.
      editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContent({
          type: 'paragraph',
          content: [{ type: 'text', text }],
        })
        .toggleCodeBlock()
        .run();
    };

    // Even though we configure RichTextLink to not open links, they still open.
    // Stopping them here fixes the issue, and is safer in case any tiptap settings change.
    const handleEditorWrapperClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const el = e.target as HTMLElement | null;
      const isLink = el?.tagName === 'A';
      if (isLink) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleRecordingButtonClick = () => {
      if (selfCallStatus) {
        dispatch(
          openAlertModal({
            title: t('Voice Memo Disabled'),
            body: t('Voice memo recordings are disabled during active calls.'),
          })
        );
      } else {
        setIsRecordingOpen(true);
      }
    };

    return (
      <div
        className={clsx(styles.composeWrapper, props.className, { [styles.simple]: simple })}
        id={simple ? `${SIMPLE_WRAPPER_DOM_PREFIX}-${composeBoxId}` : COMPOSE_WRAPPER_DOM_ID}
      >
        {!simple && (
          <MessagePreviewWithClose onMessageEdit={handleMessageEdit} onClose={handleClosePreview} />
        )}
        <div
          onClick={handleEditorWrapperClick}
          className={clsx(styles.editorWrapper, {
            [styles.focused]: editorFocused,
          })}
          ref={editorWrapperEl}
        >
          <div className={styles.editorContentWrapper}>
            <ComposeTopRow
              editor={editor}
              markdownControlsVisible={markdownControlsVisible}
              simple={simple}
              onClick={(_event, action) => {
                switch (action) {
                  case 'codeBlock':
                    handleCodeBlockClick();
                    break;
                  case 'link':
                    setEditorFocused(false);
                    break;
                }
              }}
            />
            <TipTapEditorContent
              className={clsx(styles.editorContent, markdownStyles.markdownText, {
                [styles.markdownControlsVisible]: markdownControlsVisible,
                [styles.focused]: editorFocused,
              })}
              editor={editor}
              onFocus={() => setEditorFocused(true)}
              onBlur={() => setEditorFocused(false)}
            />
            {filesEnabled && editor?.isEmpty && !simple && (
              <>
                <Tooltip tip={t('Compose.VoiceRecordingButton.Tooltip')}>
                  <IconButton
                    wrapperClassName={styles.microphoneButton}
                    label={t('Compose.VoiceRecordingButton.Label')}
                    onClick={handleRecordingButtonClick}
                  >
                    <MicrophoneSolidIcon size="20px" />
                  </IconButton>
                </Tooltip>
                <KeyboardShortcut
                  shortcut="VoiceMemo"
                  onShortcut={handleRecordingButtonClick}
                  disabled={!isMessagesActive}
                />
              </>
            )}
            {isRecordingOpen && (
              <VoiceRecordingBox
                onRecordingStatusChange={setIsVoiceRecording}
                onClose={() => {
                  setIsRecordingOpen(false);
                  setVoiceRecordingSeconds(0);
                  editor.commands.focus();
                }}
                onDurationChange={setVoiceRecordingSeconds}
              />
            )}
          </div>
        </div>
        <ComposeBottomRow
          editor={editor}
          emojiPopperRef={emojiPopperRef}
          markdownControlsVisible={markdownControlsVisible}
          shouldEnableMentions={shouldEnableMentions}
          showAddbutton={showAddbutton}
          showNewlineHint={newLineHintVisible}
          simple={simple}
          onClick={(_event, action) => {
            switch (action) {
              case 'mention':
                handleMentionClick();
                break;
              case 'send':
                handleEnterKeyPress();
                break;
            }
          }}
          onEmojiSelection={(emoji) => {
            ensureCurrentLineIsNotAHardBreak();
            editor
              ?.chain()
              .focus()
              .insertText(emoji.native ?? '')
              .run();
          }}
          sendDisabled={
            isRecordingOpen ? voiceRecordingSeconds === 0 || isVoiceRecording : editor?.isEmpty
          }
        />
      </div>
    );
  }
);

if (__DEV__) ComposeBoxImpl.displayName = 'ComposeBox';

export const ComposeBox = withErrorBoundary(ComposeBoxImpl, 'ComposeBox', {
  Fallback: ({ resetErrorBoundary, error }) => {
    const { t } = useAppTranslation();
    const isProd = useSetting('isProduction');

    return (
      <div className={styles.composeWrapper}>
        <div
          className={clsx(styles.editorWrapper, {})}
          style={{ minHeight: '100px', padding: '8px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <h3>{t('Error')}</h3>
              {isProd ? (
                <p>{error.message}</p>
              ) : (
                <details>
                  <summary>{error.message}</summary>
                  <pre>{error.stack}</pre>
                </details>
              )}
            </div>
            <div>
              <Button color="secondary" onClick={resetErrorBoundary}>
                {t('Try again')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  },
});
