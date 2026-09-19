import { Blockquote } from '@tiptap/extension-blockquote';
import { Code } from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import { Document } from '@tiptap/extension-document';
import { Dropcursor } from '@tiptap/extension-dropcursor';
import { Gapcursor } from '@tiptap/extension-gapcursor';
import { Heading } from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import { History } from '@tiptap/extension-history';
import { ListItem } from '@tiptap/extension-list-item';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { ResolvedPos } from '@tiptap/pm/model';
import { EditorView } from '@tiptap/pm/view';
import { AnyExtension, Editor, Extensions, JSONContent } from '@tiptap/react';
import { minutesToMilliseconds } from 'date-fns';
import { toH } from 'hast-to-hyperscript';
import compose from 'just-compose';
import isNil from 'lodash/isNil';
import { lowlight } from 'lowlight';
import { Slice, Fragment, Node } from 'prosemirror-model';
import React, { createElement } from 'react';
import { generatePath, matchRoutes, RouteObject } from 'react-router';
import { Markdown } from 'tiptap-markdown';
import messageSearchListItemStyles from '../../components/Panels/SearchPanel/SearchListItems/styles.module.less';
import { emojifyShortHandsInJsonContent } from '../emoji/emojiReplaceUtils';
import { joinPath } from '../path';
import { SendTextMessageMention } from '@/apis/webChannel/BridgeWebChannel';
import { BotMentionExtensionName } from '@/components/ComposeBox/Extensions/Mention/Bot/BotMentionExtension';
import { AT_MENTION_PREFIX } from '@/components/ComposeBox/Extensions/Mention/MentionList';
import { CHAT_BUBBLE_CONTAINER_GLOBAL_CLASSNAME } from '@/components/Convo/ChatBubbleContainer';
import { CopyCodeBtn } from '@/components/MarkdownText/CopyCodeBtn';
import { MentionText } from '@/components/MarkdownText/MentionText';
import { Logger } from '@/lib/logger';
import { WickrMessageMention, WickrMessageMentions } from '@/lib/protobuf/messages';
import { memoOnArgs } from '@/utils/function';
import Mention, { MentionAttributes, MentionNode, MENTION_TYPE_NAME } from './marks/mention';
import { BlockLevelHardBreak } from './rules/blockLevelHardBreak';
import { CustomBold } from './rules/bold';
import { CustomBulletList } from './rules/bulletList';
import { CustomCode } from './rules/code';
import { CustomHeading } from './rules/heading';
import { CustomItalic } from './rules/italic';
import { CustomMarkdown } from './rules/markdown';
import { CustomOrderedList } from './rules/orderedList';
import { removeMarksFromEmoji } from './rules/removeEmojiMarks';
import { RichTextLink } from './rules/richTextLink';
import { CustomStrike } from './rules/strike';

const logger = new Logger('markdown');

/** Base markdown extensions (bold, italic, lists, code blocks, etc). */
export const getDefaultMarkdownExtensions = (): Extensions => [
  // Default
  Document, // Top-level document
  Paragraph, // Paragraphs
  History, // Undo/redo history
  ListItem, // Lists
  Gapcursor, // Allows the cursor to go in more places
  Dropcursor, // Allows for dropping items
  Blockquote, // Block quotes
  CodeBlock, // Code blocks
  CustomHeading.configure({
    // Headings
    levels: [1, 2, 3],
  }),
  // can re-enable highlights if we ever support that in the convomessage
  // Highlight.configure({ multicolor: true }),
  // Custom
  CustomCode, // Inline code with custom markdown
  CustomBold, // Bold with custom markdown
  CustomItalic, // Italic with custom markdown
  CustomStrike, // Strikethrough with custom markdown
  CustomBulletList, // Bulletlist with with custom markdown
  CustomOrderedList, // Orderedlist with custom markdown
  BlockLevelHardBreak, // Use hardBreaks as block level instead of inline
  RichTextLink,
  CustomMarkdown,
  removeMarksFromEmoji,
];

/** Extensions that headless editors can safely use */
export const HEADLESS_EXTENSIONS_ALLOWED = new Set([
  // from the default set
  Document.name,
  Paragraph.name,
  Code.name,
  ListItem.name,
  Text.name,
  Blockquote.name,
  Heading.name,
  Highlight.name,
  CustomBold.name,
  CustomItalic.name,
  CustomStrike.name,
  CustomBulletList.name,
  CustomOrderedList.name,
  BlockLevelHardBreak.name,
  RichTextLink.name,
  Markdown.name,
  // from the compose box
  Mention.name,
  BotMentionExtensionName,
  CodeBlock.name,
]);

/** Mention extension names - at least one required when members are provided. */
const MENTION_EXTENSION_NAMES = [MENTION_TYPE_NAME, BotMentionExtensionName] as const;

/**
 * @param extensions array of extensions
 * @returns An array of those allowed for headless editors
 */
const toAllowedHeadlessExtensions = (extensions: AnyExtension[] = []) => {
  const allowed = extensions.filter(({ name }) => HEADLESS_EXTENSIONS_ALLOWED.has(name));
  if (__DEV__) {
    logger.info('toAllowedHeadlessExtensions: extensions:', {
      allowed: allowed.map((ext) => ext.name),
      denied: extensions
        .filter((ext) => !HEADLESS_EXTENSIONS_ALLOWED.has(ext.name))
        .map((ext) => ext.name),
    });
  }
  return allowed;
};

/**
 * Recursively parses JSONContent into react elements.
 * @param jsonContent The content to parse.
 * @returns JSX elements
 * TODO: unit test
 */
export const jsonContentToElement = (
  jsonContent: JSONContent,
  isPreview?: boolean,
  textToHighlight?: string,
  copyCodeBtn?: boolean
): JSX.Element => {
  const type = jsonContent.type;
  if (!type) {
    return <></>;
  }

  const children =
    jsonContent.content?.map((v) =>
      jsonContentToElement(v, isPreview, textToHighlight, copyCodeBtn)
    ) ?? [];

  // Node parsing
  switch (type) {
    case 'paragraph':
      return <div>{...children}</div>; // a paragraph may have div or other elements as children so we can't use a <p> tag
    case 'orderedList':
      return <ol start={jsonContent.attrs?.start ?? ''}>{...children}</ol>;
    case 'listItem':
      // VoiceOver cannot read <li> tags in the QT WebEngine
      return <div style={{ display: 'list-item' }}>{...children}</div>;
    case 'blockquote':
      return <blockquote>{...children}</blockquote>;
    case 'codeBlock':
      return (
        // Code blocks have syntax highlighting
        // There will likely not be more than one code child, but just in case...
        <pre>
          {...jsonContent.content?.map((v) => {
            const language = jsonContent.attrs?.language;
            const useLanguage = language && lowlight.listLanguages().includes(language);
            const highlight = useLanguage
              ? lowlight.highlight(language, v.text ?? '')
              : lowlight.highlightAuto(v.text ?? '');
            if (highlight.children.length === 0) {
              // No children in the highlight, failed to parse. Just display text as code without highlighting.
              return <code key={v.text}>{v.text}</code>;
            }
            return (
              <React.Fragment key={v.text}>
                <code>{toH(createElement, highlight)}</code>
                {copyCodeBtn && <CopyCodeBtn text={v.text} />}
              </React.Fragment>
            );
          }) ?? []}
        </pre>
      );
    case 'bulletList':
      return <ul>{...children}</ul>;
    case 'hardBreak':
      return <br />;
    case 'heading': {
      switch (jsonContent.attrs?.level ?? 1) {
        case 1:
          return <h1>{...children}</h1>;
        case 2:
          return <h2>{...children}</h2>;
        case 3:
          return <h3>{...children}</h3>;
        default:
          return <b>{...children}</b>;
      }
    }
    case Mention.name:
      return (
        <MentionText userIdHash={jsonContent.attrs?.id} isPreview={isPreview}>
          {`${AT_MENTION_PREFIX}${jsonContent.attrs?.label}`}
        </MentionText>
      );
    case 'text': {
      let thisElement = <>{jsonContent.text}</>;

      // modify element to give highlight styling to a specific substring
      if (
        textToHighlight &&
        jsonContent.text?.toLowerCase().includes(textToHighlight.toLowerCase())
      ) {
        const regex = new RegExp(
          `(${textToHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
          'gi'
        );
        const splitTextArray = jsonContent.text.split(regex);

        thisElement = (
          <>
            {splitTextArray.map((text, index) =>
              regex.test(text) ? (
                <span key={index} className={messageSearchListItemStyles.highlightedText}>
                  {text}
                </span>
              ) : (
                text
              )
            )}
          </>
        );
      }

      // Mark parsing for inline styles
      jsonContent.marks?.forEach((mark) => {
        switch (mark.type) {
          case 'bold':
            thisElement = <strong>{thisElement}</strong>;
            return;
          case 'italic':
            thisElement = <em>{thisElement}</em>;
            return;
          case 'strike':
            thisElement = <s>{thisElement}</s>;
            return;
          case 'code':
            thisElement = <code>{thisElement}</code>;
            return;
          case 'link':
            thisElement = (
              <a
                href={mark.attrs?.href}
                target={mark.attrs?.target}
                data-markdown="link"
                tabIndex={isPreview ? -1 : 0}
              >
                {thisElement}
              </a>
            );
            return;
        }
      });

      return thisElement;
    }
    default:
      return <>{...children}</>;
  }
};

const createHeadlessEditor = (extensions: AnyExtension[], useExtraEditorProps = true) => {
  logger.info('createHeadlessEditor', {
    extensions: extensionNamesHash(extensions),
    useExtraEditorProps,
  });
  const editor = new Editor({
    editable: false,
    extensions: toAllowedHeadlessExtensions(extensions),
    editorProps: useExtraEditorProps
      ? {
          clipboardTextParser: (text, $context, plain, view) =>
            getEditorMultilineTextParser(text, $context, plain, view, true),
          handleScrollToSelection: (_view) => true,
        }
      : undefined,
  });
  return editor;
};

function extensionNamesHash(exts: AnyExtension[]) {
  // reduce plugins to their names
  const names = exts.map((ext) => ext.name).sort();
  if (__DEV__) {
    if (new Set(names).size !== names.length) {
      logger.warn('extensionNamesHash: duplicate extention names detected', names);
    }
  }
  return names.join(',');
}

/**
 * Cache headless editor instance for future reuse if given args are the same (extension names and useExtraEditorProps)
 * this will prevent us from creating new editor for every message to be rendered.
 */
export const getOrCreateHeadlessEditor = memoOnArgs(createHeadlessEditor, {
  hashFn: (args) => `${extensionNamesHash(args[0])},${args[1]}`,
  maxSize: 5,
  maxAge: minutesToMilliseconds(30),
  onCacheHit: (editor) => {
    if (editor.isDestroyed) {
      logger.warn(
        'getOrCreateHeadlessEditor : attempted to use a destroyed editor; creating a new one instead'
      );
      return false;
    } else {
      editor.commands.clearContent();
    }
  },
  onCacheDelete: (editor) => editor.destroy(),
});

if (__DEV__) {
  Object.assign(globalThis, { getOrCreateHeadlessEditor });
}

/**
 * Given a markdown string, returns an Editor that has all the markdown content and mentions
 * @param markdownInput Plain input markdown string, such as _test_
 * @param mentions Optional list of mentions
 * @param extensions Optional list of extensions, such as different versions of Mention for render/compose
 * @param useMarkForMentions Default true. Set to false to use a node for mentions (used in compose)
 * @returns Editor with content set to the markdownInput
 * TODO: unit test
 */
function getEditorWithMarkdownContent(
  markdownInput: string,
  mentions?: WickrMessageMentions,
  extensions: AnyExtension[] = [Mention, CodeBlock],
  useExtraEditorProps = true
): Editor {
  // 1) Create headless editor
  const editor = getOrCreateHeadlessEditor(
    [...getDefaultMarkdownExtensions(), ...extensions],
    useExtraEditorProps
  );

  // 2) Prepare the message markdown for tiptap
  const newMarkdown = prepareMarkdownPipeline(markdownInput, mentions ?? []);

  // 3) Set the editor's content to the new markdown
  editor.commands.setContent(newMarkdown, true, {
    preserveWhitespace: true,
  });

  return editor;
}

/**
 * Given a markdown string, returns JSONContent that has all the markdown content and mentions properly parsed.
 * @param markdownInput Plain input markdown string, such as _test_
 * @param mentions Optional list of mentions
 * @param extensions Optional list of extensions, such as different versions of Mention for render/compose
 * @param useMarkForMentions Default true. Set to false to use a node for mentions (used in compose)
 * @returns JSONContent to be used by an editor or converted to DOM nodes
 * TODO: unit test
 */
export const markdownToJSON = memoOnArgs(
  (
    markdownInput: string,
    mentions?: WickrMessageMentions,
    extensions: AnyExtension[] = [Mention, CodeBlock]
  ): JSONContent => {
    // 1) Get editor with markdown content
    const editor = getEditorWithMarkdownContent(markdownInput, mentions, extensions);

    // 2) Apply modifications to the JSON content
    const jsonContent = modifyJsonPipeline(editor.getJSON());

    // 3) Return the JSON content that is now ready for tiptap (compose box)
    return jsonContent;
  },
  { maxSize: 500 }
);

const mentionRoute = { id: 'mention', path: '/user/:userId' } satisfies RouteObject;
const generateWickrPath = (path: string, params?: AnyObject) =>
  joinPath(generatePath(path, params));

/**
 * Converts all mentions in a message to mention links
 * @param markdownInput Original markdown
 * @param mentions Array of mentions for the message
 * @returns New markdown with mentions converted to links
 * @example
 * convertMentionsToLinks('@Hello', [...]) // => '[@Hello](wickr://user/userId)'
 */
export const convertMentionsToLinks = (markdownInput: string, mentions: WickrMessageMention[]) => {
  if (mentions?.length) {
    // traverse backward so our indicies are not affected
    for (let i = mentions.length - 1; i >= 0; i--) {
      const { endIndex, startIndex, userid } = mentions[i];
      if (isNil(endIndex) || isNil(startIndex) || isNil(userid)) {
        logger.warn('Invalid mention:', mentions[i]);
        continue;
      }
      const before = markdownInput.substring(0, startIndex);
      const label = markdownInput.substring(startIndex, endIndex);
      const after = markdownInput.substring(endIndex);
      markdownInput = `${before}[${label}](${generateWickrPath(mentionRoute.path, {
        userId: userid,
      })})${after}`;
    }
  }

  return markdownInput;
};

/**
 * We linkify mentions in the raw message markdown before processing it (convertMentionsToLinks),
 * and convert them back to tiptap mentions here.
 *
 * NOTE: While we return jsonContent, the input is mutated in place.
 *
 * If we need to build more "features" into links like this, we can generalize this function to
 * handle all matching routes.
 */
export const convertMentionLinksToMentions = (jsonContent: JSONContent): JSONContent => {
  jsonContent.content?.forEach((item, itemIndex, items) => {
    if (item.marks) {
      for (let i = 0; i < item.marks.length; i++) {
        const mark = item.marks[i];
        if (mark.type === 'link') {
          const href = mark.attrs?.href;
          if (href) {
            const routeMatches = matchRoutes([mentionRoute], href);
            const match = routeMatches?.[0];
            if (match?.route.id === mentionRoute.id) {
              const mentionNode: MentionNode = {
                type: MENTION_TYPE_NAME,
                attrs: {
                  id: match.params.userId ?? '',
                  label: item.text?.startsWith(AT_MENTION_PREFIX)
                    ? item.text.substring(AT_MENTION_PREFIX.length)
                    : item.text ?? '',
                },
              };
              // Replace text node + link mark with a Mention node
              items[itemIndex] = mentionNode;
              break;
            }
          }
        }
      }
    } else {
      convertMentionLinksToMentions(item);
    }
  });
  return jsonContent;
};

// TODO: unit test
const getNodeText = (node: JSONContent): string | undefined => {
  if (node.content?.length) {
    return getNodeText(node.content[0]);
  }

  return node.text;
};

/**
 * This is necessary to preserve multiple newlines when pasting content into the editor.
 * This does not preserve multiple newlines when sent/parsed from markdown.
 * TODO: unit tests
 */
export const getEditorMultilineTextParser = (
  text: string,
  $context: ResolvedPos,
  _plain: boolean,
  _view: EditorView,
  withHardBreak = false
) => {
  const blocks = text.split(/(?:\r\n?|\n)/);
  const nodes: Node[] = [];

  blocks.forEach((line) => {
    const nodeJson: JSONContent = { type: 'paragraph' };
    if (line.length > 0) {
      nodeJson.content = [{ type: 'text', text: line }];
    } else if (withHardBreak) {
      nodeJson.content = [{ type: 'hardBreak' }];
    }
    const node = Node.fromJSON($context.doc.type.schema, nodeJson);
    nodes.push(node);
  });

  const fragment = Fragment.fromArray(nodes);
  return Slice.maxOpen(fragment);
};

/**
 * Remove the trailing three backticks used to indicate exiting a codeblock
 * TODO: unit tests
 */
export const removeTrailingBackticks = (jsonContent: JSONContent): JSONContent => {
  const contentLength = jsonContent.content?.length ?? 0;
  for (let nodeIndex = 0; nodeIndex < contentLength; nodeIndex++) {
    const node = jsonContent.content![nodeIndex];
    if (!node || node.type !== 'codeBlock' || !node.content || !node.content[0].text) {
      continue;
    }
    const length = node.content[0].text.length;
    // Remove the trailing backticks
    if (node.content[0].text.endsWith('```')) {
      node.content[0].text = node.content[0].text.slice(0, length - 3);
      return jsonContent;
    }
  }

  return jsonContent;
};

/**
 * Converts any markdown hard breaks (lines with only \) to just newlines.
 * @param input A markdown string with hard breaks.
 * @returns A transformed string with only newlines and no hard breaks.
 */
export const convertHardBreaksToNewlines = (input: string): string => {
  return applyTransformToNonCodeBlocks(input, (line) => {
    // Empty lines are those between paragraphs, automatically added by
    // the markdown parser (since markdown needs \n\n for one newline).
    // Return false to remove these empty newlines
    if (line.length === 0) {
      return false;
    }

    const lineWithoutHardBreak = line.replace(/\\$/m, '');
    if (lineWithoutHardBreak.length > 0) {
      // Non-empty lines do not have hard breaks
      return line;
    }

    return lineWithoutHardBreak;
  });
};

/**
 * Converts any empty newlines (\n) into newlines preceeded by hard breaks (\\n).
 * Also adds an extra newline to each line of text to adhere to standard
 * markdown format, which has two newlines between each paragraph.
 * @param input A markdown string with new lines.
 * @returns A transformed string with hard breaks and new lines.
 */
export const convertNewlinesToHardBreaks = (input: string): string =>
  applyTransformToNonCodeBlocks(input, (line, _prevLine) => {
    // Add hard breaks on empty lines only
    // Replace any line-ending hard breaks first for compatibility
    const lineWithoutHardBreaks = line.replace(/\\$/m, '');
    if (lineWithoutHardBreaks.length === 0) {
      return `${lineWithoutHardBreaks}\\`;
    }

    // Add extra newlines for each line of text to be markdown format
    return `${lineWithoutHardBreaks}\n`;
  });

/**
 * Converts ampersands ("&") in valid HTML entities to escaped ampersands ("\&") to
 * prevent encoding them as HTML entities.
 * @param input Markdown input string
 * @returns Markdown input string with any & in valid HTML entities converted to \&,
 * excluding code blocks
 */
export const escapeAmpersands = (input: string): string =>
  applyTransformToNonCodeBlocks(input, (line) => line.replace(/&(\w+|#\d+);/g, '\\&$1;'));

/** Code blocks can be on their own or in a blockquote, list, etc. */
const CODE_BLOCK_MARK_RE = /^\s*(> )?(```)/;
/**
 * Applies a transform function to every line of a string except those in code blocks.
 * @param input Input markdown string
 * @param transform Transformation function that takes a string as input and returns a string
 * TODO: unit tests
 */
const applyTransformToNonCodeBlocks = (
  input: string,
  transform: (line: string, prevLine?: string) => string | false
): string => {
  const lines = input.split('\n');
  const newLines: string[] = [];
  // save the opening code block string so we can find matching opening/closing marks
  // also serves as the truthy/falsy of whether or not we are in a code block
  let currentCodeMark = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (currentCodeMark && line === currentCodeMark) {
      currentCodeMark = '';
    } else if (!currentCodeMark && CODE_BLOCK_MARK_RE.test(line)) {
      currentCodeMark = line;
    }

    if (currentCodeMark) {
      // do not transform code block line
      newLines.push(line);
    } else {
      // transform non-code line
      const result = transform(line, i > 0 ? lines[i - 1] : undefined);
      if (result !== false) {
        newLines.push(result);
      }
    }
  }

  return newLines.join('\n').trimEnd();
};

/**
 * Converts any empty top level paragraphs into hard break nodes.
 *
 * Internally, we are using paragraphs instead of hard breaks because they
 * are easier to work with in the editor. For example, selecting a line
 * that a hard break is on and trying to type some text has difficulties,
 * but using a paragraph does not have any difficulties. However, using
 * paragraphs presents a problem when converting to markdown because markdown
 * will remove any empty paragraphs when parsing and always return \n\n
 * between paragraphs (as is expected with markdown). To align with mobile,
 * we are using a WYSIWYG newline approach to markdown - that is, if you see
 * a newline, it's just a newline. We expect to send newlines and receive
 * newlines.
 * TODO: unit tests
 */
export const convertEmptyParagraphsToHardBreaks = (jsonContent: JSONContent): JSONContent => {
  const contentLength = jsonContent.content?.length ?? 0;
  for (let nodeIndex = 0; nodeIndex < contentLength; nodeIndex++) {
    const node = jsonContent.content![nodeIndex];
    if (!node || node.type !== 'paragraph' || node.content) {
      continue;
    }

    // If the node is an empty paragraph, convert it to a hardBreak
    node.type = 'hardBreak';
  }

  return jsonContent;
};

/**
 * Converts any top level paragraphs that appear before block level nodes
 * that only contain \\ as the text to hard breaks.
 *
 * This fixes a bug where hard breaks wouldn't be converted properly if they are before a
 * block level node, such as a list, code block, or quote.
 * TODO: unit tests
 */
export const convertHardBreakParagraphsToHardBreaks = (jsonContent: JSONContent): JSONContent => {
  const blockNodeTypes = ['codeBlock', 'blockquote', 'bulletList', 'orderedList', 'heading'];
  const contentLength = jsonContent.content?.length ?? 0;
  for (let nodeIndex = 0; nodeIndex < contentLength - 1; nodeIndex++) {
    const node = jsonContent.content![nodeIndex];
    const nodeContentLength = node.content?.length ?? 0;
    if (!node || node.type !== 'paragraph' || nodeContentLength !== 1) {
      continue;
    }

    const text = node.content![0].text;
    if (text !== '\\') {
      continue;
    }

    // Only convert if the next node type is a block level node from the list
    const nextNode = jsonContent.content![nodeIndex + 1];
    if (!blockNodeTypes.includes(nextNode?.type ?? '')) {
      continue;
    }

    // If the node only contains a hard break character, convert it to a hardBreak
    node.type = 'hardBreak';
    delete node.content;
  }

  return jsonContent;
};

export const getEditorMarkdown = (editor: Editor | null | undefined): string =>
  editor?.storage.markdown?.getMarkdown() ?? '';

/** @returns Array of mentions, sorted by order of appearance */
export const getMentionNodes = (jsonContent: JSONContent | undefined): MentionAttributes[] => {
  const mentions = (jsonContent?.content || []).flatMap(getMentionNodes);
  if (jsonContent?.type === MENTION_TYPE_NAME || jsonContent?.type === 'BotMention') {
    jsonContent.type = MENTION_TYPE_NAME; // Normalize bot mentions to mentions
    mentions.push(jsonContent.attrs as any);
  }
  return mentions;
};

/** Create the mentions array for the message mentions with proper start/end indices */
export const parseSendTextMessageMentions = (
  /** Message (markdown) string */
  message: string,
  /** Message JSON */
  jsonContent: JSONContent,
  /** string for mentioning all users in room, e.g., all */
  allLabel: string,
  /** Record of room members that may include an id string */
  members: { [idHash: string]: { id?: string } }
): SendTextMessageMention[] => {
  allLabel = allLabel.toLowerCase();
  let startIdx = 0;

  const mentions = getMentionNodes(jsonContent);

  // find start/end, search in order
  return mentions
    .map(({ id, label }) => {
      const atMention = `${AT_MENTION_PREFIX}${label}`;
      const idx = message.indexOf(atMention, startIdx);
      if (idx === -1) {
        // We should never end up here, but throwing an error is worse than getting mentions wrong
        logger.error(`parseSendTextMessageMentions: could not find label: "${label}"; ignoring`);
        return;
      }
      const lowerCaseId = id.toLowerCase();
      // when desktop populates wickrMsg.text?.mentionList for all mentions this will be returned back as @all, which will be passed in onMessageEdit
      const mentionAll = lowerCaseId === allLabel || lowerCaseId === '@all';
      const stop = idx + atMention.length;
      startIdx = stop;
      if (idx === stop) {
        // SDK sometimes includes an empty (zero-length) mention, but only temporarily; ignore it.
        // https://sim.amazon.com/Wickr-14049
        logger.warn(`parseSendTextMessageMentions: skipping empty mention`);
        return;
      }
      return {
        mentionAll,
        start: idx,
        stop,
        userId: members[id]?.id ?? '',
      };
    })
    .filter((m): m is SendTextMessageMention => !!m);
};

/** Prepares message content for sending by serializing to markdown with mentions. */
export const prepareTextMessageForSending = (options: {
  jsonContent: JSONContent;
  extensions: AnyExtension[];
  allUsersLabel: string;
  members: Record<string, { id: string }>;
}): { message: string; mentions: SendTextMessageMention[] } => {
  const extensionNames = new Set(options.extensions.map((ext) => ext.name));

  // Validate mention extensions if members provided
  const mentionsRequired = Object.keys(options.members).length > 0;
  if (mentionsRequired) {
    const hasMentionExtension = MENTION_EXTENSION_NAMES.some((name) => extensionNames.has(name));
    if (!hasMentionExtension) {
      const error = new Error(
        `Mention extension required when members are provided. ` +
          `Add one of: ${MENTION_EXTENSION_NAMES.join(', ')}.`
      );
      throw error;
    }
  }

  const editor = getOrCreateHeadlessEditor(options.extensions, false);

  // 1) Copy original content into headless editor
  editor.commands.setContent(options.jsonContent);

  // 2) Modify editor content through these functions (first to last)
  const newJsonPipeline = compose(
    emojifyShortHandsInJsonContent,
    convertEmptyParagraphsToHardBreaks,
    fixMismatchingLinkTextUrls
  );
  const newJson = newJsonPipeline(editor.getJSON());

  // 3) Put the content back into the headless editor
  editor.commands.setContent(newJson);

  // 4) Generate final message markdown through these functions (first to last)
  const newMessagePipeline = compose(
    getEditorMarkdown,
    convertHardBreaksToNewlines,
    formatNewLineItalicizedBlockQuotes
  );
  const message = newMessagePipeline(editor);

  // 5) Finally, generate mention indices based on the message we plan to send
  // This has to be done last so the indices will line up with the final message text
  const mentions = parseSendTextMessageMentions(
    message,
    editor.getJSON(),
    options.allUsersLabel,
    options.members
  );

  return { message, mentions };
};

export const formatNewLineItalicizedBlockQuotes = (mdString: string) => {
  return mdString.replaceAll('\n_>', '\n>');
};

// These are tags used to style markdown text. We use these on copy to preserve the text formatting
// New markdown formatting should be added here
const markdownElements = [
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'h1',
  'h2',
  'h3',
  's',
  'em',
  'strong',
  'b',
];

/**
 * Preserve the formatted markdown when copying partial words/text and return wrapped node
 * */
export const preserveSelectionContentFormat = (selection: Selection) => {
  const range = selection.getRangeAt(0);
  const containerEl = document.createElement('div');
  const contents = range.cloneContents();

  // If the document fragment has no child nodes then the content will be undefined
  // This is the case for some elements such as inputs. We want to then get the full active element selected.
  if (!contents.hasChildNodes() && contents.ownerDocument?.activeElement) {
    containerEl.appendChild(contents.ownerDocument.activeElement?.cloneNode(true));
  } else {
    // Else, just clone the entire node
    containerEl.appendChild(contents.cloneNode(true));
  }

  // If more than one node is selected then anchorNode is not necessarily the highest up node
  // focusNode could be as well so use this to find true parent
  let parentEl =
    contents.childNodes.length > 1
      ? range.commonAncestorContainer.firstChild?.parentElement
      : selection.anchorNode?.parentElement;

  // If no parent element is associated with the content, then just return contents.
  if (!parentEl) return containerEl;

  // Find wrapping nodes to preserve the formatting of the copied contents. See SIM https://i.amazon.com/Wickr-828
  const wrappingNodes: HTMLElement[] = [];
  // We only want to wrap a tag at most once
  const unusedElements = new Set(markdownElements);
  // Find all relevant MD wrapping nodes and create a new element
  while (parentEl && !parentEl.classList.contains(CHAT_BUBBLE_CONTAINER_GLOBAL_CLASSNAME)) {
    if (unusedElements.has(parentEl.localName)) {
      const elCopy = document.createElement(parentEl.localName);
      for (const attr of parentEl.getAttributeNames()) {
        const attrValue = parentEl.getAttribute(attr);
        elCopy.setAttribute(attr, attrValue ?? '');
      }
      wrappingNodes.push(elCopy);
      unusedElements.delete(parentEl.localName);
    }
    parentEl = parentEl.parentElement;
  }

  // If no wrapping markdown elements found, just return the original contents
  if (wrappingNodes.length === 0) return containerEl;

  // We don't want to wrap elements with both <ol> and <ul>, because then only one of them is used
  // We want to use the one closer to the selection, so remove the one added later to the list
  const olIdx = wrappingNodes.findIndex((el) => el.localName === 'ol');
  const ulIdx = wrappingNodes.findIndex((el) => el.localName === 'ul');
  if (olIdx !== -1 && ulIdx !== -1) {
    wrappingNodes.splice(Math.max(olIdx, ulIdx), 1);
  }

  // This is the tag closest to the selected contents, so we append the selection to it
  wrappingNodes[0].appendChild(contents);
  // Now iterate each wrapping node from deepest child and wrap it into their parent node
  for (let i = 0; i < wrappingNodes.length - 1; i++) {
    wrappingNodes[i + 1].appendChild(wrappingNodes[i]);
  }

  // Return the highest level wrapped parent node aka the last element
  return wrappingNodes[wrappingNodes.length - 1];
};

/**
 * @returns A new Fragement with all hardBreak nodes replaced by paragraph nodes
 * c/o https://discuss.prosemirror.net/t/best-way-to-replace-slice-mutation/4970/3
 */
export function hardBreaksToParagraphsFragment(fragment: Fragment, view: EditorView): Fragment {
  const newNodes: Node[] = [];
  let isPreviousHardBreak = false;
  fragment.forEach((node) => {
    if (isHardBreakNode(node)) {
      if (isPreviousHardBreak) {
        // skip this node, to collapse 2 hard breaks into 1 paragraph, but also
        // clear the check, so we don't collapse 3+ hard breaks into 1 paragraph
        isPreviousHardBreak = false;
      } else {
        // replace hard break with a paragraph
        newNodes.push(view.state.schema.nodes.paragraph.create());
        isPreviousHardBreak = true;
      }
    } else {
      newNodes.push(node);
    }
  });
  return Fragment.fromArray(newNodes);
}

function isHardBreakNode(node: Node): boolean {
  return node.type.name === 'hardBreak';
}

// TODO: unit test
const prepareMarkdownPipeline = compose(
  convertMentionsToLinks,
  convertNewlinesToHardBreaks,
  escapeAmpersands
);

// TODO: unit test
const modifyJsonPipeline = compose(
  convertMentionLinksToMentions,
  convertHardBreakParagraphsToHardBreaks
);

/**
 * This function will try to trigger autolink for URL like text on current line.
 *
 * Auto link only works if a space or paragraph is added after the text, but if
 * users hit enter and send the message autolink won't work. This is because the
 * editor's default action of creating a new paragraph upon pressing enter is disabled
 * when sending a message. This function will help it.
 *
 * Related SIM: https://i.amazon.com/issues/Wickr-2373
 *
 * Drawbacks
 *   1. May trigger some other side effects which depend on newly added space character,
 *      can't think of any for now but just in case.
 *   2. Only work for current line, URL like texts on other lines will remain unchanged.
 *
 * FIXME: Proposed solution
 *   1. Always autolink URL like text on typing or pasting, doesn't require an extra space or
 *      paragraph at the end.
 *   2. Allow users to un-link text block, once block is un-unlinked, autolink will be
 *      disabled for that block.
 *
 * This will solve all the drawbacks but requires more effort and need to discuss with product first.
 */
export function triggerAutoLink(editor: Editor) {
  const { state } = editor;
  const { $from } = state.selection;

  // find the end of the current block
  const endPos = $from.end();
  // move cursor to the end of current block
  editor.commands.setTextSelection(endPos);
  // trigger autolink by adding an extra space
  editor.commands.insertText(' ');
  // remove the added space
  editor.commands.deleteRange({ from: endPos, to: endPos + 1 });
}

/**
 * Given a markdown string, returns just the plain text
 * @param markdownInput any string that contains markdown formatting
 * @param extensions Optional list of extensions, such as different versions of Mention for render/compose
 * @returns plain text string
 */
export const markdownToPlainText = (markdownInput: string): string => {
  const editor = getEditorWithMarkdownContent(markdownInput);
  return editor.getText();
};

/**
 * Convert links to their text value if the text is a valid URL that does not match the link href.
 * This only works on fully-qualified URLs.
 * @example
 * Text: http://www.example.com
 * Link: http://www.example.com/path (e.g., because you typed /path and then backspace)
 * Output url: http://www.example.com
 * @returns The input jsonContent is modified and returned
 */
export function fixMismatchingLinkTextUrls(jsonContent: JSONContent) {
  const contentLength = jsonContent.content?.length ?? 0;
  for (let nodeIndex = 0; nodeIndex < contentLength; nodeIndex++) {
    const node = jsonContent.content?.[nodeIndex];

    if (!node) continue;

    if (node.type === 'text' && node.marks) {
      const link = node.marks.find((mark) => mark.type === 'link');
      if (link && node.text && link.attrs?.href && node.text !== link.attrs.href) {
        try {
          const textUrl = new URL(node.text).toString();
          if (textUrl) {
            link.attrs.href = textUrl;
          }
        } catch {
          // new URL() will throw if node.text is not a URL, which is a case we ignore
        }
      }
    } else {
      fixMismatchingLinkTextUrls(node);
    }
  }
  return jsonContent;
}

Object.assign(globalThis, { normalizeUrlLinks: fixMismatchingLinkTextUrls });
