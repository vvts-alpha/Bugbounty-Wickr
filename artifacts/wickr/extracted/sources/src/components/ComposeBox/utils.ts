import { Selection } from '@tiptap/pm/state';
import { Editor } from '@tiptap/react';

/**
 * By default, using shift+enter creates a new hardbreak as the next
 * empty line. However, hardbreaks cannot contain content, so
 * it has to be converted to a paragraph before any content can be added.
 */
export function ensureCurrentLineIsNotAHardBreak(editor?: Editor | null) {
  const view = editor?.view;
  if (!view) {
    return;
  }

  const nodeType = view.state.selection.$from.parent.type.name;
  if (nodeType === 'hardBreak') {
    const paragraph = view.state.schema.nodes.paragraph.create();
    const pos = view.state.selection.from;
    view.dispatch(view.state.tr.replaceWith(pos - 1, pos, paragraph));
    view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(pos))));
  }
}
