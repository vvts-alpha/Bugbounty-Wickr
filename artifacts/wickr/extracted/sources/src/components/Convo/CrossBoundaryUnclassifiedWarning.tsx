import { PrimaryButton } from '@/componentlibrary';
import { raw } from '@/utils/strings';

import styles from './CrossBoundaryUnclassifiedWarning.module.less';

interface CrossBoundaryUnclassifiedWarningProps {
  onClick: () => void;
}

const CrossBoundaryUnclassifiedWarning: React.FC<CrossBoundaryUnclassifiedWarningProps> = ({
  onClick,
}) => {
  return (
    <div className={styles.crossBoundaryUnclassifiedWarning}>
      <div className={styles.text}>
        <div className={styles.title}>{raw('Unclassified')}</div>
        <div className={styles.description}>
          {raw(
            "Members of this conversation may have a lower security level. Don't share any sensitive information in this room."
          )}
        </div>
      </div>
      <PrimaryButton onClick={onClick} className={styles.button}>
        {raw('I understand')}
      </PrimaryButton>
    </div>
  );
};

export default CrossBoundaryUnclassifiedWarning;
