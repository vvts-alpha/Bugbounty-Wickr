import { Editor, Node } from '@tiptap/core';
import Mention, { MentionOptions } from '@tiptap/extension-mention';
import { NodeConfig, ReactRenderer } from '@tiptap/react';
import { ComponentType } from 'react';
import { COMPOSE_WRAPPER_DOM_ID, SIMPLE_WRAPPER_DOM_PREFIX } from '../../constants';

import markdownStyles from '@/components/MarkdownText/MarkdownText.module.less';

export type SuggestionExtensionQuery<T> = (props: { query: string }) => T[] | Promise<T[]>;

export interface SuggestionExtensionProps<T> {
  /**
   * Suggestion query interface. When given a query string, it should return a list
   * of suggestions that matches the query.
   * @param props
   * @returns
   */
  suggestions: SuggestionExtensionQuery<T>;
  /**
   * Called when getting the markdown output of a node inserted from the suggestion list.
   * @param state Use state.write to write text to the output.
   * @param node The single node, eg. an emoji or name. Nodes have id and label attributes.
   * @returns
   */
  serializeMarkdown: (
    state: { write: (content: string) => void },
    node: { id: string; label: string }
  ) => void;
  listElement: ComponentType;
  extendedConfig?: Partial<NodeConfig<MentionOptions, any>>;
  options?: Partial<MentionOptions>;
  /**
   * Optional custom container ref for rendering suggestions.
   * If provided, suggestions will be rendered in this container instead of the default compose wrapper.
   */
  customContainerRef?: React.RefObject<HTMLElement>;
}

export interface MentionListRef {
  onKeyDown: (props: Record<string, any>) => boolean;
}

export function createSuggestionExtension<T>(
  props: SuggestionExtensionProps<T>
): Node<MentionOptions, any> {
  return Mention.extend({
    addStorage() {
      return {
        markdown: {
          serialize(state: any, node: any) {
            props.serializeMarkdown(state, { ...node.attrs });
          },
        },
      };
    },
    ...props.extendedConfig,
  }).configure({
    ...props.options,
    HTMLAttributes: {
      class: markdownStyles.mentionText,
    },
    suggestion: {
      ...props.options?.suggestion,
      items: props.suggestions,
      render: () => {
        let component: ReactRenderer<MentionListRef>;
        let editor: Editor;
        return {
          onStart(startProps: Record<string, any>) {
            component = new ReactRenderer(props.listElement, {
              props: startProps,
              editor: startProps.editor,
            });
            editor = startProps.editor;

            // Use custom container if provided, otherwise fall back to default logic
            let composeWrapper: HTMLElement | null = null;

            if (props.customContainerRef?.current) {
              composeWrapper = props.customContainerRef.current;
            } else {
              // Find the correct compose wrapper - try the main one first, then look for simple ones
              composeWrapper = document.getElementById(COMPOSE_WRAPPER_DOM_ID);
              if (!composeWrapper) {
                // Look for simple compose wrappers
                const simpleWrappers = document.querySelectorAll(
                  `[id^="${SIMPLE_WRAPPER_DOM_PREFIX}"]`
                );
                if (simpleWrappers.length > 0) {
                  // Find the one that contains this editor
                  for (const wrapper of simpleWrappers) {
                    if (wrapper.contains(editor.view.dom)) {
                      composeWrapper = wrapper as HTMLElement;
                      break;
                    }
                  }
                }
              }
            }

            // Insert the suggestion list element on the correct composeWrapper
            composeWrapper?.appendChild(component.element);
          },
          onUpdate(props: Record<string, any>) {
            component.updateProps(props);
          },
          onKeyDown(props: Record<string, any>) {
            if (props.event.key === 'Escape') {
              props.event.stopPropagation();
              component.element?.remove();
              return true;
            }

            return !!component.ref?.onKeyDown(props);
          },

          onExit() {
            component.element?.remove();
            component.destroy();
          },
        };
      },
    },
  });
}
