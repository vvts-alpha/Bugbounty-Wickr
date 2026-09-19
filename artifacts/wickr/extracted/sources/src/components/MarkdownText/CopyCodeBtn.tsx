import { CopyIcon, IconButton } from '@/componentlibrary';

import { raw } from '@/utils/strings';
import styles from './MarkdownText.module.less';

interface CopyCodeBtnProps {
  text?: string;
}

export const CopyCodeBtn: ReactFC<CopyCodeBtnProps> = ({ text }) => {
  return (
    <IconButton label={raw('Copy code')} className={styles.copyCodeBtn} data-copy-code-value={text}>
      <CopyIcon />
    </IconButton>
  );
};
