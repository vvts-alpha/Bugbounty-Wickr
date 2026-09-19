import { clsx } from 'clsx';
import { useEffect, forwardRef } from 'react';
import { AddIcon, IconButton, List, SpinnerIcon, Tooltip } from '../../../componentlibrary';
import { useCurrentMessageSharedState } from '../ConvoMessage/CurrentMessageContext';

import { KEY_CODES } from '@/componentlibrary/constants';
import trapFocus from '@/componentlibrary/utils/trap-focus';
import { Emojify } from '@/components/Emojify';
import useEventListener from '@/hooks/useEventListener';
import useForwardedRef from '@/hooks/useForwardedRef';
import { useAppTranslation } from '@/lib/i18n';
import { focusPreferredElement } from '@/utils/dom';
import { Emoji } from './EmojiPopper';

import styles from './EmojiPicker.module.less';

const likeEmoji: Emoji = {
  aliases: ['thumbsup'],
  id: '+1',
  keywords: ['+1', 'thumbsup', 'yes', 'awesome', 'good', 'agree', 'accept', 'cool', 'hand', 'like'],
  name: 'Thumbs Up',
  native: '👍',
  shortcodes: ':+1:',
  skin: 1,
  unified: '1f44d',
};

const heartEmoji: Emoji = {
  emoticons: '<3',
  id: 'heart',
  keywords: ['love', 'like', 'valentines'],
  name: 'Red Heart',
  native: '❤',
  shortcodes: ':heart:',
  unified: '2764',
};

const thankYouEmoji: Emoji = {
  id: 'pray',
  keywords: ['pray', 'please', 'hope', 'wish', 'namaste', 'highfive', 'high', 'five'],
  name: 'Folded Hands',
  native: '🙏',
  shortcodes: ':pray:',
  skin: 1,
  unified: '1f64f',
};

const joyEmoji: Emoji = {
  id: 'joy',
  keywords: ['cry', 'weep', 'happy', 'happytears', 'haha'],
  name: 'Face with Tears of Joy',
  native: '😂',
  shortcodes: ':joy:',
  unified: '1f602',
};

const sadEmoji: Emoji = {
  emoticons: [":'("],
  id: 'cry',
  keywords: ['cry', 'tears', 'sad', 'depressed', 'upset', ":'("],
  name: 'Crying Face',
  native: '😢',
  shortcodes: ':cry:',
  unified: '1f622',
};

export interface QuickSelectMenuProps {
  style: any;
  attributes: any;
  onEmojiClick: (emoji: Emoji, emojiSytemType: string) => void;
  onMoreReactionsClick: (e: any) => void;
}

const quickSelectEmojis = [likeEmoji, heartEmoji, thankYouEmoji, joyEmoji, sadEmoji];

export const QuickSelectMenu = forwardRef<HTMLElement, QuickSelectMenuProps>(
  ({ style, attributes, onEmojiClick, onMoreReactionsClick }, ref) => {
    const { t } = useAppTranslation();
    const [{ reactionsLoading }] = useCurrentMessageSharedState();

    const menuRef = useForwardedRef(ref);

    useEffect(() => {
      focusPreferredElement(menuRef.current);
    }, []);

    useEventListener(document, 'keydown', (e) => {
      if (e.key === KEY_CODES.TAB && menuRef.current) {
        trapFocus(e, menuRef.current);
      }
    });

    return (
      <List
        ref={menuRef}
        data-testid="menu"
        className={clsx(styles.quickSelectEmojiMenu, 'popoverMenu')}
        style={style}
        {...attributes}
      >
        {quickSelectEmojis.map((e) => {
          const isLoading = !!reactionsLoading[e.native ?? ''];
          return (
            <Tooltip tip={isLoading ? t('Loading') : ''} key={e.native}>
              <IconButton
                label={e.native ?? ''}
                className={styles.quickSelectEmojiBtn}
                aria-disabled={isLoading}
                onClick={() => {
                  if (isLoading) return;
                  onEmojiClick(e, 'UNICODE_EMOJI_SYSTEM');
                }}
              >
                {isLoading ? <SpinnerIcon /> : <Emojify>{e.native}</Emojify>}
              </IconButton>
            </Tooltip>
          );
        })}
        <Tooltip tip={t('Conversations.MoreReactions')} className={styles.moreReactionsTooltip}>
          <IconButton
            onClick={onMoreReactionsClick}
            className={clsx(styles.quickSelectEmojiBtn, styles.quickSelectEmojiBtnAdd)}
            label={t('Conversations.MoreReactions')}
          >
            <AddIcon size="20px" />
          </IconButton>
        </Tooltip>
      </List>
    );
  }
);

export default QuickSelectMenu;
