import { FC } from 'react';
import { Button, PrimaryButton } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';

import panelButtonStyles from './buttonStyles.module.less';

interface CancelRemoveButtonRowProps {
  onCancel: () => void;
  onRemove: () => void;
}

export const CancelRemoveButtonRow: FC<CancelRemoveButtonRowProps> = ({ onCancel, onRemove }) => {
  const { t } = useAppTranslation();

  return (
    <div className={panelButtonStyles.buttonRow}>
      <Button color="secondary" bordered onClick={onCancel}>
        {t('Cancel')}
      </Button>
      <PrimaryButton onClick={onRemove}>{t('Remove')}</PrimaryButton>
    </div>
  );
};
