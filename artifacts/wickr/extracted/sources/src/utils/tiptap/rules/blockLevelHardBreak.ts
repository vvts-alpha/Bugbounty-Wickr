import { HardBreak } from '@tiptap/extension-hard-break';
// Create hardBreaks as block level instead of inline, which fixes
// not being able to use other nodes (codeblock, etc) after a hardBreak
export const BlockLevelHardBreak = HardBreak.extend({
  group: 'block',
  content: 'text*',
  inline: false,
  linebreakReplacement: false,
  addCommands() {
    return {
      setHardBreak:
        () =>
        ({ commands, editor }) => {
          const { state } = editor;
          const { selection } = state;
          const { $head } = selection;

          const position = $head.after();
          return commands.insertContentAt({ from: position, to: position }, { type: this.name });
        },
    };
  },
});
