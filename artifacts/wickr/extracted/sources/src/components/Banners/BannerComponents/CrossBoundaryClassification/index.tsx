import { FC } from 'react';
import { InformationIcon, IconButton, Banner } from '@/componentlibrary';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveConvoCrossBoundary } from '@/store/slices/convos';
import { openLink } from '@/store/thunks/ui';
import { raw } from '@/utils/strings';

import styles from './styles.module.less';

const crossBoundaryInfoUrl =
  'https://docs.aws.amazon.com/govcloud-us/latest/UserGuide/govcloud-wickr.html';

const CrossBoundaryClassification: FC = () => {
  const dispatch = useAppDispatch();
  const crossBoundary = useAppSelector(selectActiveConvoCrossBoundary);

  if (!crossBoundary) return null;

  const handleClick = () => {
    dispatch(openLink({ link: crossBoundaryInfoUrl, showConfirmation: true }));
  };

  return (
    <Banner className={styles.modTip}>
      {raw('Unclassified')}
      <IconButton label={raw('Unclassified')} onClick={handleClick}>
        <InformationIcon />
      </IconButton>
    </Banner>
  );
};

export default CrossBoundaryClassification;
