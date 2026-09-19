import { useMemo, useState } from 'react';
import {
  List,
  Modal,
  ModalBody,
  ModalHeader,
  Tabs,
  Tab,
  CloseIcon,
  IconButton,
} from '@/componentlibrary';
import { Avatar } from '@/components/Avatar';
import { Emojify } from '@/components/Emojify';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { selectConvoMessage } from '@/store/slices/convos/convosSelectors';
import { selectSelfUserIdHash } from '@/store/slices/identity/identitySelectors';
import { selectReactionsModalParams } from '@/store/slices/modal';
import { selectUsersByIdHashes } from '@/store/slices/users';
import { emojiReact } from '@/store/thunks/messages';
import { closeModal } from '@/store/thunks/modals';
import { getContactDisplayId, getContactDisplayName } from '@/utils/strings';

import styles from './styles.module.less';

type UserReaction = {
  userId: string;
  identifier: string;
};

const ReactionsModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState(0);
  const { vgroupId, msgId } = useAppSelector(selectReactionsModalParams);
  const message = useAppSelectorExtra(selectConvoMessage, vgroupId, msgId);
  const reactions = message?.reactions ?? [];

  const userIds = useMemo(() => {
    return reactions.flatMap((reaction) => reaction.userIDs).filter(Boolean);
  }, [reactions]);
  const users = useAppSelectorExtra(selectUsersByIdHashes, userIds ?? []);
  const reactionCounts = reactions.map((rx) => rx.userIDs.length) ?? [];
  const allCount = reactionCounts.reduce((accumulator, count) => accumulator + count, 0);
  const myId = useAppSelector(selectSelfUserIdHash);

  const handleRemoveReaction = async (emoji: string) => {
    await dispatch(
      emojiReact({
        emoji,
        messageId: msgId,
        vgroupId,
      })
    );
  };

  const renderUserReactionItem = (reaction: UserReaction) => {
    const user = users.find((u) => u.idHash === reaction.userId);
    const username = getContactDisplayName(user);
    const email = getContactDisplayId(user);
    const isMyReaction = reaction.userId === myId;

    return (
      // VoiceOver cannot read <li> tags in the QT WebEngine
      <div className={styles.reactionItem} key={`${reaction.userId}-${reaction.identifier}`}>
        <Avatar userIdHash={reaction.userId} className={styles.avatar} />
        <div className={styles.nameAndEmail}>
          <span className={styles.name}>{username}</span>
          <span className={styles.email}>{email}</span>
        </div>
        <Emojify className={styles.emoji}>{reaction.identifier}</Emojify>
        {isMyReaction && (
          <IconButton
            label={t('Remove')}
            className={styles.removeButton}
            onClick={() => handleRemoveReaction(reaction.identifier)}
          >
            <CloseIcon />
          </IconButton>
        )}
      </div>
    );
  };

  const getItems = () => {
    if (!reactions) return;

    const userReactions: UserReaction[] = [];

    reactions
      // activeTab 0 is "All" or filter based on index + 1 to account for "All"
      .filter((_rx, index) => activeTab === 0 || activeTab === index + 1)
      .forEach((rx) => {
        rx.userIDs.forEach((userId) => {
          const { identifier } = rx;
          userReactions.push({ identifier, userId });
        });
      });
    return userReactions
      .sort((a, b) =>
        getContactDisplayName(users?.find((u) => u.idHash === a.userId)).localeCompare(
          getContactDisplayName(users?.find((u) => u.idHash === b.userId))
        )
      )
      .map(renderUserReactionItem);
  };

  return (
    <Modal
      onClose={() => dispatch(closeModal('ReactionsModal'))}
      closeLabel={t('Close')}
      className={styles.modal}
    >
      <ModalHeader title={t('Message.Menu.Reactions')} />
      <ModalBody className={styles.body}>
        <Tabs onSelectTab={setActiveTab} selectedLabel={t('selected')} className={styles.tabs}>
          <Tab
            index={0}
            className={styles.tab}
            underlineClassName={styles.underline}
            ariaLabel={t('All')}
          >
            <span>{t('All')}</span>
            <span>{allCount}</span>
          </Tab>
          {reactions.map((rx, index) => {
            if (!rx) return;
            return (
              <Tab
                index={index + 1}
                className={styles.tab}
                underlineClassName={styles.underline}
                ariaLabel={rx.identifier}
                key={rx.identifier}
              >
                <Emojify>{rx.identifier}</Emojify>
                <span>{reactionCounts[index]}</span>
              </Tab>
            );
          })}
        </Tabs>
        <List>{getItems()}</List>
      </ModalBody>
    </Modal>
  );
};

export default ReactionsModal;
