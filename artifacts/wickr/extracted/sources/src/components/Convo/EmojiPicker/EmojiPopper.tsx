import { clsx } from 'clsx';
import { useState, useEffect, useRef, memo, Ref, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { usePopper } from 'react-popper';
import { v4 } from 'uuid';
import { AddReactionIcon, IconButton, List, Tooltip } from '../../../componentlibrary';
import { Placement } from '@/componentlibrary/PopOver/PopOver';
import { KEY_CODES } from '@/componentlibrary/constants';
import { useFloatingContent } from '@/components/FloatingContentContainers';
import useEventListener from '@/hooks/useEventListener';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppTranslation } from '@/lib/i18n';
import { asHtmlElement } from '@/utils/dom';
import QuickSelectMenu from './QuickSelectMenu';
import UnicodeEmojiPicker from './UnicodeEmojiPicker';

import styles from './EmojiPicker.module.less';

export interface Emoji {
  aliases?: string[];
  id: string;
  keywords: string[];
  name: string;
  native?: string;
  shortcodes: string;
  skin?: number;
  unified: string;
  emoticons?: string | string[];
}

export interface EmojiPopperProps {
  onEmojiSelection: (emoji: Emoji, emojiSystemType: string) => void;
  buttonIcon?: JSX.Element;
  useQuickSelect?: boolean;
  tooltip?: string;
  offset?: [number, number];
  triggerButton?: JSX.Element;
  disabled?: boolean;
  placement?: Placement;
  buttonClassName?: string;
  buttonWrapperClassName?: string;
}

export interface EmojiPopperRef {
  /** Manually toggle emoji popper */
  toggle: () => void;
}

export const EmojiPopper = forwardRef<EmojiPopperRef, EmojiPopperProps>(
  (
    {
      onEmojiSelection,
      offset,
      disabled,
      placement = 'top-start',
      buttonIcon,
      tooltip,
      useQuickSelect = true,
      buttonClassName,
      buttonWrapperClassName,
    },
    ref
  ) => {
    const [quickSelectIsOpen, setQuickSelectIsOpen] = useState(false);
    const [pickerMenuIsOpen, setPickerMenuIsOpen] = useState(false);
    const [referenceEl, setReferenceEl] = useState<HTMLButtonElement | null>(null);
    const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
    const [quickSelectMenu, setQuickSelectMenu] = useState<HTMLElement | null>(null);
    const [btnIsHovered, setBtnIsHovered] = useState(false);

    const [pickerMenuEl, setPickerMenuEl] = useState<HTMLElement | null>(null);
    const { t } = useAppTranslation();
    const { getPopOverContainer, didUpdateFloatingContent } = useFloatingContent();
    const containerEl = getPopOverContainer(referenceEl?.ownerDocument);
    const { styles: quickSelectStyles, attributes: quickSelectAttributes } = usePopper(
      referenceEl,
      quickSelectMenu,
      {
        placement: 'top-start',
        modifiers: [{ name: 'offset', options: { offset: [-100, 0] } }],
      }
    );
    const { styles: pickerStyles, attributes: pickerAttributes } = usePopper(
      referenceEl,
      pickerMenuEl,
      {
        placement: 'right-start',
        modifiers: [{ name: 'offset', options: { offset: offset } }],
      }
    );

    // useLatestCallback because it is called by IntersectionObserver
    const closeAll = useLatestCallback(() => {
      setQuickSelectIsOpen(false);
      setPickerMenuIsOpen(false);
      triggerBtnRef.current?.focus();
    });

    const handleFocusOut = (e: FocusEvent) => {
      if (e.relatedTarget !== triggerBtnRef.current) closeAll();
    };

    // create a unique id for each reaction button
    const id = useRef('a' + v4());

    useEventListener(document, 'click', (e) => {
      if ((!quickSelectIsOpen && !pickerMenuIsOpen) || (!quickSelectMenu && !pickerMenuEl)) {
        return;
      }

      const target = asHtmlElement(e.target);
      if (!target) return;

      const btn = target.closest('button');
      if (btn?.id === id.current) {
        return;
      }

      const menuEl = quickSelectIsOpen ? quickSelectMenu : pickerMenuEl;

      // click outside the open menu
      if (!menuEl?.contains(target)) {
        closeAll();
      }
    });

    useEventListener(document, 'keydown', (e) => {
      if (!quickSelectIsOpen && !pickerMenuIsOpen) {
        return;
      }
      if (e.key === KEY_CODES.ESCAPE) {
        closeAll();
      }
    });

    useEffect(() => {
      didUpdateFloatingContent(referenceEl?.ownerDocument);
      return () => didUpdateFloatingContent(referenceEl?.ownerDocument);
    }, [quickSelectIsOpen, pickerMenuIsOpen, referenceEl, didUpdateFloatingContent]);

    // This effect is to support for closing popover when it's out of view.
    // Only support it if intersection observer is defined.
    useEffect(() => {
      if (!referenceEl) return;
      if (!quickSelectIsOpen && !pickerMenuIsOpen) {
        return;
      }
      const observer = new IntersectionObserver((entries) => {
        const isVisible = entries[0].isIntersecting;
        if (!isVisible) {
          closeAll();
        }
      });
      observer.observe(referenceEl);
      return () => {
        observer.disconnect();
      };
    }, [quickSelectIsOpen, pickerMenuIsOpen, referenceEl]);

    useImperativeHandle(ref, () => ({
      toggle: () => {
        toggleMenu();
      },
    }));

    const handleEmojiClick = (emoji: Emoji, emojiSystemType: string) => {
      onEmojiSelection(emoji, emojiSystemType);
      closeAll();
    };

    const toggleMenu = () => {
      if (pickerMenuIsOpen) {
        return closeAll();
      }

      if (useQuickSelect) {
        setQuickSelectIsOpen(!quickSelectIsOpen);
      } else {
        setPickerMenuIsOpen(!pickerMenuIsOpen);
      }
    };

    const handleShowMoreReactions = (e: Event) => {
      setQuickSelectIsOpen(false);
      setPickerMenuIsOpen(true);
      e.stopPropagation();
    };

    const EmojiQuickSelect = quickSelectIsOpen ? (
      <QuickSelectMenu
        ref={setQuickSelectMenu}
        onEmojiClick={handleEmojiClick}
        onMoreReactionsClick={handleShowMoreReactions}
        style={quickSelectStyles.popper}
        attributes={quickSelectAttributes.popper}
      />
    ) : null;

    const EmojiPickerMenu = pickerMenuIsOpen ? (
      <List
        ref={setPickerMenuEl}
        data-testid="menu"
        role="dialog"
        data-placement={placement}
        className={clsx(styles.emojiPickerMenu, 'popoverMenu')}
        style={pickerStyles.popper}
        {...pickerAttributes.popper}
      >
        <UnicodeEmojiPicker onSelect={handleEmojiClick} onFocusOut={handleFocusOut} />
      </List>
    ) : null;

    const pickEmojiLabel = tooltip ?? t('Conversations.React');

    return (
      <>
        <span
          ref={setReferenceEl as Ref<HTMLButtonElement>}
          className={clsx({ [styles.emojiBtnWrapper]: useQuickSelect })}
        >
          <Tooltip tip={pickEmojiLabel} closeOnTriggerClick>
            <IconButton
              ref={triggerBtnRef}
              aria-haspopup
              label={pickEmojiLabel}
              testid="emojiPopperIconButton"
              aria-expanded={quickSelectIsOpen || pickerMenuIsOpen}
              onClick={toggleMenu}
              aria-disabled={disabled}
              id={id.current}
              onMouseEnter={() => setBtnIsHovered(true)}
              onMouseLeave={() => setBtnIsHovered(false)}
              className={buttonClassName}
              wrapperClassName={buttonWrapperClassName}
            >
              {buttonIcon ?? <AddReactionIcon filled={btnIsHovered} />}
            </IconButton>
          </Tooltip>
        </span>
        {containerEl && createPortal(EmojiQuickSelect, containerEl)}
        {containerEl && createPortal(EmojiPickerMenu, containerEl)}
      </>
    );
  }
);

if (__DEV__) EmojiPopper.displayName = 'EmojiPopper';

export default memo(EmojiPopper);
