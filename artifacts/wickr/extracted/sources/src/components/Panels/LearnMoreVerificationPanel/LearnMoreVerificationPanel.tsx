import { FC } from 'react';
import {
  CheckCircleFilledIcon,
  Heading,
  Panel,
  PanelBody,
  PanelHeader,
  ShieldIcon,
} from '@/componentlibrary';
import IcScanQrCodeSync from '@/components/IcScanQrCodeSync';
import IcShareCode from '@/components/IcShareCode';
import { useAppTranslation } from '@/lib/i18n';
import AppTrans from '@/lib/i18n/AppTrans';
import { useAppDispatch, useAppSelectorExtra } from '@/store';
import {
  clearPanelStack,
  LearnMoreVerificationPanelArgs,
  PANEL_SIDES,
  popPanel,
  selectIsActivePanel,
} from '@/store/slices/panels';

import styles from './styles.module.less';

export const LearnMoreVerificationPanel: FC<LearnMoreVerificationPanelArgs> = ({
  name,
  closeIcon,
}) => {
  const { t } = useAppTranslation();
  const side = PANEL_SIDES[name];
  const dispatch = useAppDispatch();
  const panelIsActive = useAppSelectorExtra(selectIsActivePanel, name);
  const handleOutsideClick = () => panelIsActive && dispatch(clearPanelStack());

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      onOutsideClick={handleOutsideClick}
      side={side}
      closeIcon={closeIcon}
    >
      <PanelHeader closeLabel={t('Close')} />
      <PanelBody className={styles.body}>
        <div>
          <Heading className={styles.title} level={2}>
            {t('In Person Verification')}
          </Heading>
          <IcScanQrCodeSync />

          <p className={styles.text}>
            <AppTrans i18nKey="On <0>my</0> device:">
              <span className={styles.boldItalic}></span>
            </AppTrans>
          </p>
          <p className={styles.subtext}>
            <AppTrans i18nKey="Click on the <0>QR Code</0> graphic to scan the QR Code on the other device.">
              <span className={styles.boldItalic}></span>
            </AppTrans>
          </p>
          <p className={styles.text}>
            <AppTrans i18nKey="On <0>their</0> device:">
              <span className={styles.boldItalic}></span>
            </AppTrans>
          </p>
          <p className={styles.subtext}>
            <AppTrans i18nKey="Have the other person click on <0>your Avatar</0>, then click on <1></1> <0>Security Verification</0> to display the <0>scannable QR Code</0>.">
              <span className={styles.boldItalic}></span>
              <ShieldIcon />
            </AppTrans>
          </p>
        </div>
        <div>
          <Heading className={styles.title} level={2}>
            {t('Remote Verification')}
          </Heading>
          <IcShareCode />
          <p className={styles.text}>
            <AppTrans i18nKey="On <0>my</0> device:">
              <span className={styles.boldItalic}></span>
            </AppTrans>
          </p>
          <p className={styles.subtext}>
            <AppTrans i18nKey="Click on <0>'Copy Code'</0> and send your <0>Verification Code</0> to the other device. You can also verbally compare your code with their code.">
              <span className={styles.boldItalic}></span>
            </AppTrans>
          </p>
          <p className={styles.text}>
            <AppTrans i18nKey="On <0>their</0> device:">
              <span className={styles.boldItalic}></span>
            </AppTrans>
          </p>
          <p className={styles.subtext}>
            <AppTrans i18nKey="Have the other person click on <0>your Avatar</0>, then click on <1></1> <0>Security Verification</0> to match the <0>Verification Code</0>, and ask them to share their code with you.">
              <span className={styles.boldItalic}></span>
              <ShieldIcon />
            </AppTrans>
          </p>
          <p className={styles.text}>
            <AppTrans i18nKey="If both parties' codes are identical, then select <0>'Verify'</0>.">
              <span className={styles.boldItalic}></span>
            </AppTrans>
          </p>
          <p className={styles.subtext}>
            <AppTrans i18nKey="A <0>checkmark</0> <1></1> will appear on your contact's verify screen and a <0>shield</0> <2></2> in conversation. The contact will remain verified unless the security code changes or you change the verification status.">
              <span className={styles.boldItalic}></span>
              <CheckCircleFilledIcon />
              <ShieldIcon />
            </AppTrans>
          </p>
        </div>
      </PanelBody>
    </Panel>
  );
};
