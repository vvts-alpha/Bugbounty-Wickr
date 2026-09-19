import { CaretIcon, ExternalLink, List, Modal, ModalBody, ModalHeader } from '@/componentlibrary';
import { AppTranslationKey, useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import { ReportedMetricName } from '@/lib/metrics/models';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectReportUserModalParams } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';

import styles from './styles.module.less';

const REPORT_USERS_REASONS = [
  'Spam/fraud',
  'Child exploitation/abuse',
  'Harrassment/bullying/threats',
  'Pretending to be someone else',
  'Other',
] satisfies AppTranslationKey[];
type Reason = (typeof REPORT_USERS_REASONS)[number];

export const createReportMetric = (reason: Reason) => {
  return `Report Reason - ${reason}` satisfies ReportedMetricName;
};

const ReportUserModal = () => {
  const { t } = useAppTranslation();
  const params = useAppSelector(selectReportUserModalParams);
  const dispatch = useAppDispatch();

  const handleClose = () => dispatch(closeModal('ReportUserModal'));

  const renderLink = (reason: Reason) => {
    const subject = `Report ${params.userId}`;
    const body = encodeURIComponent(`Report ${params.userId}${
      reason === 'Other' ? '' : ' for ' + reason
    }.
      \nOptionally, you can help us understand this problem better by sharing more information below:
      \n`);

    const handleClick = () => {
      metrics.addCount(createReportMetric(reason));
      handleClose();
    };

    return (
      <ExternalLink
        href={`mailto:wickr-abuse@amazon.com?body=${body}&subject=${subject}`}
        onClick={handleClick}
        className={styles.link}
        key={reason}
      >
        {t(reason)}
        <CaretIcon direction="right" />
      </ExternalLink>
    );
  };

  return (
    <Modal closeLabel={t('Close')} onClose={handleClose}>
      <ModalHeader title={t('Why are you reporting this?')} />
      <ModalBody className={styles.body}>
        {t(
          "Your conversations won't be shared with AWS Wickr and this contact won't be notified. You can email us to help us understand why this content is objectionable."
        )}
        <List className={styles.list}>
          {REPORT_USERS_REASONS.map((reason) => renderLink(reason))}
        </List>
      </ModalBody>
    </Modal>
  );
};

export default ReportUserModal;
