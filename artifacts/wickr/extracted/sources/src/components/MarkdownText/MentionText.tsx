import React from 'react';

import { AT_MENTION_PREFIX } from '../ComposeBox/Extensions/Mention/MentionList';
import { useAppDispatch, useAppSelectorExtra } from '@/store';
import { selectActiveConvoMemberByIdHash } from '@/store/slices/convos';
import { viewContactDetails } from '@/store/thunks/ui';
import styles from './MarkdownText.module.less';

export interface MentionTextProps {
  /** The user id hash that the mention belongs to - @all for all */
  userIdHash: string;
  /** Renders link as a span instead of a link */
  isPreview?: boolean;
}

export const MentionText: ReactFC<MentionTextProps> = ({ userIdHash, isPreview, children }) => {
  const dispatch = useAppDispatch();
  const member = useAppSelectorExtra(selectActiveConvoMemberByIdHash, userIdHash);

  const onClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    if (!member) {
      return;
    }

    dispatch(
      viewContactDetails({
        userId: member.id,
        userIdHash: member.idHash,
      })
    );
  };

  const Tag = isPreview ? 'span' : 'a';

  // When used in Emoify, event listeners are lost, thus we add data attributes
  // so higher-level wrappers can respond to click events based on target
  return (
    <Tag
      className={styles.mentionText}
      onClick={isPreview ? undefined : onClick}
      data-markdown="mention"
      data-mention-id={member?.id}
    >
      {member?.customName ? `${AT_MENTION_PREFIX}${member.customName}` : children}
    </Tag>
  );
};
