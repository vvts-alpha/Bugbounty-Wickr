import { clsx } from 'clsx';
import React, {
  useRef,
  useState,
  useEffect,
  ReactNode,
  ReactElement,
  useMemo,
  DOMAttributes,
  useImperativeHandle,
} from 'react';
import { createPortal } from 'react-dom';
import { usePopperTooltip } from 'react-popper-tooltip';
import { BaseProps } from '../Base';
import { useFloatingContent } from '@/components/FloatingContentContainers';
import useLatestCallback from '@/hooks/useLatestCallback';
import { asHtmlElement } from '@/utils/dom';
import { isPointInDOMRect } from '@/utils/math';

import styles from './Tooltip.module.less';

export type TooltipPosition = 'top' | 'right' | 'bottom' | 'left' | 'auto';

const DEFAULT_TOOLTIP_DELAY = 500;

type Tip = ReactNode | string;

type TipOrTipGenerator =
  | ((e: React.MouseEvent | React.FocusEvent) => Tip | null | undefined | false)
  | Tip;

export interface TooltipProps extends Pick<BaseProps, 'className'> {
  /**
   * A string or ReactNode to display in the tooltip, or a function that will generate a string or ReactNode based on the event:
   * - If tip is a function, the function will be called for onMouseOver/onMouseEnter/onFocus events. If the function
   *   returns content (string | ReactNode), it will be used for the tooltip content and the tip will hide on the
   *   corresponding onMouseOut/onMouseLeave/onBlur event.
   * - If tip is a ReactNode or string, the show/hide behavior will be tied to onMouseEnter/onMouseLeave events.
   * */
  tip?: TipOrTipGenerator;
  /** The element that triggers the tooltip to display. Must be an HTML element or a component that forwardsRef */
  children: ReactElement<any>;
  /** The preferred position to display the tooltip. The component will re-position depending on available space (default: top) */
  position?: TooltipPosition;
  /** Whether or not clicking the trigger should close an open tooltip */
  closeOnTriggerClick?: boolean;
  /** Optional number of milliseconds delay before showing the tooltip. If true, the default tooltip delay is used */
  delay?: boolean | number;
  /** If true, the tooltip trigger may be inline content and the correct bounding box will be auto-detected. position will be auto in this case */
  inline?: boolean;
}

/** Track the current mouse position for inline tooltips */
const globalMousePosition = { x: 0, y: 0 };
// keep track of the total number of tooltips that are inline, so we can add/remove a mousemove handler
let inlineTooltips = 0;
// the current mousemove handler
let globalMouseMoveHandler: ((e: MouseEvent) => void) | undefined;

export const Tooltip: ReactFC<TooltipProps> = ({
  tip,
  position = 'top',
  closeOnTriggerClick = false,
  children,
  delay,
  inline,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  // Keep track of the event responsible for closing the tooltip; value is '' when not opened
  const closeTipOnEventType = useRef<'mouseout' | 'mouseleave' | 'blur' | ''>('');
  const [delayed, setDelayed] = useState(!!delay);
  const childrenRef = useRef<HTMLElement | null>(null);

  // track global mouse x/y for inline tooltips
  useEffect(() => {
    if (inline) {
      inlineTooltips++;
      if (!globalMouseMoveHandler) {
        globalMouseMoveHandler = (e: MouseEvent) => {
          globalMousePosition.x = e.clientX;
          globalMousePosition.y = e.clientY;
        };
        window.addEventListener('mousemove', globalMouseMoveHandler);
      }
      return () => {
        inlineTooltips--;
        if (inlineTooltips <= 0 && globalMouseMoveHandler) {
          window.removeEventListener('mousemove', globalMouseMoveHandler);
          globalMouseMoveHandler = undefined;
          inlineTooltips = 0;
        }
      };
    }
  }, [inline]);

  // handle delayed showing
  useEffect(() => {
    setDelayed(!!delay); // reset delayed state whenever isVisible or delay change
    if (!delay || !isVisible) return;
    const delayTimeout = setTimeout(
      () => setDelayed(false),
      delay === true ? DEFAULT_TOOLTIP_DELAY : delay
    );
    return () => clearTimeout(delayTimeout);
  }, [isVisible, delay]);

  // if tip is a function, the content is generated and stored here
  const [generatedTipContent, setGeneratedTipContent] = useState<ReactNode | string>('');
  // if tip is a function, the target is set to the matching event.target
  const tipTargetRef = useRef<HTMLElement | null>(null);

  const showTooltipUntil = (closeOnEvent: 'mouseout' | 'blur' | 'mouseleave') => {
    setIsVisible(true);
    closeTipOnEventType.current = closeOnEvent;
  };

  const hideTooltip = () => {
    setIsVisible(false);
    setGeneratedTipContent('');
    closeTipOnEventType.current = '';
  };

  // use latest because we access tip, which may change on each render if it's a function
  const maybeGenerateTooltip = useLatestCallback((e: React.MouseEvent | React.FocusEvent) => {
    if (isVisible) return;
    let showTip = false;
    if (typeof tip === 'function') {
      const content = tip(e);
      if (content) {
        setGeneratedTipContent(content);
        tipTargetRef.current = asHtmlElement(e.target) ?? null;
        showTip = true;
      }
    } else if (e.type === 'mouseenter' || e.type === 'focus') {
      // ignore mouseover/mouseout for non-function tips
      showTip = true;
    }

    if (showTip) {
      switch (e.type) {
        case 'mouseover':
          showTooltipUntil('mouseout');
          break;
        case 'focus':
          showTooltipUntil('blur');
          break;
        // consider any other event type as mouseenter
        default:
          showTooltipUntil('mouseleave');
      }
    }
  });

  const clonedChildren = useMemo(() => {
    if (!React.isValidElement(children)) {
      return;
    }
    const maybeHideTooltip = (e: React.FocusEvent | React.MouseEvent) => {
      if (e.type === closeTipOnEventType.current) {
        hideTooltip();
      }
    };
    // handlers object used to get proper types
    const handlers: DOMAttributes<HTMLElement> = {
      onClick(e) {
        if (closeOnTriggerClick) {
          hideTooltip();
        }
        children.props.onClick?.(e);
      },
      onMouseEnter(e) {
        maybeGenerateTooltip(e);
        children.props.onMouseEnter?.(e);
      },
      onMouseLeave(e) {
        maybeHideTooltip(e);
        children.props.onMouseLeave?.(e);
      },
      onFocus(e) {
        maybeGenerateTooltip(e);
        children.props.onFocus?.(e);
      },
      onBlur(e) {
        maybeHideTooltip(e);
        children.props.onBlur?.(e);
      },
      onMouseOver(e) {
        maybeGenerateTooltip(e);
        children.props.onMouseOver?.(e);
      },
      onMouseOut(e) {
        maybeHideTooltip(e);
        children.props.onMouseOut?.(e);
      },
    };
    return React.cloneElement(children, {
      ...children.props,
      ...handlers,
      ref: childrenRef,
    });
  }, [children, closeOnTriggerClick]);

  // The original children.ref needs to be assigned
  // @ts-expect-error children.ref type is not well-defined
  useImperativeHandle(children.ref, () => childrenRef.current);

  if (!clonedChildren) {
    console.error(`
            Cannot use text or numbers as direct children of tooltips,
            Tooltips require a valid element to act as the trigger.
          `);
    return <>{children}</>;
  }
  return (
    <>
      {isVisible && tip && !delayed && (
        <TooltipInternal
          tip={typeof tip === 'function' ? generatedTipContent : tip}
          className={className}
          isVisible={isVisible}
          onVisibleChange={(visible) => {
            if (visible) showTooltipUntil('mouseleave');
            else hideTooltip();
          }}
          position={position}
          delay={delay}
          inline={inline}
          childrenRef={childrenRef}
          targetRef={tipTargetRef}
        />
      )}
      {clonedChildren}
    </>
  );
};

if (__DEV__) Tooltip.displayName = 'Tooltip';

export default Tooltip;

/** Popover options for inline tooltips */
const inlinePopperOptions: Parameters<typeof usePopperTooltip>[1] = {
  modifiers: [
    /**
     * Inline elements can span multiple lines, and thus can have multiple rectangles.
     * Iterate over the rectangles until one is found that contains the mouse pointer,
     * falling back to the first rectangle (e.g. via tab focus)
     */
    {
      name: 'inline',
      enabled: true,
      phase: 'read',
      fn({ state }) {
        try {
          // @ts-expect-error getClientRects is not in the module's types, but it exists on the HTMLElement
          const rects: DOMRectList = state.elements.reference.getClientRects();
          let containingRect = rects[0];
          if (rects.length > 1) {
            for (let i = 0; i < rects.length; i++) {
              if (isPointInDOMRect(globalMousePosition, rects[i])) {
                containingRect = rects[i];
                break;
              }
            }
            state.rects.reference = containingRect;
            return state;
          }
        } catch {
          // no-op, fallback to default behavior
        }
      },
    },
    {
      // Since we override modifiers, we need to supply offset here instead of via usePopperTooltip options
      name: 'offset',
      enabled: true,
      phase: 'main',
      options: {
        offset: [0, 8],
      },
    },
  ],
};

interface TooltipInternalProps extends Omit<Partial<TooltipProps>, 'tip'> {
  tip: ReactNode | string;
  isVisible: boolean;
  childrenRef: React.MutableRefObject<HTMLElement | null>;
  onVisibleChange: (state: boolean) => void;
  targetRef: React.MutableRefObject<HTMLElement | null>;
}

/**
 * TooltipInternal is a separate component from Tooltip. It wraps the tooltip rendering logic,
 * including usePopperTooltip hook and the tooltip portal. It was designed to be lazily loaded by
 * Tooltip for better performance.
 */
const TooltipInternal: React.FC<TooltipInternalProps> = ({
  tip,
  isVisible,
  position,
  onVisibleChange,
  inline,
  childrenRef,
  targetRef,
  className,
}) => {
  const { setTooltipRef, setTriggerRef, getArrowProps, getTooltipProps, triggerRef } =
    usePopperTooltip(
      {
        trigger: [],
        closeOnOutsideClick: true,
        closeOnTriggerHidden: true,
        placement: position,
        offset: [0, 11],
        visible: isVisible,
        onVisibleChange,
      },
      inline ? inlinePopperOptions : undefined
    );

  useImperativeHandle(setTriggerRef, (): any => targetRef.current ?? childrenRef.current);

  const { getTooltipContainer, didUpdateFloatingContent } = useFloatingContent();
  const container = getTooltipContainer(triggerRef?.ownerDocument);

  useEffect(() => {
    didUpdateFloatingContent(triggerRef?.ownerDocument);
    return () => didUpdateFloatingContent(triggerRef?.ownerDocument);
  }, [triggerRef, didUpdateFloatingContent]);

  return container
    ? createPortal(
        <div
          className={clsx(styles.tooltip, className)}
          {...getTooltipProps()}
          ref={setTooltipRef}
          data-tip={tip}
          aria-hidden={true}
        >
          {tip}
          <div className={styles.arrow} {...getArrowProps()} />
        </div>,
        container
      )
    : null;
};
