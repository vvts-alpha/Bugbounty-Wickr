import { clsx } from 'clsx';
import React, { forwardRef } from 'react';
import { ListItemButton } from '@/componentlibrary';
import { Avatar } from '@/components/Avatar';
import { useUser } from '@/store/hooks/useUsers';
import { getContactDisplayName } from '@/utils/strings';
import { IMentionModel } from './MentionModel';

import suggestionStyles from '../SuggestionList/SuggestionList.module.less';

export interface MentionListItemProps {
  item: IMentionModel;
  onClick: () => void;
  className?: string;
}

export const MentionListItem = forwardRef(
  ({ item, onClick, className }: MentionListItemProps, ref: React.Ref<HTMLSpanElement>) => {
    const name = getContactDisplayName(item);
    const user = useUser(item.id);

    return (
      <ListItemButton onClick={onClick} className={clsx(className, suggestionStyles.item)}>
        <Avatar userIdHash={user?.idHash} name={name} />
        <span ref={ref} className={suggestionStyles.label}>
          {item.label}
        </span>
      </ListItemButton>
    );
  }
);

export default MentionListItem;
