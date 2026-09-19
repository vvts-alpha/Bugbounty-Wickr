import { FC, FormEvent, useState } from 'react';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, FormField, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';

import { selectSigninDisplayKey } from '@/signin/signinSelectors';
import { continueRegisterNewUser, showSaveFileDialog } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';
import { pushModal } from '@/store/slices/modal';
import styles from './styles.module.less';

const MasterRecoveryKey: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const [saveConfirmationChecked, setSaveConfirmationChecked] = useState(false);
  const [showErrorText, setShowErrorText] = useState(false);

  const recoveryKey = useAppSelector(selectSigninDisplayKey);

  const handleCheckboxChange = () => {
    if (!saveConfirmationChecked && showErrorText) {
      setShowErrorText(false);
    }

    setSaveConfirmationChecked(!saveConfirmationChecked);
  };

  // Formats key to have a space every 4 characters
  const formatKeyString = (key: string) => {
    return key.trim().replace(/(.{4})/g, '$1 ');
  };

  const handleDownloadClick = () => {
    dispatch(showSaveFileDialog());
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!saveConfirmationChecked) {
      setShowErrorText(true);
      return;
    } else {
      dispatch(continueRegisterNewUser());
    }
  };

  const handleBack = () => {
    dispatch(pushModal({ name: 'ResetAppModal', params: { variant: 'signin' } }));
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton onClick={handleBack} />
        <Heading level={1}>{t('Master recovery key')}</Heading>
      </PageHeader>
      <PageBody>
        <p>
          {t(
            'Master recovery key is the only way to recover your account if you forgot your login credentials or if you cannot access your devices.'
          )}
        </p>
        <div className={styles.keyInfoContainer}>
          <div className={styles.keyTextContainer}>{formatKeyString(recoveryKey)}</div>
          <Button className={styles.downloadButton} onClick={handleDownloadClick}>
            {t('Download')}
          </Button>
        </div>
        <form onSubmit={handleSubmit}>
          <FormField
            className={styles.saveConfirmation}
            fieldName="checkbox"
            fieldProps={{
              checked: saveConfirmationChecked,
            }}
            onChange={handleCheckboxChange}
            label={t(
              'I have saved this recovery key in a secure place. Without it, I will be unable to restore my account.'
            )}
          />
          {showErrorText && (
            <div className={styles.validationText}>{t('This field is required')}</div>
          )}
          <Button type="submit" color="primary">
            {t('Next')}
          </Button>
        </form>
      </PageBody>
    </Page>
  );
};

export default MasterRecoveryKey;
