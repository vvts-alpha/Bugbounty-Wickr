// @ts-expect-error
import { rtfToTxt } from './rtf_converter.js';

import TextPreview from '.';

const RichTextPreview: ReactFC<{ url: string }> = ({ url }) => {
  return <TextPreview url={url} transformText={rtfToTxt} />;
};

export default RichTextPreview;
