import { Node, mergeAttributes } from '@tiptap/core';
import { IMentionModel } from '@/components/ComposeBox/Extensions/Mention/MentionModel';

export const MENTION_TYPE_NAME = 'Mention';

export type MentionAttributes = IMentionModel & { HTMLAttributes?: any };

export type MentionNode = {
  type: typeof MENTION_TYPE_NAME;
  attrs: MentionAttributes;
};

const Mention = Node.create<MentionAttributes>({
  name: MENTION_TYPE_NAME,
  addOptions() {
    return {
      id: '',
      label: '',
      HTMLAttributes: {},
    };
  },
  addAttributes() {
    return {
      id: {
        default: '',
      },
      label: {
        default: '',
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

export default Mention;
