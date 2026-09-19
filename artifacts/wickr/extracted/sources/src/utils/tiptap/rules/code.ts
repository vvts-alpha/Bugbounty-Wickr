import Code from '@tiptap/extension-code';

export const CustomCode = Code.extend({
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-i': () => this.editor.commands.toggleCode(),
    };
  },
});
