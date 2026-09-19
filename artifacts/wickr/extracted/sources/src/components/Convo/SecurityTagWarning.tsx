import { PrimaryButton, TagIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppSelector } from '@/store';
import { selectActiveConvoGuardText, selectActiveConvoGuardTagColor } from '@/store/slices/convos';

import styles from './SecurityTagWarning.module.less';

interface SecurityTagWarningProps {
  onClick: () => void;
}

const SecurityTagWarning: React.FC<SecurityTagWarningProps> = ({ onClick }) => {
  const { t } = useAppTranslation();

  const securityTagColor = useAppSelector(selectActiveConvoGuardTagColor);
  const securityTagName = useAppSelector(selectActiveConvoGuardText) || t('No priority tag set');

  return (
    <div className={styles.securityTagWarning}>
      <div className={styles.content}>
        <div className={styles.tagIcon} style={{ color: securityTagColor || '' }}>
          <TagIcon size="24px" filled />
        </div>
        <div>
          <div>
            {t('Members of this conversation may have a lower security level:')}
            <span className={styles.tagName}>{` ${securityTagName}`}</span>
          </div>
          <div>{t("Don't share any sensitive information in this room.")}</div>
        </div>
      </div>
      <PrimaryButton onClick={onClick} className={styles.button}>
        {t('New message')}
      </PrimaryButton>
    </div>
  );
};

export default SecurityTagWarning;
