/**
 * Takes a node as input and converts any emoji img elements to unicode text elements
 * with the emojis inside them. This creates a temporary element, so it is recommended that you
 * remove the div element returned from this method after you are done with it.
 *
 * @param node Node to convert any emoji img elements to unicode text elements.
 * @returns A div element with the emoji img elements converted to unicode text elements.
 */
export const convertEmojiImgsToUnicode = (node: Node): HTMLDivElement => {
  const tempDiv = document.createElement('div');

  tempDiv.appendChild(node.cloneNode(true));

  // Convert rendered emoji images to unicode emojis on copy so they can be pasted anywhere
  Array.from(tempDiv.querySelectorAll<HTMLImageElement>('img.emoji')).forEach((emojiImg) => {
    const emojiText = document.createTextNode(emojiImg.alt);
    emojiImg.parentNode?.replaceChild(emojiText, emojiImg);
  });

  return tempDiv;
};
