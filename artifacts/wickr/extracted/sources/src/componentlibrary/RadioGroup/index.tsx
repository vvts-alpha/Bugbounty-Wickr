import React, { cloneElement } from 'react';

import { BaseProps } from '../Base';
export interface RadioGroupProps extends BaseProps {
  name: string;
}

export const RadioGroup: ReactFC<RadioGroupProps> = (props) => {
  const { name, children, className } = props;

  /** This automatically passes the name prop to the children
   *  which are expected to be <Radio /> components.
   *  This groups the HTML elements correctly and links the parent "radio-group"
   *  to the radio elements.
   */
  const cloneChildren = () => {
    return React.Children.map(children, (child) => {
      if (!child) {
        return;
      }
      return <>{cloneElement(child as JSX.Element, { name })}</>;
    });
  };

  return (
    <div className={className} role="radiogroup" data-testid="radio-group" id={name}>
      {cloneChildren()}
    </div>
  );
};

if (__DEV__) RadioGroup.displayName = 'RadioGroup';

export default RadioGroup;
