import { ExternalLink, PanelOverlay } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setOverlay } from '@/store/slices/overlay';

import styles from './styles.module.less';

const shredderIntensityMap = {
  0: 'Off',
  20: 'Low',
  60: 'Medium',
  100: 'High',
};

const SecureShredderOverlay = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const shredderIntensity = useSetting('shredderIntensity');

  const intensityLabel = shredderIntensityMap[shredderIntensity];

  return (
    <PanelOverlay
      title={
        <span className={styles.header}>
          <span>{t('Secure Shredder')}</span>
          <ExternalLink
            className={styles.link}
            href="https://support.wickr.com/hc/en-us/articles/115004958407-What-does-the-Secure-Shredder-do"
          >
            {t('Learn More')}
          </ExternalLink>
        </span>
      }
      closeLabel={t('Back')}
      onClose={() => dispatch(setOverlay('PrivacyAndSafety'))}
    >
      <p className={styles.content}>
        {shredderIntensity === 0 ? (
          <>
            {t('Secure Shredder is turned off. Please contact your network admin for more info.')}
          </>
        ) : (
          <>
            {t(
              'Secure Shredder is turned on and it set to {{intensityLabel}} at {{shredderIntensity}} MB per minute.',
              { intensityLabel, shredderIntensity }
            )}
          </>
        )}
      </p>
    </PanelOverlay>
  );
};

export default SecureShredderOverlay;
