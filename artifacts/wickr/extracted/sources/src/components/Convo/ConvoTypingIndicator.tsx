import { clsx } from 'clsx';
import React, { useMemo } from 'react';
import { useAppSelector } from '../../store';
import { selectActiveConvoTypingActivities } from '../../store/slices/uiChat';

import { useAppTranslation } from '@/lib/i18n';
import AppTrans from '@/lib/i18n/AppTrans';
import styles from './ConvoTypingIndicator.module.less';

const getMessageForActivity = (names: string[], activity: string): JSX.Element | undefined => {
  if (names.length === 1) {
    return (
      <AppTrans
        i18nKey="Conversations.TypingIndicator.Activity.Single"
        values={{ name: names[0], activity }}
      >
        <b></b>
      </AppTrans>
    );
  } else if (names.length === 2) {
    return (
      <AppTrans
        i18nKey="Conversations.TypingIndicator.Activity.Double"
        values={{ name1: names[0], name2: names[1], activity }}
      >
        <b></b>
        <b></b>
      </AppTrans>
    );
  }
};

const ConvoTypingIndicator: React.FC = () => {
  const { t } = useAppTranslation();
  const typingActivities = useAppSelector(selectActiveConvoTypingActivities);

  const typingTextElement = useMemo(() => {
    const typingUsers = typingActivities
      .filter((info) => info.activity === 'typing')
      .map((info) => info.name);
    const voiceUsers = typingActivities
      .filter((info) => info.activity === 'voice')
      .map((info) => info.name);

    const totalActivities = typingUsers.length + voiceUsers.length;
    const typingActivityText = t('Conversations.TypingIndicator.TypingText');
    const recordingActivityText = t('Conversations.TypingIndicator.RecordingVoice');
    const composingActivityText = t('Conversations.TypingIndicator.Composing');
    let element: JSX.Element | undefined;

    if (voiceUsers.length >= 1 && typingUsers.length >= 1 && totalActivities >= 3) {
      // when 3 or more people are sending user activity indicators
      // and at least 1 person is typing and at least 1 person is recording audio
      element = (
        <>
          {t('Conversations.TypingIndicator.Activity.Several', {
            activity: composingActivityText,
          })}
        </>
      );
    } else if (voiceUsers.length >= 3) {
      // at least 3 users are recording
      element = (
        <>
          {t('Conversations.TypingIndicator.Activity.Several', {
            activity: recordingActivityText,
          })}
        </>
      );
    } else if (typingUsers.length >= 3) {
      // at least 3 users are typing or recording or both
      element = (
        <>
          {t('Conversations.TypingIndicator.Activity.Several', {
            activity: typingActivityText,
          })}
        </>
      );
    } else {
      // at most 2 users are typing or recording or both
      const typingMessage = getMessageForActivity(typingUsers, typingActivityText);
      const voiceMessage = getMessageForActivity(voiceUsers, recordingActivityText);
      if (typingMessage && voiceMessage) {
        // one user is typing another one is recording audio
        element = <>{`${typingMessage} ${t('and')} ${voiceMessage}`}</>;
      } else {
        // only one user is typing or recording audio, or no typing activity
        element = typingMessage || voiceMessage || undefined;
      }
    }
    // always add 3 dots to the end if there are typing activities
    return element ? <>{element}...</> : undefined;
  }, [typingActivities]);

  return (
    <div className={clsx(styles.typingIndicatorContainer)}>
      {/* show a space to preserve the height in case there is no typing activity */}
      {typingTextElement ?? <span aria-hidden>&nbsp;</span>}
    </div>
  );
};

export default ConvoTypingIndicator;
