import { useEffect } from 'react';
import SettingItem, { Divider } from '../SettingItem';
import { PanelOverlay, Toggle } from '@/componentlibrary';
import { SelectOption } from '@/componentlibrary/Select';
import AccessibleSelect from '@/componentlibrary/Select/AccessibleSelect';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { pushModal } from '@/store/slices/modal';
import { selectActiveOverlayParams } from '@/store/slices/overlay';
import { isTranslationLanguageCode, TRANSLATION_LANGUAGE_MODEL } from '@/store/slices/settings';
import { updateIsTranslationEnabled, updateLanguageCode } from '@/store/thunks/settings';

import styles from './styles.module.less';

const TranslationOverlay = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const isTranslationEnabled = useSetting('isTranslationEnabled');
  const languageCode = useSetting('languageCode');
  const directedFromMessages = useAppSelector(selectActiveOverlayParams)?.directedFromMessages;

  useEffect(() => {
    if (directedFromMessages && isTranslationEnabled) {
      dispatch(pushModal('TranslationIsEnabledModal'));
    }
  }, [directedFromMessages, isTranslationEnabled]);

  return (
    <PanelOverlay title={t('Translations')}>
      <SettingItem
        title={t('Translate messages')}
        description={t(
          'Messages received in other languages can be translated to your preferred language.'
        )}
      >
        <Toggle
          label={t('Translate messages')}
          onChange={() => dispatch(updateIsTranslationEnabled(!isTranslationEnabled))}
          checked={isTranslationEnabled}
        />
      </SettingItem>
      <SettingItem
        title={t('Translate to')}
        description={t(TRANSLATION_LANGUAGE_MODEL[languageCode])}
      >
        <Divider />
        <AccessibleSelect
          label={t('Language')}
          selectedOption={{
            value: languageCode,
            label: TRANSLATION_LANGUAGE_MODEL[languageCode],
          }}
          options={Object.keys(TRANSLATION_LANGUAGE_MODEL)
            .filter(isTranslationLanguageCode)
            .map((code) => ({
              label: t(TRANSLATION_LANGUAGE_MODEL[code]),
              value: code,
            }))}
          onChange={(value: SelectOption['value']) => {
            value = value.toString();
            if (isTranslationLanguageCode(value)) {
              dispatch(updateLanguageCode(value));
            }
          }}
          className={styles.selectContainer}
          menuClassName={styles.selectMenu}
          offset={[2, -2]}
        />
      </SettingItem>
    </PanelOverlay>
  );
};

export default TranslationOverlay;
