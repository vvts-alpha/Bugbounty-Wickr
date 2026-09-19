import { clsx } from 'clsx';
import { Heading, Paragraph } from '@/componentlibrary';

import styles from './styles.module.less';

type Props = {
  title?: ReactJSXChild;
  description?: ReactJSXChild;
  className?: string;
};

export const SettingItem: ReactFC<Props> = ({ title, description, className, children }) => {
  return (
    // VoiceOver cannot read <li> tags in the QT WebEngine
    <div className={clsx(styles.settingItem, className)}>
      {(title || description) && (
        <div className={styles.titleAndDescription}>
          {title && (
            <Heading level={3} as="h2" className={styles.title}>
              {title}
            </Heading>
          )}
          {description && <Paragraph className={styles.description}>{description}</Paragraph>}
        </div>
      )}
      {children}
    </div>
  );
};

export const Divider = () => <div className={styles.divider} />;

export default SettingItem;
