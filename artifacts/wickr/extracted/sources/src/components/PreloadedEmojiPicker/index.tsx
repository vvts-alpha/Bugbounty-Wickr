import { FC, useState, useEffect } from 'react';
import { preloadFindEmojis } from '../ComposeBox/Extensions/EmojiReplacer/EmojiReplacer';
import UnicodeEmojiPicker from '../Convo/EmojiPicker/UnicodeEmojiPicker';
import { useAppStorage } from '@/lib/storage/AppStorageProvider';
import { getEmojiPickerData } from '@/utils/emoji/emojiDetails';

import styles from './PreloadedEmojiPicker.module.less';

/**
 * EmojiMart uses localStorage to keep track of frequently used emojis.
 * Since our localStorage is reset during restart, we keep it in storage.
 * EmojiMart only reads from localStorage the first time, so we need to
 * hydrate localStorage before EmojiMart is first used.
 */
export const EMOJI_MART_LOCAL_STORAGE_KEY = 'emoji-mart.frequently';

/**
 * This component will render the UnicodeEmojiPicker to preload the data for faster initial load time.
 * therefore initing the correct data but hide the picker and remove it completely after 1 second.
 */
export const PreloadedEmojiPicker: FC = () => {
  const [shouldRender, setShouldRender] = useState(false);
  const storage = useAppStorage();

  useEffect(() => {
    // copy over emoji data to localStorage before first use
    // so common emojis the user used previously will show at the top
    storage.get('EmojiMartFrequentlyUsed').then((prevEmojis) => {
      if (prevEmojis) {
        localStorage.setItem(EMOJI_MART_LOCAL_STORAGE_KEY, prevEmojis);
      }
      setShouldRender(true);
    });

    // make findEmojis faster on first run
    requestIdleCallback(preloadFindEmojis);
    // It can take 200+ms to generate the data, so do it in the background when idle
    requestIdleCallback(getEmojiPickerData);
  }, []);

  useEffect(() => {
    if (!shouldRender) return;
    const renderTimeout = setTimeout(() => setShouldRender(false), 1000);
    return () => clearTimeout(renderTimeout);
  }, [shouldRender]);

  if (shouldRender) {
    return (
      <div className={styles.hidden} aria-hidden={true}>
        <UnicodeEmojiPicker />
      </div>
    );
  } else {
    return null;
  }
};

export default PreloadedEmojiPicker;
