import { ExternalLink } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import styles from './styles.module.less';

const AgreementText: ReactFC = () => {
  const { t } = useAppTranslation();
  return (
    <div className={styles.agreementText}>
      {t('By using AWS Wickr, you agree to the')}{' '}
      {
        <ExternalLink href="https://aws.amazon.com/agreement/">
          {t('AWS Customer Agreement')}
        </ExternalLink>
      }{' '}
      {t('and')}{' '}
      {
        <ExternalLink href="https://aws.amazon.com/privacy/">
          {t('AWS Privacy Notice.')}
        </ExternalLink>
      }
    </div>
  );
};

export default AgreementText;
