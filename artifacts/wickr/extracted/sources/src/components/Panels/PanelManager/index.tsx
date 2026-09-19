import { clsx } from 'clsx';
import { createRef, FC, RefObject, useEffect, useRef } from 'react';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { OverlayManager } from '../../Overlays/OverlayManager';
import { AllConvoMembersPanel } from '../AllConvoMembersPanel/AllConvoMembersPanel';
import { ContactDetailsPanel } from '../ContactDetailsPanel/ContactDetailsPanel';
import { ContactsPanel } from '../ContactsPanel/ContactsPanel';
import { ConvoDetailsPanel } from '../ConvoDetailsPanel/ConvoDetailsPanel';
import { EditContactPanel } from '../EditContactPanel/EditContactPanel';
import { EditConvoPanel } from '../EditConvoPanel/EditConvoPanel';
import { LearnMoreVerificationPanel } from '../LearnMoreVerificationPanel/LearnMoreVerificationPanel';
import { MainMenuPanel } from '../MainMenu/MainMenuPanel';
import ManageUsersPanel from '../ManageUsersPanel/ManageUsersPanel';
import { MessageInfoPanel } from '../MessageInfoPanel';
import NotificationsPanel from '../NotificationsPanel';
import { PanelErrorBoundary } from '../PanelErrorBoundary';
import { RoomHistoryPanel } from '../RoomHistoryPanel/RoomHistoryPanel';
import { SavedLinksPanel } from '../SavedLinksPanel/SavedLinksPanel';
import { SearchPanel } from '../SearchPanel/SearchPanel';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { VerifyContactPanel } from '../VerifyContactPanel/VerifyContactPanel';
import ViewUsersPanel from '../ViewUsersPanel/ViewUsersPanel';
import WickrAIChatPanel from '../WickrAIChatPanel/WickrAIChatPanel';
import { KEY_CODES } from '@/componentlibrary/constants';
import trapFocus from '@/componentlibrary/utils/trap-focus';
import useConst from '@/hooks/useConst';
import useEventListener from '@/hooks/useEventListener';
import usePrevious from '@/hooks/usePrevious';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { selectActiveModal } from '@/store/slices/modal';
import {
  clearPanelStack,
  Panel,
  PANEL_SIDES,
  PanelCloseIcon,
  PanelName,
  selectActivePanel,
  selectPanels,
  WIDE_PANELS,
} from '@/store/slices/panels';
import { selectActiveConvoId } from '@/store/slices/shared';
import { focusPreferredElement } from '@/utils/dom';
import { logDevError } from '@/utils/error';

import styles from './PanelManager.module.less';
import panelButtonStyles from '../buttonStyles.module.less';
import leftStyles from './leftStyles.module.less';
import rightStyles from './rightStyles.module.less';

// Must match var in rightStyles.module.less & leftStyles.module.less
const PANEL_SLIDE_MS = 200;

export const PanelManager: FC = () => {
  const dispatch = useAppDispatch();
  const panelStack = useAppSelector(selectPanels);
  const activePanel = useAppSelector(selectActivePanel);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRefMap = useConst(() => new Map<PanelName, RefObject<HTMLDivElement>>());
  const modalIsOpen = !!useAppSelector(selectActiveModal);
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const wickrAIChatEnabled = useFeature('WickrAIChat');

  // Close all panels when changing convos via
  // a native desktop notification
  useEffect(() => {
    dispatch(clearPanelStack());
  }, [activeConvoId, dispatch]);

  // Store the original target element when the first panel is opened
  // so focus can be restored after all panels are closed.
  const originalTargetElement = useRef<HTMLElement | null>();

  const renderPanel = (panel: Panel, closeIcon: PanelCloseIcon) => {
    if (panelStack.filter((p) => p.name === panel.name).length > 1) {
      logDevError(new Error(`Duplicate panel attempted to open: ${panel.name}`));
      return null;
    }
    switch (panel.name) {
      case 'ContactDetailsPanel':
        return <ContactDetailsPanel {...panel} closeIcon={closeIcon} />;
      case 'EditContactPanel':
        return <EditContactPanel {...panel} closeIcon={closeIcon} />;
      case 'ConvoDetailsPanel':
        return <ConvoDetailsPanel {...panel} closeIcon={closeIcon} />;
      case 'EditConvoPanel':
        return <EditConvoPanel {...panel} closeIcon={closeIcon} />;
      case 'AllConvoMembersPanel':
        return <AllConvoMembersPanel {...panel} closeIcon={closeIcon} />;
      case 'VerifyContactPanel':
        return <VerifyContactPanel {...panel} closeIcon={closeIcon} />;
      case 'LearnMoreVerificationPanel':
        return <LearnMoreVerificationPanel {...panel} closeIcon={closeIcon} />;
      case 'ContactsPanel':
        return <ContactsPanel {...panel} closeIcon={closeIcon} />;
      case 'MessageInfoPanel':
        return <MessageInfoPanel {...panel} closeIcon={closeIcon} />;
      case 'MainMenuPanel':
        return <MainMenuPanel {...panel} closeIcon={closeIcon} />;
      case 'SettingsPanel':
        return <SettingsPanel {...panel} closeIcon="close" />;
      case 'RoomHistoryPanel':
        return <RoomHistoryPanel {...panel} closeIcon={closeIcon} />;
      case 'SavedLinksPanel':
        return <SavedLinksPanel {...panel} closeIcon={closeIcon} />;
      case 'SearchPanel':
        return <SearchPanel {...panel} closeIcon={closeIcon} />;
      case 'ManageUsersPanel':
        return <ManageUsersPanel {...panel} closeIcon={closeIcon} />;
      case 'NotificationsPanel':
        return <NotificationsPanel {...panel} closeIcon={closeIcon} />;
      case wickrAIChatEnabled && 'WickrAIChatPanel':
        return <WickrAIChatPanel {...panel} closeIcon={closeIcon} />;
      case 'ViewUsersPanel':
        return <ViewUsersPanel />;
      default:
        return null;
    }
  };

  useEventListener(document, 'keydown', (e) => {
    const activePanelEl = (activePanel && panelRefMap.get(activePanel.name)?.current) || null;

    if (e.key === KEY_CODES.TAB && (activePanelEl || overlayRef.current)) {
      trapFocus(e, [activePanelEl, overlayRef.current]);
    }

    if (e.key === KEY_CODES.ESCAPE) {
      dispatch(clearPanelStack());
    }
  });

  const previousPanelStackLength = usePrevious(panelStack)?.length || 0;
  const previousModalIsOpen = usePrevious(modalIsOpen);

  useEffect(() => {
    if (previousPanelStackLength === 0 && panelStack.length === 1) {
      originalTargetElement.current = document.activeElement as HTMLElement;
    }
    const activePanelEl = (activePanel && panelRefMap.get(activePanel.name)?.current) || null;
    if (
      activePanelEl &&
      !previousModalIsOpen &&
      !modalIsOpen // Let the modal handle returning focus on close
    ) {
      focusPreferredElement(activePanelEl);
    }

    if (panelStack.length === 0) {
      originalTargetElement.current?.focus();
      originalTargetElement.current = null;
    }
    // although adding all deps maybe harmless, but it's not needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelStack, activePanel, modalIsOpen]);

  return (
    <div className={clsx(styles.panelContainer, styles.overlay)} aria-hidden={modalIsOpen}>
      <TransitionGroup component={null}>
        {panelStack.map((panel, index) => {
          const panelStyles = PANEL_SIDES[panel.name] === 'right' ? rightStyles : leftStyles;

          let panelRef: any = panelRefMap.get(panel.name);
          if (!panelRef) {
            panelRef = createRef();
            panelRefMap.set(panel.name, panelRef);
          }
          return (
            <CSSTransition
              timeout={PANEL_SLIDE_MS}
              classNames={panelStyles}
              key={panel.name}
              nodeRef={panelRef}
            >
              <div
                ref={panelRef}
                className={clsx(styles.panelWrapper, panelButtonStyles.buttonVars, {
                  [styles.wide]: WIDE_PANELS.includes(panel.name),
                })}
                aria-hidden={index !== panelStack.length - 1} // aria-hidden=true for all except the top of the stack
              >
                <PanelErrorBoundary panelName={panel.name} side={PANEL_SIDES[panel.name]}>
                  {renderPanel(panel, index === 0 ? 'close' : 'left-caret')}
                </PanelErrorBoundary>
              </div>
            </CSSTransition>
          );
        })}
      </TransitionGroup>
      <OverlayManager ref={overlayRef} />
    </div>
  );
};
