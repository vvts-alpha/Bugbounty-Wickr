import { clsx } from 'clsx';
import isArray from 'lodash/isArray';
import React from 'react';

import IconButton from '../Button/IconButton';
import Tooltip from '../Tooltip';
import { CloseIcon } from '../icons';
import CrossBoundaryClassificationTag from '@/components/Convo/CrossBoundaryClassificationTag';
import { ChipItem } from '.';

import styles from './ChipInput.module.less';

interface ChipProps {
  value?: ChipItem | ChipItem[];
  removeLabel?: string;
  handleRemove?: (id: string) => void;
  children?: React.ReactNode;
}

const Chip = ({ value, removeLabel, handleRemove }: ChipProps) => {
  if (!value) return null;
  const chipArray = isArray(value) ? value : [value];
  const crossBoundaryChip = chipArray.some((c) => c.crossBoundary);
  return (
    <span className={clsx(styles.chip, { [styles.crossBoundaryChip]: crossBoundaryChip })}>
      {chipArray.map((c: ChipItem) => (
        <InnerChip key={c.id} removeLabel={removeLabel} handleRemove={() => handleRemove?.(c.id)}>
          {c.crossBoundary && <CrossBoundaryClassificationTag />}
          {c.label}
        </InnerChip>
      ))}
    </span>
  );
};

export default Chip;

type InnerChipProps = ChipProps & { handleRemove: () => void };

export const InnerChip: React.FC<InnerChipProps> = ({ removeLabel, handleRemove, children }) => (
  <span className={styles.entry}>
    {children}
    {removeLabel && (
      <Tooltip tip={removeLabel}>
        <IconButton className={styles.removeBtn} label={removeLabel} onClick={handleRemove}>
          <CloseIcon height="14px" width="14px" />
        </IconButton>
      </Tooltip>
    )}
  </span>
);
