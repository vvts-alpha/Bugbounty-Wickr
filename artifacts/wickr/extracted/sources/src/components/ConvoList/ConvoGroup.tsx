import { FC, useCallback, useMemo } from 'react';
import { Collapse } from '@/componentlibrary';
import { NonVirtualListItems } from '@/componentlibrary/VirtualList/NonVirtualListItems';
import { VirtualListItems } from '@/componentlibrary/VirtualList/VirtualListItems';
import useLatestCallback from '@/hooks/useLatestCallback';
import { selectConvoId } from '@/lib/protobuf/utils';
import { useAppSelector } from '@/store';
import { ConvoEntity } from '@/store/slices/convos';
import { selectActiveConvoId } from '@/store/slices/shared';
import Badges from './Badges';
import ConvoListItem from './ConvoListItem';

import styles from './styles.module.less';

type ConvoGroupProps = {
  vlistId?: string;
  convos: ConvoEntity[];
  onConvoClick: (vgroupId: string) => void;
  collapsible?: boolean;
  title: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  collapsedTip?: string;
  expandedTip?: string;
  alwaysHiddenConvos?: Set<string>;
  trailingEl?: JSX.Element;
  titlePopOver?: JSX.Element;
  showBadges?: boolean;
  emptyListEl?: JSX.Element;
  lastUnreadItemRef?: (node?: Element | null) => void;
};

/**
 * Assign a fixed height to every convo list item.
 * This is required to manage the transition for the max-height property
 * when collapsing and expanding.
 */
export const CONVO_LIST_ITEM_HEIGHT = 32;
const ConvoGroup: FC<ConvoGroupProps> = ({
  vlistId,
  convos,
  onConvoClick,
  collapsible = true,
  title,
  collapsed = false,
  onToggleCollapse,
  collapsedTip,
  expandedTip,
  alwaysHiddenConvos,
  trailingEl,
  titlePopOver,
  showBadges,
  emptyListEl,
  lastUnreadItemRef,
}) => {
  const activeConvoId = useAppSelector(selectActiveConvoId);

  // memoize virtual list props where possible to reduce re-renders
  const displayedConvos = useMemo(() => {
    return convos.filter((convo) => {
      // always show active convo
      if (convo.vGroupID === activeConvoId) return true;
      // hide some convos when show less is clicked
      if (alwaysHiddenConvos?.has(convo.vGroupID)) return false;
      // hide all convos when list is collapsed, except active convo
      if (collapsed) return false;
      // by default, show the convo
      return true;
    });
  }, [convos, activeConvoId, alwaysHiddenConvos, collapsed]);

  const latestOnConvoClick = useLatestCallback(onConvoClick);

  const renderItems = useCallback(
    (convo: ConvoEntity, index: number) => {
      const item = (
        <ConvoListItem key={convo.vGroupID} convo={convo} onConvoClick={latestOnConvoClick} />
      );
      const lastUnreadIndex = displayedConvos.findLastIndex((c) => c.unreadCount > 0);

      // Wrap last unread item with ref
      if (index === lastUnreadIndex && lastUnreadIndex !== -1 && lastUnreadItemRef) {
        return (
          <div ref={lastUnreadItemRef} key={`wrapper-${convo.vGroupID}`}>
            {item}
          </div>
        );
      }

      return item;
    },
    [latestOnConvoClick, lastUnreadItemRef, displayedConvos]
  );

  const footer = useMemo(() => <div>{trailingEl}</div>, [trailingEl]);

  const dependencies = useMemo(
    () => [displayedConvos, footer, latestOnConvoClick],
    [displayedConvos, footer, latestOnConvoClick]
  );

  const createConvoItems = useLatestCallback(() => {
    if (displayedConvos.length === 0 && emptyListEl) {
      return emptyListEl;
    }

    return (
      <>
        <VirtualListItems
          id={vlistId}
          items={displayedConvos}
          itemHeightType="static"
          initialItemHeight={CONVO_LIST_ITEM_HEIGHT}
          keySelector={selectConvoId}
          renderItem={renderItems}
          footer={footer} // VoiceOver cannot read <li> tags in the QT WebEngine
          dependencies={dependencies}
        />
      </>
    );
  });

  /**
   * Show an aggregation of all convo item badges
   * in the pinned section when collapsed. This prevents unread indicators and similar
   * from being hidden when the section is collapsed.
   */
  const badges = useMemo(() => {
    if (!(showBadges && collapsed)) return null;

    const nonActiveConvos = convos.filter((c) => c.vGroupID !== activeConvoId);

    const mentionCount = nonActiveConvos.reduce(
      (accumulator, convo) => accumulator + convo.mentionCount,
      0
    );
    const activeCall = nonActiveConvos.some((convo) => convo.activeCall);
    const unreadCount = nonActiveConvos.reduce(
      (accumulator, convo) => accumulator + convo.unreadCount,
      0
    );
    const unacknowledgedSendErrorCount = nonActiveConvos.reduce(
      (accumulator, convo) => accumulator + convo.unacknowledgedSendErrorCount,
      0
    );
    const resendInProgress = nonActiveConvos.some((convo) => convo.resendInProgress);
    return (
      <Badges
        className={styles.pinnedBadges}
        mentionCount={mentionCount}
        activeCall={activeCall}
        unreadCount={unreadCount}
        unacknowledgedSendErrorCount={unacknowledgedSendErrorCount}
        resendInProgress={resendInProgress}
      />
    );
  }, [showBadges, collapsed, convos, activeConvoId]);

  return collapsible ? (
    <Collapse
      title={title}
      titleWrapper={NonVirtualListItems}
      badges={badges}
      titleClassName={styles.collapse}
      collapsed={collapsed}
      onClick={onToggleCollapse}
      tip={collapsed ? collapsedTip : expandedTip}
    >
      {createConvoItems()}
    </Collapse>
  ) : (
    <>
      <NonVirtualListItems>
        <h2 className={styles.convoListGroupHeader}>
          <span>{title}</span>
          {titlePopOver}
        </h2>
      </NonVirtualListItems>

      {createConvoItems()}
    </>
  );
};

export default ConvoGroup;
