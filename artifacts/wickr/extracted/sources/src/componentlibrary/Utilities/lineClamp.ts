/** Returns inline style object that allows for multiline text to be truncated with ellipsis */
// To be applied to text's parent element
// Implementation reference: https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-line-clamp#browser_compatibility

import { CSSProperties } from 'react';

export const lineClamp = (lines: number) => {
  // box orient style doesn't work with less/modules which is why we use this inline
  const lineClampStyles = {
    display: '-webkit-box',
    WebkitLineClamp: `${lines}`,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  } satisfies CSSProperties;

  return lineClampStyles;
};
