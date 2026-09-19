import { Markdown } from 'tiptap-markdown';
import { CustomText } from './text';

export const CustomMarkdown = Markdown.extend({
  // tiptap-markdown escapes < and > by default, but this prevents it
  addExtensions() {
    return [CustomText];
  },
}).configure({
  // Markdown parsing and serialization
  html: false,
  linkify: true,
  breaks: false,
});
