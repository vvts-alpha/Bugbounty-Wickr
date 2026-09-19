import { FC, FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import PageHeaderBackButton from '../Page/PageHeader/PageHeaderBackButton';
import { Button, FormField, Heading } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { generateSigninRoute } from '@/signin/routes';

import { selectRecoverYourAccountErrorMsg } from '@/signin/signinSelectors';
import { setRecoverYourAccountErrorMsg } from '@/signin/signinSlice';
import { verifyMasterRecoveryKey } from '@/signin/signinThunks';
import { useAppDispatch, useAppSelector } from '@/store';
import { pushModal } from '@/store/slices/modal';
import styles from './styles.module.less';

const RecoverYourAccount: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const [inputValue, setInputValue] = useState('');
  const navigate = useNavigate();
  const recoverYourAccountErrorMsg = useAppSelector(selectRecoverYourAccountErrorMsg);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const trimmedInputValue = inputValue.trim();

    dispatch(verifyMasterRecoveryKey(trimmedInputValue));
  };

  const handleResetAccount = () => {
    dispatch(pushModal('ResetAccountModal'));
  };

  return (
    <Page>
      <PageHeader>
        <PageHeaderBackButton
          onClick={() => {
            navigate(generateSigninRoute.continueWithoutTransferring());
          }}
        />
        <Heading level={1}>{t('Recover your account')}</Heading>
      </PageHeader>
      <PageBody>
        <p>
          {t(
            'Master recovery key is the only way to recover your account if you forgot your login credentials or if you cannot access your devices.'
          )}
        </p>
        <form onSubmit={handleSubmit}>
          <FormField
            fieldName="input"
            fieldProps={{
              showClear: false,
            }}
            label={t('Enter your master recovery key')}
            onChange={(event) => {
              dispatch(setRecoverYourAccountErrorMsg(null));
              setInputValue(event.target.value);
            }}
            value={inputValue}
            hasError={!!recoverYourAccountErrorMsg}
            errorContent={t(recoverYourAccountErrorMsg ?? 'Error')}
          />
          <p className={styles.resetAccountText}>
            {t(`Don't have the key?`)}{' '}
            {
              <Button className={styles.resetAccountButton} onClick={handleResetAccount}>
                {t('Reset account')}
              </Button>
            }
          </p>
          <Button color="primary" type="submit">
            {t('Recover')}
          </Button>
        </form>
      </PageBody>
    </Page>
  );
};

export default RecoverYourAccount;
