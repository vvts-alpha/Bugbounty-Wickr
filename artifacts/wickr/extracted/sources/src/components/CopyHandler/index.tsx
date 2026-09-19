import React, { useEffect } from 'react';
import useEventListener from '@/hooks/useEventListener';
import { Logger } from '@/lib/logger';
import { useAppDispatch } from '@/store';
import { pushCopyToast } from '@/store/thunks/toasts';
import { asHtmlElement } from '@/utils/dom';
import { spyOnClipboardWrite } from './clipboardSpy';
import { copyTextSelection } from './copyTextSelection';

export const logger = new Logger('CopyHandler');

// Selector used to remove nodes like metadata or other non selectable content.
// There is currently a bug in chromium v115 w/ user-select: 'none'
// https://bugs.chromium.org/p/chromium/issues/detail?id=1399317
export const notSelectableNodesSelector = '.notSelectable,.notCopyable';
// Grab the prepended text used to format chat messages w/ timestamp and sender name
export const prependedTextAttribute = 'data-prepended-text';

export const CopyHandler: React.FC = () => {
  const dispatch = useAppDispatch();

  useEventListener(document, 'copy', (event) => {
    const target = asHtmlElement(event.target);

    if (!target) return;

    // ProseMirror handles copying internally, which calls preventDefault() when text is copied.
    // If nothing is copied, ProseMirror does not call preventDefault()
    const isProseMirrorCopy = event.defaultPrevented && target.closest('.ProseMirror');

    if (!event.defaultPrevented || isProseMirrorCopy) {
      if (target.closest('[contenteditable=true], input, textarea')) {
        const inputTarget = target as HTMLInputElement | HTMLTextAreaElement;
        const windowSelection = window.getSelection();
        const hasSelection =
          windowSelection?.isCollapsed === false ||
          inputTarget.selectionStart !== inputTarget.selectionEnd;

        if (hasSelection) {
          dispatch(pushCopyToast(true));
        }
      } else {
        // We do it on messages to take out unselectable data
        copyTextSelection();
        event.preventDefault();
      }
    }
  });

  // Push copy toasts for programmatic clipboard writing
  useEffect(() => {
    const restore = spyOnClipboardWrite(({ error }) => {
      dispatch(pushCopyToast(!error));
    });
    return restore;
  }, []);

  return null;
};
