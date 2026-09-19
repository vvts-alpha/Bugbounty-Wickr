import { clsx } from 'clsx';
import { FC } from 'react';
import { wickrWebEndpoints } from '@/apis/webFetch/endpoints';
import { Button, DocumentIcon, StarIcon } from '@/componentlibrary';
import { MarkdownText } from '@/components/MarkdownText';
import SafeImage from '@/components/SafeImage';
import { WickrMessageMentions } from '@/lib/protobuf/messages';

import styles from './styles.module.less';

interface Props {
  /** To be displayed at the top of the component */
  title: string;
  /** To be displayed below the title */
  description: string;
  /** To be displayed below the description */
  content: string;
  /** Any mentions that come with the content */
  mentions?: WickrMessageMentions;
  timestamp: string;
  vGroupId: string;
  msgId: string;
  isStarred?: boolean;
  /** File extension name of the attachment. Used to render file icon or image. */
  attachmentType?: string;
  onClick?: () => void;
  searchInputValue?: string;
}
const imageTypes = ['JPG', 'PNG', 'GIF'];
export const MessageSearchListItem: FC<Props> = ({
  title,
  description,
  content,
  mentions,
  timestamp,
  vGroupId,
  msgId,
  isStarred,
  attachmentType,
  onClick,
  searchInputValue,
}) => {
  const isImageAttachment = attachmentType && imageTypes.includes(attachmentType);
  let imgSrc: string | undefined;
  try {
    if (isImageAttachment) imgSrc = wickrWebEndpoints.messageImage(vGroupId, msgId);
  } catch {
    // vGroupId may be undefined
    // Need to catch until root cause is fixed: https://sim.amazon.com/issues/Wickr-14009
  }

  return (
    <Button className={styles.btn} onClick={onClick}>
      <div className={styles.mainContainer}>
        <div className={styles.titleContainer}>
          <p className={styles.title}>{title}</p>
          {isStarred && <StarIcon className={styles.starIcon} filled />}
        </div>
        <div className={styles.description}>
          <span>{description}</span>
          <span>{timestamp}</span>
        </div>
        <div
          className={clsx(styles.content, {
            [styles.fileContent]: !!attachmentType,
            [styles.withAttachment]: !!attachmentType,
          })}
        >
          {isImageAttachment ? (
            <SafeImage
              wrapperClassName={styles.imageWrapper}
              className={styles.image}
              src={imgSrc}
              loading={'delay'}
              minWidth={50}
              maxWidth={50}
              maxHeight={50}
            />
          ) : (
            attachmentType && <DocumentIcon size="56px" fileExt={attachmentType.toLowerCase()} />
          )}
          <p className={clsx(styles.content, { [styles.fileContent]: !!attachmentType })}>
            <MarkdownText text={content} mentions={mentions} textToHighlight={searchInputValue} />
          </p>
        </div>
      </div>
    </Button>
  );
};
