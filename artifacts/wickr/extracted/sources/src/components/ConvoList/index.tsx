import { clsx } from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { KeyboardShortcut } from '../KeyboardShortcut';
import MoreUnreadFAB from '../MoreUnreadFAB';
import { VirtualListContainer } from '@/componentlibrary/VirtualList/VirtualListContainer';
import {
  VirtualListScrollTo,
  VirtualListScrollToLocation,
} from '@/componentlibrary/VirtualList/types';
import useEventListener from '@/hooks/useEventListener';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import {
  ConvoEntity,
  selectBotConvos,
  selectCombinedConvos,
  selectDMConvos,
  selectPinnedConvos,
  selectRoomConvos,
  selectUnreadConvos,
  selectUnreadUnpinnedConvos,
} from '@/store/slices/convos';
import { selectSelfUser } from '@/store/slices/identity';
import { DEFAULT_CONVO_LIST_WIDTH } from '@/store/slices/settings';
import { selectActiveConvoId } from '@/store/slices/shared';
import { updateConvoListWidth } from '@/store/thunks/settings';
import { adaptiveRequestAnimationFrame } from '@/utils/dom';
import { Bots } from './Bots';
import { CombinedConvos } from './CombinedConvos';
import ConvoListHeader from './ConvoListHeader';
import ConvoSearch, { ConvoSearchRef } from './ConvoSearch';
import { ConvoSearchResults } from './ConvoSearchResults';
import { DirectMessages } from './DirectMessages';
import { PinnedConvos } from './PinnedConvos';
import { Rooms } from './Rooms';
import { UnreadConvos } from './UnreadConvos';
import {
  COMBINED_VLIST_ID,
  DMS_VLIST_ID,
  MAX_CONVO_LIST_WIDTH,
  MIN_CONVO_LIST_WIDTH,
  ROOMS_VLIST_ID,
  SHOW_LESS_ROOM_COUNT,
} from './constants';

import styles from './styles.module.less';

export const useUnreadObserver = () => {
  const [inView, setInView] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node?: Element | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.rootBounds) {
          setInView(entry.isIntersecting);
          return;
        }
        const isBelowViewport = entry.boundingClientRect.top > entry.rootBounds.bottom;
        setInView(entry.isIntersecting || isBelowViewport);
      },
      { threshold: 0 }
    );

    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return [inView, ref] as const;
};

const ConvoList = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const theme = useSetting('theme');
  const applyTheme = () => (theme === 'classic-theme' ? 'dark-theme' : theme);
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const convosCombinedSetting = useSetting('convosCombined');
  // searchResults is undefined if no search, otherwise an array with results (may be empty)
  const [searchResults, setSearchResults] = useState<ConvoEntity[]>();
  const searchRef = useRef<ConvoSearchRef>(null);
  const selfUser = useAppSelector(selectSelfUser);
  const width = useSetting('convoListWidth');
  const mlsEnabled = useSetting('mlsEnabled');

  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
  const [directMessagesCollapsed, setDirectMessagesCollapsed] = useState(false);
  const [botsCollapsed, setBotsCollapsed] = useState(false);
  const [showAllRooms, setShowAllRooms] = useState(false);

  const allUnreadConvos = useAppSelector(selectUnreadConvos);
  const unreadConvos = useMemo(
    () => (mlsEnabled ? allUnreadConvos : allUnreadConvos.filter((c) => !c.isMLS)),
    [mlsEnabled, allUnreadConvos]
  );
  const allUnreadUnpinnedConvos = useAppSelector(selectUnreadUnpinnedConvos);
  const unreadUnpinnedConvos = useMemo(
    () => (mlsEnabled ? allUnreadUnpinnedConvos : allUnreadUnpinnedConvos.filter((c) => !c.isMLS)),
    [mlsEnabled, allUnreadUnpinnedConvos]
  );
  const allPinnedConvos = useAppSelector(selectPinnedConvos);
  const pinnedConvos = useMemo(
    () => (mlsEnabled ? allPinnedConvos : allPinnedConvos.filter((c) => !c.isMLS)),
    [mlsEnabled, allPinnedConvos]
  );
  const allRooms = useAppSelector(selectRoomConvos);
  const rooms = useMemo(
    () => (mlsEnabled ? allRooms : allRooms.filter((c) => !c.isMLS)),
    [mlsEnabled, allRooms]
  );
  const allDirectMessages = useAppSelector(selectDMConvos);
  const directMessages = useMemo(
    () => (mlsEnabled ? allDirectMessages : allDirectMessages.filter((c) => !c.isMLS)),
    [mlsEnabled, allDirectMessages]
  );
  const allBotConvos = useAppSelector(selectBotConvos);
  const botConvos = useMemo(
    () => (mlsEnabled ? allBotConvos : allBotConvos.filter((c) => !c.isMLS)),
    [mlsEnabled, allBotConvos]
  );
  const allCombinedConvos = useAppSelector(selectCombinedConvos);
  const combinedConvos = useMemo(
    () => (mlsEnabled ? allCombinedConvos : allCombinedConvos.filter((c) => !c.isMLS)),
    [mlsEnabled, allCombinedConvos]
  );

  const resizableRef = useRef<HTMLElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [scrollTo, setScrollTo] = useState<VirtualListScrollTo>();

  const drawWidth = (width: number) => {
    adaptiveRequestAnimationFrame(() => {
      if (!resizableRef.current) return;
      resizableRef.current.style.minWidth = `${width}px`;
      resizableRef.current.style.maxWidth = `${width}px`;
    });
  };

  useEffect(() => {
    // Need this hook to draw
    // stored width on load
    const resizable = resizableRef.current;
    if (!resizable) return;
    drawWidth(width);
  }, [width]);

  useEventListener(resizerRef, 'mousedown', (e) => {
    e.preventDefault();
    setIsResizing(true);
  });

  // only track window when resizing
  const target = isResizing ? window : undefined;

  useEventListener(target, 'mouseup', () => {
    const newWidth = resizableRef.current
      ? parseInt(resizableRef.current.style.minWidth)
      : DEFAULT_CONVO_LIST_WIDTH;
    setIsResizing(false);
    dispatch(updateConvoListWidth(newWidth));
  });

  useEventListener(target, 'mousemove', (e) => {
    e.preventDefault();
    if (!resizableRef.current) return;

    const rect = resizableRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const calculatedWidth = Math.max(
      MIN_CONVO_LIST_WIDTH,
      Math.min(relativeX, MAX_CONVO_LIST_WIDTH)
    );
    drawWidth(calculatedWidth);
  });

  const handleConvoClick = useLatestCallback((vgroupId: string) => {
    // Clear the search input when any convo is clicked
    searchRef.current?.clear();
  });

  const [unreadInView, unreadRef] = useUnreadObserver();

  const [unreadPinnedInView, unreadPinnedRef] = useUnreadObserver();

  const hasUnreadPinnedConvos = useMemo(
    () => pinnedConvos.some((c) => c.unreadCount > 0),
    [pinnedConvos]
  );

  const [topRef, topIsInView] = useInView();

  const unpinnedUnreadsOutOfView = unreadUnpinnedConvos.length === 0 || !unreadInView;
  const pinnedUnreadsOutOfView = !hasUnreadPinnedConvos || !unreadPinnedInView || pinnedCollapsed;

  const showUnreadButton =
    !topIsInView &&
    !searchResults &&
    unreadConvos.length > 0 &&
    unpinnedUnreadsOutOfView &&
    pinnedUnreadsOutOfView;

  // Reset the `scrollTo` prop after when we scroll
  // to the top of the list to see unreads
  useEffect(() => {
    if (topIsInView) {
      setScrollTo(undefined);
    }
  }, [topIsInView]);

  const handleMoreUnreadClick = () => {
    setScrollTo(VirtualListScrollToLocation.Top);
  };

  // True if the self user is undefined or if they are a guest
  const isGuest = !selfUser || selfUser?.isGuest;

  const alwaysHiddenConvos = useMemo(() => {
    const hidden = new Set<string>();
    if (showAllRooms) return hidden;
    rooms.forEach((room, i) => {
      if (room.vGroupID !== activeConvoId && i > SHOW_LESS_ROOM_COUNT - 1) {
        hidden.add(room.vGroupID);
      }
    });
    return hidden;
  }, [rooms, activeConvoId, showAllRooms]);

  const visibleRoomIds = useMemo(() => {
    if (convosCombinedSetting) {
      return combinedConvos.map((r) => r.vGroupID);
    } else {
      return rooms.filter((r) => !alwaysHiddenConvos.has(r.vGroupID)).map((r) => r.vGroupID);
    }
  }, [rooms, alwaysHiddenConvos, convosCombinedSetting]);
  const activeRoomIndex = visibleRoomIds.indexOf(activeConvoId);

  const convoListRef = useRef<HTMLDivElement>(null);
  const listCenterOffset = convoListRef.current ? -convoListRef.current.scrollHeight / 2 : 0;

  const navigateToNextRoom = () => {
    const nextRoomId = visibleRoomIds[activeRoomIndex + 1];
    if (nextRoomId) handleConvoClick(nextRoomId);
    setScrollTo({
      listItemsId: convosCombinedSetting ? COMBINED_VLIST_ID : ROOMS_VLIST_ID,
      itemKey: nextRoomId,
      offset: listCenterOffset,
    });
  };

  const navigateToPreviousRoom = () => {
    const prevRoomId = visibleRoomIds[activeRoomIndex - 1];
    handleConvoClick(prevRoomId || visibleRoomIds[0]);
    setScrollTo({
      listItemsId: convosCombinedSetting ? COMBINED_VLIST_ID : ROOMS_VLIST_ID,
      itemKey: prevRoomId,
      offset: listCenterOffset,
    });
  };

  // Only show rooms and DMs if there are convos OR they are not a guest (which will show action buttons)
  const shouldShowRooms = rooms.length > 0 || !isGuest;

  const directMessageIds = useMemo(() => directMessages.map((dm) => dm.vGroupID), [directMessages]);
  const activeDMIndex = directMessageIds.indexOf(activeConvoId);

  const navigateToNextDM = () => {
    if (convosCombinedSetting) return;
    const nextDMId = directMessageIds[activeDMIndex + 1];
    if (nextDMId) handleConvoClick(nextDMId);
    setScrollTo({
      listItemsId: DMS_VLIST_ID,
      itemKey: nextDMId,
      offset: listCenterOffset,
    });
  };

  const navigateToPreviousDM = () => {
    if (convosCombinedSetting) return;
    const prevDMId = directMessageIds[activeDMIndex - 1];
    handleConvoClick(prevDMId || directMessageIds[0]);
    setScrollTo({
      listItemsId: DMS_VLIST_ID,
      itemKey: prevDMId,
      offset: listCenterOffset,
    });
  };

  const renderContent = () =>
    searchResults ? (
      <ConvoSearchResults convos={searchResults} onConvoClick={handleConvoClick} />
    ) : (
      <>
        {unreadUnpinnedConvos.length > 0 && (
          <UnreadConvos
            lastUnreadItemRef={unreadRef}
            convos={unreadUnpinnedConvos}
            onConvoClick={handleConvoClick}
          />
        )}
        {pinnedConvos.length > 0 && (
          <PinnedConvos
            lastUnreadPinnedRef={hasUnreadPinnedConvos ? unreadPinnedRef : undefined}
            convos={pinnedConvos}
            collapsed={pinnedCollapsed}
            onConvoClick={handleConvoClick}
            onToggleCollapse={() => setPinnedCollapsed(!pinnedCollapsed)}
          />
        )}
        {convosCombinedSetting ? (
          <CombinedConvos onConvoClick={handleConvoClick} convos={combinedConvos} />
        ) : (
          <>
            {shouldShowRooms && (
              <Rooms
                convos={rooms}
                alwaysHiddenConvos={alwaysHiddenConvos}
                onConvoClick={handleConvoClick}
                onShowAllClick={setShowAllRooms}
                showAll={showAllRooms}
              />
            )}
            {
              <DirectMessages
                convos={directMessages}
                collapsed={directMessagesCollapsed}
                onConvoClick={handleConvoClick}
                onToggleCollapse={() => setDirectMessagesCollapsed(!directMessagesCollapsed)}
              />
            }
            {botConvos.length > 0 && (
              <Bots
                convos={botConvos}
                collapsed={botsCollapsed}
                onConvoClick={handleConvoClick}
                onToggleCollapse={() => setBotsCollapsed(!botsCollapsed)}
              />
            )}
          </>
        )}
      </>
    );

  return (
    <div className={clsx(applyTheme(), styles.convoListParentWrapper)}>
      <nav ref={resizableRef} className={styles.convoListWrapper}>
        <ConvoListHeader />
        <ConvoSearch ref={searchRef} onSearchResultsChanged={setSearchResults} />
        <div className={styles.convoListContent} ref={convoListRef}>
          <MoreUnreadFAB onClick={handleMoreUnreadClick} visible={showUnreadButton} />
          <VirtualListContainer scrollTo={scrollTo} id="convo-list" preloadOffset={300}>
            <span ref={topRef} />
            <div className={styles.convoList} aria-label={t('convo list')}>
              {renderContent()}
            </div>
          </VirtualListContainer>
        </div>
      </nav>
      <div ref={resizerRef} className={styles.resizer}></div>
      <KeyboardShortcut shortcut="NextRoom" onShortcut={navigateToNextRoom} />
      <KeyboardShortcut shortcut="PreviousRoom" onShortcut={navigateToPreviousRoom} />
      <KeyboardShortcut shortcut="NextConversation" onShortcut={navigateToNextDM} />
      <KeyboardShortcut shortcut="PreviousConversation" onShortcut={navigateToPreviousDM} />
    </div>
  );
};

export default ConvoList;
