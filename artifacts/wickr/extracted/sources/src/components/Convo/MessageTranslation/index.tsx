import { clsx } from 'clsx';
import { FC, useMemo } from 'react';

import { Button, SpinnerIcon } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { WickrMessage } from '@/lib/protobuf/messages';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { translateMessage } from '@/store/thunks/translation';

import styles from './MessageTranslation.module.less';

interface MessageTranslationProps {
  message: WickrMessage;
}

const MessageTranslation: FC<MessageTranslationProps> = ({ message }) => {
  const { t, i18n } = useAppTranslation();
  const dispatch = useAppDispatch();
  const isTranslationAvailable = useSetting('isTranslationAvailable');

  const languageNames = useMemo(
    () =>
      new Intl.DisplayNames([i18n.language], {
        type: 'language',
      }),
    [i18n.language]
  );

  const handleRetry = () => {
    dispatch(
      translateMessage({
        vgroupId: message.vGroupID,
        messageId: message.msgId,
      })
    );
  };

  if (!isTranslationAvailable && !message?.msgTranslation && !message.msgTranslationPending)
    return null;

  const getMessageContent = () => {
    if (message.msgTranslationPending) {
      return <SpinnerIcon />;
    } else if (message.msgTranslation?.translationErrorId !== 0) {
      return (
        <Button color="secondaryRed" className={styles.errorMessage} onClick={handleRetry}>
          {t('MessageTranslation.MessageFailed')}
        </Button>
      );
    } else {
      return <div className={styles.translatedText}>{message.msgTranslation?.translatedText}</div>;
    }
  };

  return (
    <figure className={styles.messageTranslation}>
      <div
        className={clsx(styles.messageContainer, {
          [styles.withSpinner]: message.msgTranslationPending,
        })}
      >
        {getMessageContent()}
      </div>
      {message.msgTranslation?.sourceLanguage && (
        <figcaption>
          {t('MessageTranslation.TranslatedFrom', {
            sourceLanguage: languageNames.of(message.msgTranslation?.sourceLanguage),
          })}
        </figcaption>
      )}
    </figure>
  );
};

export default MessageTranslation;
