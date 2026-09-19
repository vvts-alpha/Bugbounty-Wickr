import { clsx } from 'clsx';
import React from 'react';
import useConst from '@/hooks/useConst';
import { useAppTranslation } from '@/lib/i18n';
import AppTrans from '@/lib/i18n/AppTrans';
import { isLinux, isMac } from '@/utils/platform';

import styles from './NewLineHint.module.less';

interface NewLineHintProps {
  visible: boolean;
}
export const NewLineHint: React.FC<NewLineHintProps> = ({ visible }) => {
  const { t } = useAppTranslation();
  const shortcutText = useConst(() => {
    if (isMac()) {
      return t('Compose.NewLineHint.Shortcut.MacOS');
    } else if (isLinux()) {
      return t('Compose.NewLineHint.Shortcut.Linux');
    }
    return t('Compose.NewLineHint.Shortcut.Windows');
  });
  return (
    <span
      className={clsx(styles.newLineHint, {
        [styles.hidden]: !visible,
      })}
    >
      <AppTrans i18nKey="Compose.NewLineHint" values={{ shortcut: shortcutText }}>
        <b></b>
      </AppTrans>
    </span>
  );
};
