import { clsx } from 'clsx';
import React, {
  useEffect,
  useState,
  useRef,
  KeyboardEvent as ReactKeyBoardEvent,
  MouseEvent as ReactMouseEvent,
  useLayoutEffect,
  useReducer,
  useContext,
  MutableRefObject,
  CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { usePopper } from 'react-popper';
import { KEY_CODES } from '../constants';
import { useFloatingContent } from '@/components/FloatingContentContainers';
import { useChangeLayoutEffect } from '@/hooks/useChangeEffect';
import useClickOutside from '@/hooks/useClickOutside';
import { asElement, asHtmlElement, getFocusableElements, getScrollParent } from '@/utils/dom';
import { valueOrInitializer } from '@/utils/function';
import { PopOverContext } from './PopOverContext';

import styles from './PopOver.module.less';

type TriggerType = 'click' | 'contextmenu';

export type Placement =
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'right-start'
  | 'right-end'
  | 'left-start'
  | 'left-end';

type PopOverContent =
  | ((event: ReactMouseEvent | ReactKeyBoardEvent | undefined) => ReactJSXChild)
  | ReactJSXChild;

export interface PopOverProps {
  /** Content JSX, or function that returns content JSX based on the trigger event, if available */
  popoverContent?: PopOverContent;
  /** Defaults to 'click' */
  triggerType?: TriggerType;
  /** Determines whether the menu should render from the position of the element or the cursor (on click only). Defaults to 'element' */
  anchorTo?: 'element' | 'cursor';
  /** Defaults to 'bottom-start' */
  placement?: Placement;
  /** Defaults to true */
  closeOnClick?: boolean | ((e: ReactMouseEvent) => boolean);
  /** Defaults to true */
  focusFirstElement?: boolean;
  offset?: [number, number];
  menuClassName?: string;
  contentWrapperClassName?: string;
  onOpen?: () => void;
  onClose?: () => void;
  /** Adds a leading gutter for icons */
  iconGutter?: boolean;
  isSubmenu?: boolean;
  menuDescription?: string;
  style?: CSSProperties;
}

type VirtualElement = {
  getBoundingClientRect: () => {
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

function generateGetBoundingClientRect(x = 0, y = 0) {
  return () => ({
    width: 0,
    height: 0,
    top: y,
    right: x,
    bottom: y,
    left: x,
  });
}

type ShowMenuState = {
  /** Show or hide the menu */
  showMenu: boolean;
  /** The event that triggered the show, if applicable */
  eventTriggeredMenu: ReactMouseEvent | ReactKeyBoardEvent | undefined;
};

/** Keep track of show state as well as the event that triggered the show */
function menuShowTargetReducer(
  _state: ShowMenuState,
  action: ReactMouseEvent | ReactKeyBoardEvent | boolean | undefined
): ShowMenuState {
  return {
    showMenu: !!action,
    eventTriggeredMenu: action && action !== true ? action : undefined,
  };
}

const SUBMENU_TRIGGER_SELECTOR = 'data-submenutrigger';
const isSubmenuTrigger = (target: EventTarget) =>
  (target instanceof HTMLAnchorElement || target instanceof HTMLButtonElement) &&
  target.hasAttribute(SUBMENU_TRIGGER_SELECTOR);
const OPEN_MENU_CLASSNAME = 'isOpen';
const SUBMENU_SELECTOR = '[data-submenu="true"]';
const POPOVER_ITEM_SELECTOR = '[data-testid="popover-item"]';

export const PopOver: ReactFC<PopOverProps> = ({
  children,
  popoverContent,
  triggerType = 'click',
  anchorTo = 'element',
  placement = 'bottom-start',
  closeOnClick = true,
  focusFirstElement = true,
  offset,
  menuClassName,
  contentWrapperClassName,
  onOpen,
  onClose,
  iconGutter,
  isSubmenu,
  menuDescription,
  style,
}) => {
  const [virtualElement, setVirtualElement] = useState<VirtualElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [{ showMenu, eventTriggeredMenu }, setShowMenu] = useReducer(menuShowTargetReducer, {
    showMenu: false,
    eventTriggeredMenu: undefined,
  });

  const popOverCtx = useContext(PopOverContext);

  useEffect(() => {
    popOverCtx.trackMenuIsOpen(showMenu);
  }, [showMenu]);

  // Fire open/close events
  useChangeLayoutEffect(() => {
    if (showMenu) {
      onOpen?.();
    } else {
      onClose?.();
    }
  }, [showMenu]);

  const handleClick = (e: ReactMouseEvent) => {
    if (triggerType === 'click' && wrapperRef.current?.contains(e.target as HTMLElement)) {
      if (showMenu) {
        setShowMenu(false);
      } else {
        if (
          anchorTo === 'cursor' &&
          // event.detail will be 1 for a mouse event but 0 for keyboard events.
          // Revert to element positioning for keyboard events.
          e.detail === 1
        ) {
          setVirtualElement({
            getBoundingClientRect: generateGetBoundingClientRect(e.clientX, e.clientY),
          });
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(e || true);
        } else if (triggerType === 'click') {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(e || true);
        }
      }
    }
  };

  const handleContextMenu = (e: ReactMouseEvent) => {
    if (wrapperRef.current?.contains(e.target as HTMLElement) && triggerType === 'contextmenu') {
      setVirtualElement({
        getBoundingClientRect: generateGetBoundingClientRect(e.clientX, e.clientY),
      });
      e.preventDefault();
      e.stopPropagation();
      setShowMenu(e || true);
    }
  };

  // Don't automatically focus the first element in a submenu unless
  // opening from the right/left arrow keys.
  const [focusFirstSubmenuElement, setFocusFirstSubmenuElement] = useState(false);

  const handleFocus = (e: React.FocusEvent) => {
    if (!isSubmenu) return;
    const el = e.target;
    if (!isSubmenuTrigger(el)) return;

    const subMenuIsOpen = el.classList.contains(OPEN_MENU_CLASSNAME);
    if (!subMenuIsOpen) {
      setShowMenu(true);
    }
  };

  const handleBlur = (e: React.FocusEvent): void => {
    if (!isSubmenu) return;
    const el = e.target;
    if (!isSubmenuTrigger(el)) return;

    const subMenuIsOpen = el.classList.contains(OPEN_MENU_CLASSNAME);
    const targetIsInSubmenu = asHtmlElement(e.relatedTarget)?.closest(SUBMENU_SELECTOR);
    if (subMenuIsOpen && !targetIsInSubmenu) {
      setShowMenu(false);
    }
  };

  const handleKeyDown = (e: ReactKeyBoardEvent) => {
    if (!isSubmenu) return;
    switch (e.key) {
      case KEY_CODES.ARROW_RIGHT:
      case KEY_CODES.ARROW_LEFT:
        setFocusFirstSubmenuElement(true);
        setShowMenu(true);
    }
  };

  return (
    <>
      <div
        className={clsx(styles.popoverWrapper, 'popoverContentWrapper', contentWrapperClassName, {
          isOpen: showMenu,
        })}
        ref={wrapperRef}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
      {showMenu && (
        <PopOverInternal
          closeOnClick={closeOnClick}
          eventTriggeredMenu={eventTriggeredMenu}
          focusFirstElement={isSubmenu ? focusFirstSubmenuElement : focusFirstElement}
          menuClassName={menuClassName}
          offset={offset}
          onClose={() => {
            if (isSubmenu) {
              setFocusFirstSubmenuElement(false);
            }
            setShowMenu(false);
          }}
          placement={placement}
          popoverContent={popoverContent}
          triggerType={triggerType}
          virtualElement={virtualElement}
          wrapperRef={wrapperRef}
          iconGutter={iconGutter}
          isSubmenu={isSubmenu}
          description={menuDescription}
          style={style}
        />
      )}
    </>
  );
};

export default PopOver;

type PopOverInternalProps = {
  closeOnClick: boolean | ((e: ReactMouseEvent) => boolean);
  eventTriggeredMenu: ReactMouseEvent | ReactKeyBoardEvent | undefined;
  focusFirstElement: boolean;
  menuClassName?: string;
  offset?: [number, number];
  onClose: AnyFunction;
  placement: Placement;
  popoverContent?: PopOverContent;
  triggerType: string;
  virtualElement: VirtualElement | null;
  wrapperRef: MutableRefObject<HTMLDivElement | null>;
  iconGutter?: boolean;
  isSubmenu?: boolean;
  description?: string;
  style?: CSSProperties;
};

/** Internal component that is only rendered when we want to show the PopOver */
const PopOverInternal: React.FC<PopOverInternalProps> = ({
  closeOnClick,
  eventTriggeredMenu,
  focusFirstElement,
  menuClassName,
  offset,
  onClose,
  placement,
  popoverContent,
  triggerType,
  virtualElement,
  wrapperRef,
  iconGutter,
  isSubmenu,
  description,
  style,
}) => {
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const { styles: popperStyles, attributes } = usePopper(
    (virtualElement as Element) || wrapperRef.current,
    menuEl,
    {
      placement,
      modifiers: [{ name: 'offset', options: { offset } }],
    }
  );

  useEffect(() => {
    // return focus to the element that triggered the
    // popover when it closes, except for submenu items,
    // they handle their own focus return
    const activeNode: any = document.activeElement;
    return () => !isSubmenu && !!activeNode && activeNode.focus();
  }, []);

  // handle clicks outside popover menu
  useClickOutside(menuEl, (e) => {
    if (
      (!wrapperRef.current?.contains(e.target as HTMLElement) && // Don't close when clicking in the menu
        !asElement(e.target)?.closest(SUBMENU_SELECTOR) && // Don't close the main menu when clicking a submenu
        !asElement(e.target)?.closest(POPOVER_ITEM_SELECTOR)) || // Don't close the menu when clicking a popover item in a different menu (popover menus can contain items with their own popover menus)
      triggerType === 'contextmenu'
    ) {
      onClose();
    }
  });

  // handling dismissing popover menu on scroll
  useEffect(() => {
    if (triggerType === 'contextmenu') {
      const menuScrollableParentNode =
        menuEl && triggerType === 'contextmenu' ? getScrollParent(menuEl) : undefined;

      if (!menuScrollableParentNode) return;

      const handleScroll = () => {
        if (triggerType === 'contextmenu') {
          onClose();
        }
      };

      menuScrollableParentNode.addEventListener('scroll', handleScroll);

      return () => {
        menuScrollableParentNode.removeEventListener('scroll', handleScroll);
      };
    } else if (triggerType === 'click') {
      // This effect is to the support for closing popover when it's out of view.
      // Only support it if intersection observer is defined.
      if (typeof IntersectionObserver === 'undefined') {
        return;
      }

      if (wrapperRef.current) {
        const observer = new IntersectionObserver((entries) => {
          const isVisible = entries[0]?.isIntersecting;
          if (!isVisible) {
            // technically this is stale, but as this component is only used internally
            // we already know that it never gets stale because setShowMenu is stable
            // If we update onClose to use changing state, we'll need useLatestCallback
            onClose();
          }
        });
        observer.observe(wrapperRef.current);
        return () => {
          observer.disconnect();
        };
      }
    }
  }, [menuEl, triggerType]);

  const handleMenuKeyDown = (e: ReactKeyBoardEvent) => {
    if (e.key === KEY_CODES.TAB) {
      return onClose();
    }

    if (
      e.key === KEY_CODES.ESCAPE ||
      e.key === KEY_CODES.ARROW_UP ||
      e.key === KEY_CODES.ARROW_DOWN
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
    switch (e.key) {
      case KEY_CODES.ARROW_UP:
        return move('up');
      case KEY_CODES.ARROW_DOWN:
        return move('down');
      case KEY_CODES.ESCAPE:
      case KEY_CODES.ARROW_RIGHT:
      case KEY_CODES.ARROW_LEFT:
        if (isSubmenu) {
          if (menuEl?.contains(document.activeElement)) {
            wrapperRef.current?.querySelector('button')?.focus(); // Return focus to the main menu item
          }
          return onClose();
        } else if (e.key === KEY_CODES.ESCAPE) {
          return onClose();
        }
    }
  };

  function handleMenuClick(e: ReactMouseEvent) {
    if (!isSubmenu) {
      e.stopPropagation();
    }

    const shouldClose = valueOrInitializer(closeOnClick, e);

    if (shouldClose) {
      onClose();
    }
  }

  const move = (direction: string) => {
    if (menuEl) {
      const nodes = getFocusableElements(menuEl);
      const activeElement: any = document.activeElement;

      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i] === activeElement) {
          if (direction === 'down' && i !== nodes.length - 1) {
            return nodes[i + 1].focus();
          }
          if (direction === 'up' && i > 0) {
            return nodes[i - 1].focus();
          }
        }
      }
    }
  };

  // focusing first focusable element
  useEffect(() => {
    if (menuEl && focusFirstElement) {
      const nodes = getFocusableElements(menuEl);
      nodes.length && nodes[0].focus();
    }
  }, [menuEl, focusFirstElement]);

  // Close the menu if there are no children (empty menu without options)
  useLayoutEffect(() => {
    if (menuEl?.childElementCount === 0) {
      onClose();
    }
  }, [menuEl]);

  const { getPopOverContainer, didUpdateFloatingContent } = useFloatingContent();

  useEffect(() => {
    const ref = wrapperRef.current;
    didUpdateFloatingContent(ref?.ownerDocument);
    return () => didUpdateFloatingContent(ref?.ownerDocument);
  }, [didUpdateFloatingContent, wrapperRef]);

  const handleMenuBlur = (e: React.FocusEvent) => {
    if (
      isSubmenu && // Close the menu if it is a submenu
      e.relatedTarget &&
      !e.relatedTarget.closest(SUBMENU_SELECTOR) && // and the element receiving focus not in the submenu
      (!isSubmenuTrigger(e.relatedTarget) || // and the element receiving focus is not a submenu trigger
        (isSubmenuTrigger(e.relatedTarget) && !e.relatedTarget.classList.contains('isOpen'))) // or it is a submenu trigger but isn't open
    )
      onClose();
  };

  // Internal component is loaded on open, so container should be available at time of render
  const containerEl = getPopOverContainer(wrapperRef.current?.ownerDocument);
  if (!containerEl) return null;

  // TODO: use a DIV until Qt a11y supports UL + LI
  return createPortal(
    <div
      ref={setMenuEl}
      role="menu"
      data-submenu={isSubmenu}
      /** The vanilla className popoverMenu is referenced by other component files. */
      className={clsx('popoverMenu', styles.popOverMenu, menuClassName, {
        [styles.leadingGutter]: iconGutter,
      })}
      onKeyDown={handleMenuKeyDown}
      onBlur={handleMenuBlur}
      style={{ ...style, ...popperStyles.popper }}
      onClick={handleMenuClick}
      aria-description={description}
      {...attributes}
    >
      {valueOrInitializer(popoverContent, eventTriggeredMenu)}
    </div>,
    containerEl
  );
};
