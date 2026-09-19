import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customCommands: {
      insertText: (text: string) => ReturnType;
    };
  }
}

const HTML_NEW_LINE = '<br>';
/**
 * An extension store general (not extension specific) edtior commands
 */
export const CustomCommandsExtension = Extension.create({
  name: 'customCommands',
  addCommands() {
    return {
      insertText:
        (text) =>
        ({ commands, tr }) => {
          // insertText add new lines as is to editor, but tiptap only recognizes <br>
          // so we need to add <br> manually
          text.split(/(?:\r\n?|\n)/).forEach((line, index) => {
            if (index !== 0) {
              commands.insertContent(HTML_NEW_LINE);
            }
            tr.insertText(line);
          });
          return true;
        },
    };
  },
});
