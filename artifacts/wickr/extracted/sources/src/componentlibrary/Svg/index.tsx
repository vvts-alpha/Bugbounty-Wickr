import { clsx } from 'clsx';
import React from 'react';

import styles from './styles.module.less';

export interface SvgProps extends React.SVGAttributes<HTMLOrSVGElement> {
  /** CSS classname to apply custom styles. */
  className?: string;
  /** Defines the position and dimension of an SVG viewport. viewBox attribute is a list of four numbers: min-x, min-y, width and height. */
  viewBox?: string;
  /** The width and height of the SVG (sets them both at once - will overwrite width/height props). */
  size?: string | number;
  /** The label of a SVG component */
  label?: string;
  /** Test ID for testing purposes */
  'data-testid'?: string;
}

export interface FilledProps extends SvgProps {
  filled?: boolean;
}

export interface SvgScalerProps extends SvgProps {
  svgScale?: number;
}

export const Svg: React.FC<SvgProps> = ({
  className,
  children,
  viewBox = '0 0 16 16',
  xmlns = 'http://www.w3.org/2000/svg',
  width = '16px',
  height = '16px',
  size,
  ...props
}) => {
  const svgWidth = size ?? width;
  const svgHeight = size ?? height;

  // This is necessary because some versions of Firefox would not use rems as values
  // for width and height attributes: https://bugzilla.mozilla.org/show_bug.cgi?id=1231147
  const inlineStyles = {
    width: svgWidth,
    height: svgHeight,
    ...props.style,
  };

  return (
    <svg
      xmlns={xmlns}
      className={clsx('Svg', styles.svg, className)}
      {...props}
      width={svgWidth}
      height={svgHeight}
      style={inlineStyles}
      viewBox={viewBox}
      data-testid={props['data-testid'] || 'iconSvg'}
    >
      <g fillRule="evenodd" fill={props.fill || 'currentColor'}>
        {children}
      </g>
    </svg>
  );
};

export const SvgScaler: React.FC<SvgScalerProps> = ({
  svgScale = 1.6,
  width = '24px',
  height = '24px',
  ...props
}) => {
  return (
    <div style={{ width, height, display: 'inline-block', overflow: 'hidden' }}>
      <Svg {...props} transform={`scale(${svgScale})`}>
        {props.children}
      </Svg>
    </div>
  );
};

if (__DEV__) SvgScaler.displayName = 'SvgScaler';
