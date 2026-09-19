import { SearchIndex } from 'emoji-mart';
import Fuse from 'fuse.js';
import memoize from 'lodash/memoize';
import { EmojiDetail, AllEmojiDetails } from './emojiDetails';

const MAX_RESULTS_TO_SHOW = 50;
const MIN_CHARACTERS_TO_SEARCH = 2;

export interface IEmojiModel {
  emoji: string;
  shortcode: string;
}

const emojiDetailToEmojiModel = (detail: EmojiDetail): IEmojiModel => ({
  emoji: detail.emoji,
  shortcode: detail.shortcode ?? '',
});

// Use memoize for lazy init
const getOrCreateFuse = memoize(
  () =>
    new Fuse(
      // Not all of the newer emojis have non-null shortcodes in AllEmojiDetails,
      // such as the melting emoji, so filter them out
      AllEmojiDetails.data.filter((em) => !!em.shortcode).map(emojiDetailToEmojiModel),
      {
        keys: ['shortcode'],
        isCaseSensitive: false,
        minMatchCharLength: MIN_CHARACTERS_TO_SEARCH,
        threshold: 0.2,
        sortFn: (a, b) => {
          // Sort by score first, but if they have the same score, sort by shortest.
          // That was we can ensure exact matches are first. So when you search
          // ":smile" you will get ":smile:" first, not ":smiley:"
          if (a.score === b.score) {
            const aLength = (a.item[0] as any)?.v?.length;
            const bLength = (b.item[0] as any)?.v?.length;
            if (isNaN(aLength) || isNaN(bLength)) return 0;

            return aLength - bLength;
          }
          return a.score - b.score;
        },
      }
    )
);

const getUserSkinTone = (): number => {
  let skinTone = 1; // Default skin tone
  const emojiMartSkin = localStorage.getItem('emoji-mart.skin');
  if (emojiMartSkin) {
    skinTone = Number(emojiMartSkin);
  }
  if (isNaN(skinTone)) {
    skinTone = 1;
  }
  // emoji-mart uses 0-based indexing for skins array
  return skinTone - 1;
};

export const queryEmojiSuggestions =
  (useEmojiMart: boolean) =>
  async (props: { query: string }): Promise<IEmojiModel[]> => {
    if (props.query.length < MIN_CHARACTERS_TO_SEARCH) {
      return [];
    }

    if (useEmojiMart) {
      // emoji-mart data gets initialized by PreloadedEmojiPicker
      const emojis = await SearchIndex.search(props.query);
      return emojis.slice(0, MAX_RESULTS_TO_SHOW).map((emoji: any) => ({
        emoji: emoji.skins[getUserSkinTone()]?.native || emoji.skins[0]?.native,
        shortcode: `:${emoji.id}:`,
      }));
    }
    const results = getOrCreateFuse().search(props.query);
    return results.slice(0, MAX_RESULTS_TO_SHOW).map((v) => v.item);
  };
