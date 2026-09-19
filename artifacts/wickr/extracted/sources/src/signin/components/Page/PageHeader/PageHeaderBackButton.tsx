import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';
import { Button, ArrowIcon } from '@/componentlibrary';
import { BaseProps } from '@/componentlibrary/Base';
import { useAppTranslation } from '@/lib/i18n';
import styles from '../styles.module.less';

interface PageHeaderBackButtonProps extends HTMLAttributes<HTMLButtonElement>, BaseProps {}

const PageHeaderBackButton: ReactFC<PageHeaderBackButtonProps> = ({ className, onClick }) => {
  const { t } = useAppTranslation();

  return (
    <Button onClick={onClick} wrapperClassName={clsx(styles.pageHeaderBackButton, className)}>
      <ArrowIcon direction="left" />
      <div>{t('Back')}</div>
    </Button>
  );
};

export default PageHeaderBackButton;
