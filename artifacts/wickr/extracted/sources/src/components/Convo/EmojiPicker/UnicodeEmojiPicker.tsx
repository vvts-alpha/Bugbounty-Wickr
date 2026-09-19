import { withRetry } from '@amzn/async-utils';
import Picker from '@emoji-mart/react';
import React, { useEffect, useRef, useState } from 'react';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import useEventListener from '@/hooks/useEventListener';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { updateRecentEmojis } from '@/store/thunks/settings';
import { asHtmlElement } from '@/utils/dom';
import { getEmojiPickerData } from '@/utils/emoji/emojiDetails';
import { Emoji } from './EmojiPopper';

export interface UnicodeEmojiPickerProps {
  onFocusOut?: (event: FocusEvent) => void;
  onSelect?: (emoji: Emoji, emojiSystemType: string) => void;
}

const UnicodeEmojiPicker: React.FC<UnicodeEmojiPickerProps> = ({ onFocusOut, onSelect }) => {
  const pickerRef = useRef<HTMLDivElement>(null);
  const { t } = useAppTranslation();
  const theme = useSetting('theme');

  const dispatch = useAppDispatch();

  // Pressing Esc triggers focusout, so we can use this instad of tracking the input
  useEventListener(onFocusOut ? pickerRef : undefined, 'focusout', (e) => onFocusOut?.(e));

  // Since emoji-mart is a web component, its children are not all ready on React mount
  // and we need to lookup the nav a couple times, and we store it here
  const [nav, setNav] = useState<HTMLElement | null>();

  // Find nav element
  useAsyncEffect(async ({ signal }) => {
    const findNavRetry = withRetry(
      async () => {
        const el = asHtmlElement(
          pickerRef.current?.querySelector('em-emoji-picker')?.shadowRoot?.querySelector('#nav')
        );
        if (!el) throw new Error('Nav not found');
        return el;
      },
      {
        // In testing, #nav was found on the 2nd attempt, but we give it more attempts to be safe
        attempts: 5,
        retryDelay: 50,
        signal,
      }
    );
    // If the element is not found, an error is thrown, so we catch to ignore it
    const el = await findNavRetry().catch(() => undefined);
    setNav(el);
  }, []);

  useEffect(() => {
    if (!nav) return;

    const updateButtonLabel = (btn: HTMLElement, selected: boolean) => {
      if (selected) {
        btn.setAttribute('aria-label', `${btn.title}, ${t('selected')}`);
      } else {
        btn.setAttribute('aria-label', btn.title);
      }
    };

    // the first button is the recent emoji button, and it is missing title/aria-label
    const recentEmojisButton = nav.querySelector('button');
    if (recentEmojisButton) {
      recentEmojisButton.setAttribute('title', t('EmojiPicker.Recent'));
      updateButtonLabel(recentEmojisButton, true);
    }

    // The selected button changes as you scroll through the list,
    // so we need to observe mutations to update the labels and not
    // just depend on the click event.
    const observer = new MutationObserver((list) => {
      for (const mutation of list) {
        const btn = asHtmlElement(mutation.target);
        if (
          btn?.localName === 'button' &&
          mutation.type === 'attributes' &&
          mutation.attributeName === 'aria-selected'
        ) {
          updateButtonLabel(btn, btn.ariaSelected === 'true');
        }
      }
    });

    observer.observe(nav, {
      attributes: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [nav]);

  const handleOnEmojiClick = (emoji: Emoji) => {
    if (emoji) {
      dispatch(updateRecentEmojis());
      onSelect?.(emoji, 'UNICODE_EMOJI_SYSTEM');
    }
  };

  const getI18nText = () => {
    return {
      search: t('EmojiPicker.Search'),
      clear: t('EmojiPicker.Clear'),
      notfound: t('EmojiPicker.NotFound'),
      skintext: t('EmojiPicker.SkinTone'),
      categories: {
        search: t('EmojiPicker.Search'),
        recent: t('EmojiPicker.Recent'),
        people: t('EmojiPicker.People'),
        nature: t('EmojiPicker.Nature'),
        foods: t('EmojiPicker.Foods'),
        activity: t('EmojiPicker.Activity'),
        places: t('EmojiPicker.Places'),
        objects: t('EmojiPicker.Objects'),
        symbols: t('EmojiPicker.Symbols'),
        flags: t('EmojiPicker.Flags'),
        custom: t('EmojiPicker.Custom'),
      },
      categorieslabel: t('EmojiPicker.Categories'),
      skintones: {
        1: t('EmojiPicker.Default'),
        2: t('EmojiPicker.Light'),
        3: t('EmojiPicker.MediumLight'),
        4: t('EmojiPicker.Medium'),
        5: t('EmojiPicker.MediumDark'),
        6: t('EmojiPicker.Dark'),
      },
      skins: {
        choose: t('EmojiPicker.Choose'),
      },
    };
  };

  return (
    <div className="unicode-emoji-picker" ref={pickerRef} data-test-id="Picker">
      <Picker
        data={getEmojiPickerData()}
        autoFocus={true}
        set="twitter"
        previewEmoji="point_up"
        getSpritesheetURL={() => '/imgs/twemoji/spritesheet-64.png'}
        onEmojiSelect={handleOnEmojiClick}
        i18n={getI18nText()}
        theme={theme === 'dark-theme' ? 'dark' : 'light'}
      />
    </div>
  );
};

export default UnicodeEmojiPicker;
