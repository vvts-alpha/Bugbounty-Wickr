import React, { forwardRef } from 'react';

import Button, { ButtonProps } from '.';

export const PrimaryButton = forwardRef(
  ({ className, ...props }: Omit<ButtonProps, 'color'>, ref: React.Ref<HTMLButtonElement>) => (
    <Button color="primary" className={className} ref={ref} {...props} />
  )
);

export default PrimaryButton;
