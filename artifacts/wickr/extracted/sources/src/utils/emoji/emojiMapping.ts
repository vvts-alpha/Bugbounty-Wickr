export interface ShorthandToUnicodeEmojiMap {
  [shorthandEmoji: string]: string;
}

export const shorthandToUnicodeEmoji: ShorthandToUnicodeEmojiMap = {
  '<3': '❤',
  '8)': '😎',
  'D:': '😧',
  ':|': '😐',
  ':o)': '🐵',
  '=)': '😃',
  '=-)': '😃',
  ':D': '😄',
  ':-D': '😄',
  ';)': '😉',
  ';-)': '😉',
  ':>': '😆',
  ':->': '😆',
  ':o': '😮',
  ':-o': '😮',
  '>:(': '😠',
  '>:-(': '😠',
  ':)': '🙂',
  '(:': '🙂',
  ':-)': '🙂',
  ':(': '😞',
  '):': '😞',
  ':-(': '😞',
  ':/': '😕',
  ':\\': '😕',
  ':-/': '😕',
  ':\\\\\\\\': '😕', // user types ':\\'
  ':-\\\\\\\\': '😕', // user types ':-\\'
  ':p': '😛',
  ':-p': '😛',
  ':P': '😛',
  ':-P': '😛',
  ':-b': '😛',
  ';p': '😜',
  ';-p': '😜',
  ';b': '😜',
  ';-b': '😜',
  ':\\*': '😘', // user types ':*'
  ':-\\*': '😘', // user types ':-*'
};
