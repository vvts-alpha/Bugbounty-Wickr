import { clsx } from 'clsx';
import { FC, FormEvent, useEffect, useMemo, useState } from 'react';
import Page from '../Page';
import PageBody from '../Page/PageBody';
import PageHeader from '../Page/PageHeader';
import SeparatorText from '../Page/SeparatorText';
import {
  Button,
  CancelIcon,
  Checkbox,
  ExternalLink,
  FormField,
  Heading,
  IconButton,
  LinkIcon,
  PopOutIcon,
  PrimaryButton,
  UploadFileSuccessIcon,
  UploadIcon,
} from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';

import { loadBootstrapFile } from '@/signin/signinThunks';
import { useAppDispatch } from '@/store';
import { showOpenDialog } from '@/store/thunks/files';
import styles from './styles.module.less';

type file = {
  name: string;
  hasPassword: boolean;
};

// TODO: Implement signin API functionality, validation and routing
// TODO: Implement drag and drop on the Config container (react-dnd)
const EnterpriseConfigure: FC = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const [inputValue, setInputValue] = useState('');
  const [configIcon, setConfigIcon] = useState(<UploadIcon className={styles.svg} size="24" />);
  const [configText, setConfigText] = useState('');
  const [showInputPassword, setShowInputPassword] = useState(false);

  // TODO: Placeholder, replace when API is ready to implement
  const configuredWithDeeplink = false;
  const deeplinkHasPassword = configuredWithDeeplink && true;

  const [file, setFile] = useState<file | null>(null);
  const hasConfig = useMemo(() => configuredWithDeeplink || file, [configuredWithDeeplink, file]);

  useEffect(() => {
    if (configuredWithDeeplink) {
      setConfigText(t('Configured with deeplink'));
      setConfigIcon(<LinkIcon className={styles.configIcon} size="24" />);
      return;
    } else if (file) {
      const name = file.name.split('/').pop();
      setConfigText(name || '');
      setConfigIcon(<UploadFileSuccessIcon className={styles.configIcon} size="24" />);
      return;
    }
  }, [configuredWithDeeplink, file]);

  const handleShowInputPasswordCheck = () => {
    setShowInputPassword(!showInputPassword);
  };

  const handleConfigButtonClick = async () => {
    await dispatch(showOpenDialog())
      .unwrap()
      .then((file) => {
        if (file) {
          setFile({ name: file, hasPassword: true });
        } else {
          // User canceled upload file selection
        }
      });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    dispatch(loadBootstrapFile({ fileName: `file://${file?.name}`, passPhrase: inputValue }));
  };

  return (
    <Page>
      <PageHeader>
        <Heading level={1}>{t('Configure your account')}</Heading>
      </PageHeader>
      <PageBody>
        {!configuredWithDeeplink && (
          <>
            <p>
              {t(
                'Configure Wickr enterprise with the deeplink provided by your network administrator.'
              )}{' '}
              <ExternalLink href="https://wickr.com/compliance">
                {t('Learn more')} <PopOutIcon />
              </ExternalLink>
            </p>
            <SeparatorText text={t('or')} />
          </>
        )}
        <form className={styles.configForm} onSubmit={handleSubmit}>
          {hasConfig ? (
            <div
              className={clsx(styles.configContainer, {
                [styles.hasConfig]: hasConfig,
              })}
            >
              <div className={styles.leftEl}>{configIcon}</div>
              {<div className={styles.configTextContainer}>{configText}</div>}

              {hasConfig && (
                <div className={styles.rightEl}>
                  <IconButton label={t('Cancel')} onClick={() => setFile(null)}>
                    <CancelIcon />
                  </IconButton>
                </div>
              )}
            </div>
          ) : (
            <PrimaryButton onClick={handleConfigButtonClick}>
              {t('Configure your account')}
            </PrimaryButton>
          )}

          {(file?.hasPassword || deeplinkHasPassword) && (
            <FormField
              className={styles.passwordInput}
              fieldName="input"
              fieldProps={{
                showClear: false,
                type: showInputPassword ? 'text' : 'password',
              }}
              label={t('Configuration file password')}
              onChange={(event) => {
                setInputValue(event.target.value);
              }}
              value={inputValue}
              infoContent={
                <span className={styles.checkboxLabel}>
                  <Checkbox
                    aria-label={t('Show password')}
                    onChange={handleShowInputPasswordCheck}
                    checked={showInputPassword}
                  />
                  {t('Show password')}
                </span>
              }
            />
          )}
          {hasConfig && (
            <Button type="submit" className={styles.ssoButton} color="primary">
              {t('Continue')}
            </Button>
          )}
        </form>
      </PageBody>
    </Page>
  );
};

export default EnterpriseConfigure;
