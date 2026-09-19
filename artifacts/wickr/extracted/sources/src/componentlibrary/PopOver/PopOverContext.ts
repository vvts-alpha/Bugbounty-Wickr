import React, { createContext } from 'react';

type ElementType = HTMLAnchorElement | HTMLButtonElement;

export class PopOverContextValue {
  /** track number of open menus (can be > 1 since there are submenus) */
  private openMenus = 0;

  /** track the target that the mousedown event happened on */
  private mouseDownEl: ElementType | null = null;

  /** attach to each menu item */
  handleItemMouseDown = (e: React.MouseEvent<ElementType, MouseEvent>) => {
    const el = e.currentTarget;
    if (this.openMenus > 0 && el) {
      this.mouseDownEl = el;
    }
  };

  /** attach to each menu item */
  handleItemMouseUp = (e: React.MouseEvent<ElementType, MouseEvent>) => {
    const el = e.currentTarget;
    const { mouseDownEl } = this;
    this.mouseDownEl = null;
    // If the el is the same on down and up, click will fire automatically,
    // so we only want to fire if down was on one item and up was on another.
    const wasDownOnAnotherMenuItem = el && mouseDownEl && mouseDownEl !== el;
    if (wasDownOnAnotherMenuItem && el) {
      el.click();
    }
  };

  trackMenuIsOpen = (isOpen: boolean) => {
    if (isOpen) {
      this.openMenus++;
    } else {
      this.openMenus--;
      if (this.openMenus <= 0) {
        this.openMenus = 0;
        this.mouseDownEl = null;
      }
    }
  };
}

/** Track mousedown and mouseup events to allow users to click down on one menu item and up on another to click it */
export const PopOverContext = createContext(new PopOverContextValue());
