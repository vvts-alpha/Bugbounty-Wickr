import React from 'react';
import { SvgProps } from '../../Svg';

export const PartialCheckIcon: React.FC<SvgProps> = (props) => (
  <svg
    className={props.className}
    style={{ width: props.width, height: props.height }}
    width={props.width}
    height={props.height}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <filter
        x="-15.6%"
        y="-15.6%"
        width="131.2%"
        height="131.2%"
        filterUnits="objectBoundingBox"
        id="yx3f2fkdxa"
      >
        <feOffset dy=".5" in="SourceAlpha" result="shadowOffsetOuter1" />
        <feGaussianBlur stdDeviation=".25" in="shadowOffsetOuter1" result="shadowBlurOuter1" />
        <feColorMatrix
          values="0 0 0 0 0 0 0 0 0 0.301960784 0 0 0 0 0.858823529 0 0 0 0.7 0"
          in="shadowBlurOuter1"
          result="shadowMatrixOuter1"
        />
        <feMerge>
          <feMergeNode in="shadowMatrixOuter1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <g
      filter="url(#yx3f2fkdxa)"
      transform="translate(2.868 2.25)"
      fill="currentColor"
      fillRule="evenodd"
    >
      <path d="M10.251 7.5a.75.75 0 0 1 .102 1.493L10.251 9H5.75a.75.75 0 0 1-.102-1.493L5.75 7.5h4.501z" />
    </g>
  </svg>
);
