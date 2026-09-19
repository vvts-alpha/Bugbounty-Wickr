import twemojiData from '@emoji-mart/data/sets/14/twitter.json';
import { Logger } from '@/lib/logger';
import allEmoji from './allEmoji.json';

export interface EmojiDetail {
  emoji: string;
  codepoints: string[];
  codepointFormatted: string;
  shortcode: string | null;
  categories: string[] | null;
}

interface EmojiDetails {
  categories: string[];
  data: EmojiDetail[];
  twemoji: string;
}

export const AllEmojiDetails: EmojiDetails = allEmoji;

interface EmojiPickerData {
  categories: {
    id: string;
    emojis: string[];
  }[];
  emojis: {
    [key: string]: EmojiPickerDataEmoji;
  };
  aliases: {
    [key: string]: string;
  };
  sheet: {
    cols: number;
    rows: number;
  };
}

interface EmojiPickerDataEmoji {
  id: string;
  name: string;
  keywords: string[];
  skins?: {
    unified: string;
    native: string;
    x: number;
    y: number;
  }[];
  version: number;
}

let cachedEmojiPickerData: EmojiPickerData | undefined;

export function getEmojiPickerData(): EmojiPickerData {
  if (!cachedEmojiPickerData) {
    const startTime = Date.now();
    const twemojiDataTyped = twemojiData as EmojiPickerData;

    const emojiPickerData: EmojiPickerData = {
      categories: AllEmojiDetails.categories.map((c) => ({
        id: c,
        emojis: [],
      })),
      emojis: {},
      aliases: twemojiDataTyped.aliases,
      sheet: twemojiDataTyped.sheet,
    };

    const skinToneCodes = ['1f3fb', '1f3fc', '1f3fd', '1f3fe', '1f3ff'];
    const isNotSkinToneEmoji = (emoji: EmojiDetail) =>
      !skinToneCodes.filter((skinTone) => emoji.codepointFormatted.includes(skinTone)).length;

    // Emojis that appear in allEmoji.json but do not appear in twemoji (twitter.json)
    const unsupportedEmojis: EmojiDetail[] = [];

    AllEmojiDetails.data.filter(isNotSkinToneEmoji).forEach((emoji) => {
      let cleanedShortcode = emoji.shortcode?.replace(/:/gm, '') ?? '';

      const tweData: EmojiPickerDataEmoji | undefined =
        // Find by shortcode key first
        twemojiDataTyped.emojis[cleanedShortcode] ??
        // If no match, find by codepoint (minus the variant selector, since it varies between emoji sets)
        Object.values(twemojiDataTyped.emojis).find((e) =>
          e.skins
            ?.map((s) => s.unified.replace(/-fe0f-{0,1}/, ''))
            .includes(emoji.codepointFormatted.replace(/-fe0f-{0,1}/, ''))
        );

      if (!tweData) {
        unsupportedEmojis.push(emoji);
        return;
      }

      cleanedShortcode = tweData?.id;

      // Add emoji to category lists
      const categories = emoji.categories ?? [];

      // If no category was given in allEmoji.json, add categories from twemoji data
      if (categories.length === 0) {
        for (const category of twemojiDataTyped.categories) {
          if (category.emojis.includes(cleanedShortcode)) {
            categories.push(category.id);
          }
        }
      }

      for (const category of categories) {
        const categoryList = emojiPickerData.categories.find((c) => c.id === category);
        categoryList?.emojis?.push(cleanedShortcode);
      }

      const tweSkins = tweData?.skins ?? [];
      // Use Twemoji skins list if it has multiple AND our emoji list has multiple
      const skins =
        tweSkins.length > 1
          ? tweSkins
          : [
              {
                native: emoji.emoji,
                x: tweSkins[0].x ?? 0,
                y: tweSkins[0].y ?? 0,
                unified: emoji.codepointFormatted,
              },
            ];

      // Add emoji to full list of emojis
      emojiPickerData.emojis[cleanedShortcode] = {
        id: cleanedShortcode,
        name: tweData?.name ?? cleanedShortcode,
        keywords: tweData?.keywords ?? [],
        version: tweData?.version ?? 1,
        skins,
      };
    });

    if (__DEV__) {
      if (unsupportedEmojis.length > 0) {
        new Logger('EmojiDetails').info(
          `Populated emojiPickerData in ${Date.now() - startTime}ms.`,
          `Found ${unsupportedEmojis.length} of ${AllEmojiDetails.data.length} unsupported emoji picker emojis:`,
          unsupportedEmojis
        );
      }
    }

    cachedEmojiPickerData = emojiPickerData;
  }

  return cachedEmojiPickerData;
}

/**
 * Given an emoji codepoint, returns the supported codepoint
 * version of it. Example:
 * ☝️: 261d-fe0f
 * This emoji includes the default variant selector (fe0f), but
 * it isn't necessary for this emoji. Using the codepoint 261d
 * produces the exact same emoji. The images for Twemoji that
 * we use don't support the variant selector on basic emojis,
 * which are usually single-codepoint ones (ignoring the skin/variant).
 * In this case, 261d.png exists, but 261d-fe0f.png does not exist.
 *
 * @param codepoint An emoji codepoint, such as 261d-fe0f
 * @returns A modified codepoint representing the emoji and supported
 * by twemoji images
 */
export const getSupportedCodepoint = (codepoint: string): string => {
  if (codepoint.endsWith('-fe0f') && codepoint.split('-').length === 2) {
    return codepoint.replace(/-fe0f$/, '');
  }
  return codepoint;
};
