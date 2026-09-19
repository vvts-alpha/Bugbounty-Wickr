import { KEY_CODES } from '../constants';
import { getFocusableElements, isHtmlElement } from '@/utils/dom';

// Only the first radio in a group should take focus.
// Returns whether or not the element should be included
// in the focusable elements list.
// Always include the radio if it's the activeElement.
const shouldIncludeRadioInFocusableList = (el: HTMLElement) => {
  if (el === document.activeElement) return true;
  if (el.getAttribute('type') !== 'radio') {
    return true; // Not a radio, skip
  }
  const name = el.getAttribute('name');
  if (!name) return true; // Radios in group must have name attribute

  const parent = el.parentElement?.closest(`[id="${name}"][role="radiogroup"]`);
  if (!parent) return true;
  const allRadios = [...parent.querySelectorAll(`input[type="radio"][name="${name}"`)];
  return allRadios[0] === el;
};

const trapFocus = (e: KeyboardEvent, content: HTMLElement | (HTMLElement | null)[]) => {
  if (e.key === KEY_CODES.TAB) {
    if (!content) {
      return;
    }

    if (!Array.isArray(content)) {
      content = [content];
    }
    const filteredContent = content.filter(isHtmlElement);

    const activeContainer =
      filteredContent.find((el) => el?.contains(document.activeElement)) || null;

    if (!activeContainer) return;
    const activeContainerChildren = getFocusableElements(activeContainer).filter(
      shouldIncludeRadioInFocusableList
    );
    if (!activeContainerChildren) return;
    const activeContainerIndex = filteredContent.indexOf(activeContainer);

    if (!e.shiftKey) {
      // The last element in the container is focused
      if (activeContainerChildren[activeContainerChildren.length - 1] === document.activeElement) {
        e.preventDefault();
        // if its the last container focus the first el of the first container
        if (activeContainerIndex === filteredContent.length - 1) {
          const elements = getFocusableElements(filteredContent[0]);
          elements?.[0]?.focus();
        } else {
          // else focus first element of next container
          const nextContainer = filteredContent[activeContainerIndex + 1];
          getFocusableElements(nextContainer)?.[0]?.focus();
        }
      }
    } else if (e.shiftKey) {
      // The first element in a container is focused
      if (activeContainerChildren[0] === document.activeElement) {
        e.preventDefault();

        // if its the first container, focus the last element of the last container
        if (activeContainerIndex === 0) {
          const firstElements = getFocusableElements(filteredContent[filteredContent.length - 1]);
          firstElements?.[firstElements.length - 1]?.focus();
        } else {
          // else focus the last element of the previous container
          const nextElements = getFocusableElements(filteredContent[activeContainerIndex - 1]);
          nextElements?.[nextElements.length - 1]?.focus();
        }
      }
    }
  }
};

export default trapFocus;
