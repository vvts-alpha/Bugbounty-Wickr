import { ContactBackup } from '@amzn/wickr-messaging-protocol-proto';
import clsx from 'clsx';
import { FC } from 'react';
import { Button, PrimaryButton } from '@/componentlibrary';
import { LearnMoreVerificationButton } from '@/components/Panels/VerifyContactPanel/VerifyContactPanel';
import { useAppTranslation } from '@/lib/i18n';
import AppTrans from '@/lib/i18n/AppTrans';
import { useAppDispatch, useAppSelector } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { useUser } from '@/store/hooks/useUsers';
import { selectSelfUserIdHash } from '@/store/slices/identity';
import { popPanel } from '@/store/slices/panels';
import { VerificationFingerprint, verifyUser } from '@/store/thunks/users';
import { copyTextToClipboard } from '@/utils/strings';

import styles from './styles.module.less';

type Props = {
  fingerprint?: VerificationFingerprint;
  userIdHash: string;
};

const SecurityCode: FC<Props> = ({ fingerprint, userIdHash }) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const abortableDispatch = useAbortableDispatch();
  const selfUserHashId = useAppSelector(selectSelfUserIdHash);
  const isSelf = userIdHash === selfUserHashId;
  const contact = useUser(userIdHash);
  const isVerified =
    contact?.verificationStatus === ContactBackup.Contact.VerificationStatus.VERIFIED;

  const copySecurityCode = async () => {
    if (!fingerprint?.securityCode) return;
    copyTextToClipboard(fingerprint.securityCode);
  };

  const handleVerifyUser = async () => {
    const shouldPopPanel = !isVerified;
    try {
      await abortableDispatch(
        verifyUser({
          userId: contact?.id ?? '',
          verify: !isVerified,
          shownCode: fingerprint?.securityCode,
        })
      );
      if (shouldPopPanel) dispatch(popPanel()); // Only pop panel when clicking "Verify"
    } catch {
      // no-op
    }
  };

  return (
    <>
      <div className={styles.securityCode}>{fingerprint?.securityCode}</div>
      {isSelf ? (
        <p className={styles.selfInstructions}>
          {t(
            'Start a video call to verbally compare codes. You can also select “Copy Code” to copy the security code to your clipboard and share it with your contact via an alternate trusted method of communication (e.g., email).'
          )}
        </p>
      ) : (
        <>
          <p className={styles.othersInstructions}>
            <AppTrans
              i18nKey="Compare the security code above with the security code on your contact's device to verify the security of your end to end encryption with <0>{{ email }}</0>."
              values={{ email: contact?.id }}
            >
              <span className={styles.email}></span>
            </AppTrans>
            {!isVerified && <> {t("Click 'Verify' if the security codes match.")}</>}
          </p>
          <PrimaryButton
            wrapperClassName={styles.verifyBtnWrapper}
            className={clsx(styles.verifyBtn)}
            onClick={handleVerifyUser}
            label={t(isVerified ? 'Unverify' : 'Verify')}
          >
            {t(isVerified ? 'Unverify' : 'Verify')}
          </PrimaryButton>
          <LearnMoreVerificationButton />
        </>
      )}
      <Button
        shape="rounded"
        className={styles.copyBtn}
        wrapperClassName={styles.copyBtnWrapper}
        onClick={copySecurityCode}
      >
        {t('Copy code')}
      </Button>
    </>
  );
};

export default SecurityCode;
