import { ConvoCollection } from '@amzn/wickr-messaging-protocol-proto';
import { clsx } from 'clsx';
import { useMemo } from 'react';
import { Emojify } from '../Emojify';
import { List, SpinnerIcon, Tooltip } from '@/componentlibrary';
import usePrevious from '@/hooks/usePrevious';
import { useAppTranslation } from '@/lib/i18n';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { WickrReaction } from '@/lib/protobuf/messages';
import { useAppSelector, useAppSelectorExtra } from '@/store';
import { selectSelfUserIdHash } from '@/store/slices/identity';
import { selectUsersByIdHashes } from '@/store/slices/users';
import { getContactDisplayName } from '@/utils/strings';
import {
  addReactionLoading,
  removeReactionLoading,
  useCurrentMessageSharedState,
} from './ConvoMessage/CurrentMessageContext';

import styles from './Convo.module.less';

interface MessageReactionsProps {
  reactions: WickrReaction[];
  maxWidth: number;
  convoType?: ConvoCollection.ConvoMeta.ConvoType;
  onEmojiReaction: (emoji: string) => Promise<boolean>;
  onShowMore: () => void;
}

const MAX_TOOLTIP_NAME_COUNT = 15;
const MAX_REACTION_LABEL_COUNT = 99;
const REACTION_WIDTH_WITH_COUNT = 56;
const REACTION_WIDTH_WITHOUT_COUNT = 30;
const SHOW_MORE_BUTTON_WIDTH = 64;

const MessageReactions = ({
  reactions,
  maxWidth,
  convoType,
  onEmojiReaction,
  onShowMore,
}: MessageReactionsProps) => {
  const { t } = useAppTranslation();
  const userIds = useMemo(() => {
    return reactions.flatMap((reaction) => reaction.userIDs).filter(Boolean);
  }, [reactions]);
  const users = useAppSelectorExtra(selectUsersByIdHashes, userIds);
  const myId = useAppSelector(selectSelfUserIdHash);
  const [{ reactionsLoading }, messageStateDispatch] = useCurrentMessageSharedState();
  // computedReactions are the combination of reactions and the reactionsLoading
  // Purpose is to properly show when reactions are loading, while awaiting reactions to update from the Qt
  const computedReactions = useMemo(() => {
    // First, get all the loading reactions ids and remove any duplicates found in the existing reactions array
    const set = new Set(Object.keys(reactionsLoading));
    reactions.forEach((r) => set.delete(r.identifier));
    const newRxns = [...reactions];
    set.forEach((rxn) => {
      // If it's awaiting to be removed, reaction should still exist in the list
      // w/ the selfUserId in the reactions.userIDs list.
      if (reactionsLoading[rxn] === 'removing') return;

      // Append a new reaction obj if a loading reaction doesn't yet exist in the reactions array.
      newRxns.push({
        identifier: rxn,
        userIDs: [myId],
      });
    });
    return newRxns;
  }, [reactions, reactionsLoading]);

  const selfReacted = (reaction: WickrReaction): boolean => reaction.userIDs.includes(myId);

  const handleClick = async (reaction: WickrReaction) => {
    if (reactionsLoading[reaction.identifier]) return;
    messageStateDispatch(
      addReactionLoading({
        reactionId: reaction.identifier,
        selfUserId: myId,
      })
    );
    if (!(await onEmojiReaction(reaction.identifier))) {
      messageStateDispatch(removeReactionLoading(reaction.identifier));
    }
  };

  const maxReactions = useMemo(() => {
    const reactionWidth =
      convoType === ConvoCollection.ConvoMeta.ConvoType.DM
        ? REACTION_WIDTH_WITHOUT_COUNT
        : REACTION_WIDTH_WITH_COUNT;

    const shouldRenderShowMoreButton =
      computedReactions.length * reactionWidth > maxWidth - SHOW_MORE_BUTTON_WIDTH;

    const otherContentWidth = shouldRenderShowMoreButton ? SHOW_MORE_BUTTON_WIDTH : 0;

    return Math.ceil((maxWidth - otherContentWidth) / reactionWidth);
  }, [convoType, computedReactions.length, maxWidth]);

  const previousReactions = usePrevious(new Set(computedReactions?.map((r) => r.identifier)));

  return (
    <List className={clsx(styles.reactionsContainer, 'notSelectable')}>
      {computedReactions?.map((reaction, idx) => {
        if (computedReactions.length > maxReactions) {
          if (idx === maxReactions - 1) {
            const showMoreTip = `${(computedReactions.length - maxReactions + 1).toString()} ${t(
              'Conversations.ShowMoreReactions'
            )}`;
            // VoiceOver cannot read <li> tags in the QT WebEngine
            return (
              <Tooltip tip={showMoreTip} key={idx}>
                <div>
                  <button
                    className={clsx(styles.reactionBtn, styles.showMore)}
                    onClick={onShowMore}
                  >
                    <span>{`${(computedReactions.length - maxReactions + 1 <=
                    MAX_REACTION_LABEL_COUNT
                      ? computedReactions.length - maxReactions + 1
                      : `${MAX_REACTION_LABEL_COUNT}+`
                    ).toString()} ${t('Conversations.More')}`}</span>
                  </button>
                </div>
              </Tooltip>
            );
          } else if (idx >= maxReactions) {
            return null;
          }
        }

        // remove any missing names
        const filteredNames = reaction.userIDs
          .map((id) => {
            const name = getContactDisplayName(users.find((u) => u.idHash === id));
            return id === myId ? '' : name;
          })
          .filter((n): n is string => !!n);

        const names = filteredNames.sort().slice(0, MAX_TOOLTIP_NAME_COUNT);

        if (selfReacted(reaction)) {
          names.unshift(t('Conversations.You'));
        }

        if (filteredNames.length > MAX_TOOLTIP_NAME_COUNT) {
          const extraNamesCount = filteredNames.length - MAX_TOOLTIP_NAME_COUNT;
          names.push(t('Conversations.Other', { count: extraNamesCount }));
        }

        const namesList = t('Intl.List', { val: names });

        const tip = `${namesList} ${t('Conversations.Reacted')}`;

        const label = `${tip} ${t('Conversations.With')} ${reaction.identifier}`;

        let reactionCount: string | number = selfReacted(reaction)
          ? filteredNames.length + 1
          : filteredNames.length;
        reactionCount <= MAX_REACTION_LABEL_COUNT
          ? reactionCount
          : (reactionCount = `${MAX_REACTION_LABEL_COUNT}+`);

        const isLoading = !!reactionsLoading[reaction.identifier];
        const shouldDisplayCount = convoType !== WickrConvoType.DM || isLoading;

        // VoiceOver cannot read <li> tags in the QT WebEngine
        return (
          <Tooltip tip={tip} key={reaction.identifier}>
            <div>
              <button
                aria-label={label}
                className={clsx(styles.reactionBtn, {
                  [styles.outgoingReaction]: false,
                  [styles.dmReaction]: convoType === WickrConvoType.DM && !isLoading,
                  [styles.selfReacted]: selfReacted(reaction),
                  [styles.newReaction]:
                    previousReactions && !previousReactions.has(reaction.identifier),
                })}
                onClick={() => handleClick(reaction)}
                aria-disabled={isLoading}
              >
                <Emojify className={styles.reactionEmoji}>{reaction.identifier}</Emojify>
                {shouldDisplayCount && (
                  <span className={styles.reactionCount}>
                    {isLoading ? <SpinnerIcon /> : reactionCount}
                  </span>
                )}
              </button>
            </div>
          </Tooltip>
        );
      })}
    </List>
  );
};

export default MessageReactions;
