import clsx from 'clsx';
import { Button, CodeIcon } from '@/componentlibrary';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectActiveConvoIsMLS } from '@/store/slices/convos';
import { selectActiveConvoId } from '@/store/slices/shared';
import { mlsAction } from '@/store/thunks/convos';
import { raw } from '@/utils/strings';

import panelButtonStyles from '../Panels/buttonStyles.module.less';

/**
 * @component MlsMigrationPanelButton
 * @description FOR DEVELOPMENT PURPOSES ONLY. This component provides functionality to upgrade or downgrade
 * conversations between MLS and Legacy protocols. This should not be exposed to customers in production builds.
 * @internal
 */
const MlsMigrationPanelButton = () => {
  const dispatch = useAppDispatch();
  const convoId = useAppSelector(selectActiveConvoId);
  const isMLS = useAppSelector(selectActiveConvoIsMLS);

  const handleMlsMigrationClick = async () => {
    if (isMLS) {
      dispatch(mlsAction({ action: 'mlsChatDowngrade', vgroupId: convoId }));
    } else {
      dispatch(mlsAction({ action: 'mlsChatUpgrade', vgroupId: convoId }));
    }
  };

  return (
    <Button
      className={clsx(panelButtonStyles.fullWidthButton, panelButtonStyles.spaceBetween)}
      onClick={handleMlsMigrationClick}
    >
      <div className={panelButtonStyles.rowWithGap}>
        <CodeIcon size="20px" />
        {isMLS ? raw('Downgrade chat to Legacy (dev only)') : raw('Upgrade chat to MLS (dev only)')}
      </div>
    </Button>
  );
};

export default MlsMigrationPanelButton;
