import { clsx } from 'clsx';
import React from 'react';
import { ScreenReaderContent, Tooltip } from '@/componentlibrary';
import { raw } from '@/utils/strings';

import styles from './CrossBoundaryClassificationTag.module.less';

type Props = { className?: string };

const CrossBoundaryClassificationTag: React.FC<Props> = ({ className }) => {
  return (
    <>
      <Tooltip tip={raw('Unclassified')}>
        <div className={clsx(styles.tag, className)}>
          {/* "U" (for "Unclassified") below has specific meaning in US GovCloud space and should not be translated */}
          <abbr>U</abbr>
        </div>
      </Tooltip>
      <ScreenReaderContent>{raw('Unclassified')}</ScreenReaderContent>
    </>
  );
};

export default CrossBoundaryClassificationTag;
