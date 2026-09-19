import { clsx } from 'clsx';
import { forwardRef, HTMLAttributes, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import twemoji from 'twemoji';
import useForwardedRef from '@/hooks/useForwardedRef';
import { Logger } from '@/lib/logger';

import styles from './Emojify.module.less';

const logger = new Logger('Emojify');

type EmojifyProps = React.PropsWithChildren<{}> &
  HTMLAttributes<HTMLDivElement> & {
    onWillCloneChildren?: () => void;
    onDidCloneChildren?: () => void;
  };

/**
 * This component should not be used on user-editable tiptap instances
 * (headless or not), otherwise the state will be overridden and the
 * user won't be able to type emojis. To have proper emoji support on
 * user-editable tiptap instances, use the EmojiReplacer extension.
 */
export const Emojify = forwardRef<HTMLDivElement, EmojifyProps>(
  ({ children, className, onWillCloneChildren, onDidCloneChildren, ...props }, ref) => {
    // twemoji and React "fight" with each other, which can result in DOM errors.
    // To prevent them working on the same DOM, we do the following:
    //
    // 1) Render the actual children into a portal DIV that is not added to the DOM
    // 2) Clone the portal DIV
    // 3) twemoji.parse the cloned DIV
    // 4) Move contents of cloned DIV into the target DIV

    // Contains parsed twemoji-content
    const targetDivRef = useForwardedRef(ref);
    // Contains original React-controlled content
    const portalDivRef = useRef<HTMLDivElement>();
    portalDivRef.current ??= document.createElement('div');

    // two reasons to use useLayoutEffect here
    //   1. we are munating DOM here, which should happen before browser starts painting
    //      otherwise users could see flickers
    useLayoutEffect(() => {
      const targetDiv = targetDivRef.current;
      const portalDiv = portalDivRef.current;
      if (!targetDiv || !portalDiv) {
        return;
      }

      // Temporary node to parse against
      const clonedDiv = portalDiv.cloneNode(true) as HTMLDivElement;
      try {
        twemoji.parse(clonedDiv, {
          base: '/imgs/twemoji/',
        });
        onWillCloneChildren?.();
        targetDiv.replaceChildren(...clonedDiv.childNodes);
        onDidCloneChildren?.();
      } catch (err) {
        logger.error('twemoji.parse:', err);
      }
    }, [children]);

    return (
      <>
        <div {...props} className={clsx(className, styles.emojify)} ref={targetDivRef} />
        {createPortal(children, portalDivRef.current)}
      </>
    );
  }
);

if (__DEV__) Emojify.displayName = 'Emojify';
