import { convertEmojiImgsToUnicode } from '@/utils/emoji/emojiHelpers';
import { copyTextToClipboard } from '@/utils/strings';
import { preserveSelectionContentFormat } from '@/utils/tiptap/markdown';
import { notSelectableNodesSelector, prependedTextAttribute, logger } from '.';

export function copyTextSelection(): Promise<boolean> {
  // tracks success for returning
  let copySuccessfulPromise = Promise.resolve(false);
  let tempEl: HTMLDivElement | undefined;

  try {
    const selection = window.getSelection();

    if (!selection || selection?.rangeCount === 0 || selection?.isCollapsed) {
      return copySuccessfulPromise;
    }

    const rangeContents = preserveSelectionContentFormat(selection);

    tempEl = convertEmojiImgsToUnicode(rangeContents);

    // Trim DOM elements whose texts shouldn't be copied
    const removableNodes = tempEl.querySelectorAll(notSelectableNodesSelector);
    removableNodes.forEach((node) => node.remove());

    // Grab selectable & prepended text for formatting copied messages
    const selectableText = tempEl.textContent;
    // Get the node that has the desired prepended text attribute
    const prependTextNode = tempEl.hasAttribute(prependedTextAttribute)
      ? tempEl
      : tempEl.querySelector(`[${prependedTextAttribute}]`);
    const prependedText = prependTextNode?.getAttribute(prependedTextAttribute);

    let copiedText = tempEl.textContent ?? '';
    let copiedHtml = tempEl.outerHTML;

    // Handle copying inputs and other form fields if no other text content is present.
    if (!copiedText) {
      // If copied text is empty, grab all child nodes with value attribute.
      // This can be in forms w/ eles that have value attr instead of text content.
      const nodesWithValue = tempEl.querySelectorAll('[value]');
      nodesWithValue.forEach((n) => {
        const val = n.getAttribute('value');
        copiedText += `${val}\n`;
        copiedHtml += `<p>${val}</p>`;
      });
    }

    // After all text has been found, apply the prepended text to the copied text
    if (selectableText && prependedText) {
      copiedText = `${prependedText}\n${copiedText}`;
      copiedHtml = `<p>${prependedText}</p>${copiedHtml}`;
    }

    if (copiedText) {
      copySuccessfulPromise = copyTextToClipboard(copiedText, copiedHtml);
    } else {
      // If copied text is still empty, there is an underlying issue.
      // Log here so that we know copied text is not being set.
      logger.warn('no copiedText found in the selected element range.');
    }
  } finally {
    tempEl?.remove();
  }

  return copySuccessfulPromise;
}
