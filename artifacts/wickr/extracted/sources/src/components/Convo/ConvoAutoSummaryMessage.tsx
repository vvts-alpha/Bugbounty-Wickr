import clsx from 'clsx';
import { FC, HTMLProps, useState } from 'react';

import { SpinnerIcon } from '../../componentlibrary/icons/Spinner';
import { Logger } from '../../lib/logger';
import { WickrMessage } from '../../lib/protobuf/messages';
import { MarkdownText } from '../MarkdownText';
import { CaretIcon } from '@/componentlibrary/icons/Caret';

import styles from './ConvoAutoSummaryMessage.module.less';

const logger = new Logger('ConvoAutoSummaryMessage');

interface ConvoAutoSummaryMessageProps extends HTMLProps<HTMLElement> {
  message: WickrMessage;
}

const ConvoAutoSummaryMessage: FC<ConvoAutoSummaryMessageProps> = ({ message }) => {
  const [expanded, setExpanded] = useState(false);

  // Get summary content from the message
  const fullSummary = message.textContent;

  return (
    <div data-anchor-chat-bubble className={styles.card}>
      {/* Title + expand control */}
      <div className={styles.titleRow}>
        <div className={styles.title}>Summary of unread messages</div>

        <button
          type="button"
          aria-label={expanded ? 'Collapse summary' : 'Expand summary'}
          onClick={() => setExpanded(!expanded)}
          className={styles.expandButton}
        >
          {expanded ? (
            <CaretIcon direction="up" size={18} />
          ) : (
            <CaretIcon direction="down" size={18} />
          )}
        </button>
      </div>

      {/* Summary body */}
      {fullSummary ? (
        <MarkdownText
          className={clsx(styles.summary, !expanded && styles.summaryCollapsed)}
          text={fullSummary}
        />
      ) : (
        <SpinnerIcon className={styles.spinner} size={21} />
      )}
    </div>
  );
};

export default ConvoAutoSummaryMessage;
