import { FormEvent, useMemo, useState } from 'react';
import {
  Button,
  CautionIcon,
  Checkbox,
  ExternalLink,
  FormField,
  List,
  ListItem,
  ModalButtonGroup,
  PanelOverlay,
} from '@/componentlibrary';
import {
  COUNTLY_SSO_ACCOUNT_DELETION_SURVEY_QUESTIONS,
  COUNTLY_SSO_ACCOUNT_DELETION_SURVEY_WIDGET_ID,
} from '@/components/constants/countly';
import { AppTranslationKey, useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import { SurveyMetricAttributes } from '@/lib/metrics/models';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setOverlay } from '@/store/slices/overlay';
import { selectAppStage } from '@/store/slices/settings';
import { attemptSsoTerminateAccount } from '@/store/thunks/identity';
import { openAlertModal } from '@/store/thunks/modals';
import { getPlatform } from '@/utils/platform';

import styles from './styles.module.less';

const BASE_REASONS: AppTranslationKey[] = [
  "It's missing important features",
  'I need help to better use Wickr',
  "I'm not satisfied with the product quality",
  'I have privacy/security concerns',
];
const OTHER: AppTranslationKey = 'Other';

// make sure other is last
const REASONS_FOR_LEAVING = [...BASE_REASONS, OTHER];
const OTHER_INDEX = BASE_REASONS.length;

type LinkObject = {
  text: AppTranslationKey;
  link: string;
};

const MAX_OTHER_REASON_LENGTH = 10_000;

const links: LinkObject[] = [
  {
    text: 'Privacy concerns common questions',
    link: 'https://support.wickr.com/hc/en-us/sections/115001470407-Privacy-Concerns',
  },
  {
    text: 'Secure communications 101',
    link: 'https://wickr.com/secure-communications-101-and-beyond-the-basics',
  },
  {
    text: 'Evaluate your secure communications',
    link: 'https://wickr.com/how-to-evaluate-if-your-secure-communications-strategy-is-effective',
  },
  {
    text: 'Data protection strategy',
    link: 'https://wickr.com/components-of-an-effective-data-protection-strategy',
  },
];
export const CloseAccountOverlay = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const [selectedReasons, setSelectedReasons] = useState(
    new Array<boolean>(REASONS_FOR_LEAVING.length).fill(false)
  );
  const [otherReason, setOtherReason] = useState('');
  // step 0 is the survey, step 1 is where the user can click close
  const [step, setStep] = useState(0);
  const isAlpha = useSetting('isAlpha');
  const isBeta = useSetting('isBeta');
  const isPro = useSetting('isPro');
  const appName = useMemo(() => {
    // all are pro because we check isPro before sending metrics
    if (isAlpha) return 'Wickr Pro Alpha';
    if (isBeta) return 'Wickr Pro Beta';
    return 'Wickr Pro';
  }, [isAlpha, isBeta]);
  const appVersion = useSetting('appVersion');
  const stage = useAppSelector(selectAppStage);
  const countlySSOAccountDeletionSurveyWidgetID =
    COUNTLY_SSO_ACCOUNT_DELETION_SURVEY_WIDGET_ID[stage];
  const countlySSOAccountDeletionSurveyQuestions =
    COUNTLY_SSO_ACCOUNT_DELETION_SURVEY_QUESTIONS[stage];

  const toggleSelectedReason = (index: number) => {
    const reasonsCopy = [...selectedReasons];
    reasonsCopy[index] = !reasonsCopy[index];
    setSelectedReasons(reasonsCopy);
  };

  const getMCSegmentation = () => {
    const mcAnsw = [];
    for (let i = 0; i < selectedReasons.length - 1; i++) {
      if (selectedReasons[i]) {
        mcAnsw.push(`ch${countlySSOAccountDeletionSurveyQuestions}-${i}`);
      }
    }
    return mcAnsw.join(',');
  };

  const handleCloseAccountClicked = async () => {
    const success = await dispatch(attemptSsoTerminateAccount()).unwrap();
    if (!success) {
      dispatch(
        openAlertModal({
          title: t('Failed to terminate account.'),
          body: t('Failed to terminate account.'),
        })
      );
    } else {
      // send metrics if needed
      if (isPro) {
        if (selectedReasons.includes(true)) {
          // send countly metric for leave reason. IMPORTANT: this will show up under reach->feedback->SURVEYS **NOT** EVENTS!
          const segmentation: SurveyMetricAttributes = {
            app_name: appName,
            app_version: appVersion,
            os: getPlatform(),
            platform: 'Desktop',
            webViewVersion: __COMMIT_ID__,
            widget_id: countlySSOAccountDeletionSurveyWidgetID,
            [`answ-${countlySSOAccountDeletionSurveyQuestions}-0`]: getMCSegmentation(),
          };
          if (selectedReasons[OTHER_INDEX]) {
            segmentation[`answ-${countlySSOAccountDeletionSurveyQuestions}-1`] = otherReason;
          }
          metrics.addMetrics('[CLY]_survey', { count: 1, segmentation });
        }
        const segmentation = {
          app_name: appName,
          app_version: appVersion,
          os: getPlatform(),
        };
        metrics.addMetrics('SSO Account Closed', { count: 1, segmentation });
      }
    }
  };

  return (
    <PanelOverlay
      onClose={() => dispatch(setOverlay('Support'))}
      closeLabel={t('Back')}
      title={t('Close Your Account')}
    >
      <div className={styles.container}>
        {step == 0 ? (
          <>
            <p>{t('Help us improve by telling us why you are leaving')}</p>
            <form>
              <p>
                <b>{t('Reason for leaving AWS Wickr (optional):')}</b>
              </p>
              {REASONS_FOR_LEAVING.map((reason, index) => (
                <div
                  className={styles.checkboxRow}
                  key={index}
                  onClick={() => {
                    toggleSelectedReason(index);
                  }}
                >
                  <Checkbox
                    aria-label={t(reason)}
                    checked={selectedReasons[index]}
                    className={styles.checkbox}
                  />
                  {t(reason)}
                </div>
              ))}
              {selectedReasons[OTHER_INDEX] && (
                <FormField
                  fieldName="textarea"
                  fieldProps={{
                    maxLength: MAX_OTHER_REASON_LENGTH,
                  }}
                  label={t('Other')}
                  onChange={(e) => setOtherReason(e.target.value)}
                  value={otherReason}
                  className={styles.otherReason}
                />
              )}
              <ModalButtonGroup className={styles.buttonGroup}>
                <Button onClick={() => dispatch(setOverlay('Support'))} bordered>
                  {t('Cancel')}
                </Button>
                <Button
                  color="primary"
                  onClick={(e: FormEvent) => {
                    e.preventDefault();
                    setStep(1);
                  }}
                  type="submit"
                >
                  {t('Continue')}
                </Button>
              </ModalButtonGroup>
            </form>
          </>
        ) : (
          <>
            <p>
              {t(
                'This is a permanent action. It will delete your Wickr account and reset the application. Closing your account will permanently remove all of your data, including your message history and account info.'
              )}
            </p>
            <p>{t('You will not be able to recover your data after closing your account.')}</p>
            <List>
              {links.map((link, index) => (
                <ListItem className={styles.link} key={index}>
                  <ExternalLink href={link.link} showExternalLinkIcon>
                    {t(link.text)}
                  </ExternalLink>
                </ListItem>
              ))}
            </List>
            <ModalButtonGroup className={styles.buttonGroup}>
              <Button onClick={() => dispatch(setOverlay('Support'))} bordered>
                {t('Cancel')}
              </Button>
              <Button color="primary" onClick={handleCloseAccountClicked}>
                <CautionIcon />
                {t('Close Account')}
              </Button>
            </ModalButtonGroup>
          </>
        )}
      </div>
    </PanelOverlay>
  );
};

export default CloseAccountOverlay;
