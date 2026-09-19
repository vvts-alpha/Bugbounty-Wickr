import { clsx } from 'clsx';
import { Fragment, useEffect, useState } from 'react';

import { useNavigate } from 'react-router';
import ConvoBannersContainer from '../Banners/BannerContainers/ConvoBannersContainer';
import FileManagementContainer from '../FileManagement/FileManagementContainer';
import WebAppContainer from '../WebApp/WebAppContainer';
import { generateChatRoute } from '@/chat/routes';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { useAppDispatch, useAppSelector } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { useSetting } from '@/store/hooks/useSetting';
import {
  selectActiveConvoBotWarning,
  selectActiveConvoCrossBoundary,
  selectActiveConvoGuardWarning,
  selectActiveConvoMembers,
  selectActiveConvoNewestMsgId,
  selectActiveConvoNonGuestMembersCount,
  selectActiveConvoSelfUserIsUnauthorized,
  selectActiveConvoType,
  selectActiveConvoHasUnauthorizedMembers,
} from '@/store/slices/convos';
import { selectActiveConvoId } from '@/store/slices/shared';
import { ConvoTab, selectActiveTab, setActiveTab } from '@/store/slices/uiChat';
import { switchActiveConvoAndMessage } from '@/store/thunks/messages';
import { ArrowKeyNavigationProvider } from './ArrowKeyNavigationProvider';
import ConvoBotWarning from './ConvoBotWarning';
import ConvoGuestAccessWarning from './ConvoGuestAccessWarning';
import ConvoHeader from './ConvoHeader';
import ConvoInputContainer from './ConvoInputContainer';
import ConvoMessagesContainer from './ConvoMessagesContainer';
import { ConvoMessagesReadObserversProvider } from './ConvoMessagesObservers/readObservers';
import ConvoTypingIndicator from './ConvoTypingIndicator';
import CrossBoundaryUnclassifiedWarning from './CrossBoundaryUnclassifiedWarning';
import SecurityTagWarning from './SecurityTagWarning';
import UnauthorizedConvoMemberOverlay from './UnauthorizedConvoMemberOverlay';
import { UnauthorizedUserBlock } from './UnauthorizedUserBlock';
import { VisibleMessagesProvider } from './VisibleMessagesProvider';

import styles from './Convo.module.less';

export const convoHeaderTabMap: Record<ConvoTab, number> = {
  messages: 0,
  files: 1,
  webApp: 2,
};

const ConvoContainer = () => {
  // Use activeConvoId as key to re-create the observers and messages container whenever rooms change
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const convoNewestMsgId = useAppSelector(selectActiveConvoNewestMsgId);
  const nonGuestMembersCount = useAppSelector(selectActiveConvoNonGuestMembersCount);
  const membersCount = useAppSelector(selectActiveConvoMembers).length;
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector(selectActiveTab);
  const navigate = useNavigate();
  const botWarning = useAppSelector(selectActiveConvoBotWarning);
  const isFileManagementEnabled = useFeature('FileManagement');
  const filesEnabled = useSetting('filesEnabled');
  const crossBoundary = useAppSelector(selectActiveConvoCrossBoundary);
  const [showCrossBoundaryUnclassifiedWarning, setShowCrossBoundaryUnclassifiedWarning] =
    useState(crossBoundary);
  const isTypingIndicatorEnabled = useSetting('isTypingIndicatorEnabled');

  const isSecurityTagsEnabled = useSetting('guardEnabled');
  const convoHasSecurityTagWarning = useAppSelector(selectActiveConvoGuardWarning);
  const [showSecurityTagWarning, setShowSecurityTagWarning] = useState(convoHasSecurityTagWarning);
  const activeConvoType = useAppSelector(selectActiveConvoType);
  const hasUnauthorizedMembers = useAppSelector(selectActiveConvoHasUnauthorizedMembers);
  const selfUserIsUnauthorized = useAppSelector(selectActiveConvoSelfUserIsUnauthorized);

  useEffect(() => {
    if (!filesEnabled && activeTab === 'files') dispatch(setActiveTab('messages'));
  }, [dispatch, filesEnabled, activeTab]);

  useEffect(() => {
    setShowCrossBoundaryUnclassifiedWarning(crossBoundary);
  }, [activeConvoId, crossBoundary]);

  useEffect(() => {
    setShowSecurityTagWarning(convoHasSecurityTagWarning);
  }, [activeConvoId, convoHasSecurityTagWarning]);

  const handleCrossBoundaryUnclassifiedWarningClick = () => {
    setShowCrossBoundaryUnclassifiedWarning(false);
  };

  const handleSecurityTagWarningClick = () => {
    setShowSecurityTagWarning(false);
  };

  const handleTabChange = (value: number) => {
    const tabName = Object.entries(convoHeaderTabMap).find(([_, index]) => index === value)?.[0] as
      | ConvoTab
      | undefined;

    if (tabName) {
      navigate(generateChatRoute.convo(activeConvoId, tabName));
    }
  };

  // Avoid unnecessary renderings
  if (!activeConvoId || !activeTab) return null;

  const getConvoInputContent = () => {
    if (hasUnauthorizedMembers) {
      return <UnauthorizedUserBlock />;
    } else if (isSecurityTagsEnabled && showSecurityTagWarning) {
      return <SecurityTagWarning onClick={handleSecurityTagWarningClick} />;
    } else if (showCrossBoundaryUnclassifiedWarning) {
      return (
        <CrossBoundaryUnclassifiedWarning onClick={handleCrossBoundaryUnclassifiedWarningClick} />
      );
    } else if (
      membersCount !== 0 &&
      nonGuestMembersCount === 0 &&
      activeConvoType !== WickrConvoType.DM
    ) {
      // There is a short time when loading in a convo where there can be 0
      // members in the active convo, so we check here so we don't flash this
      // warning in every convo when we switch.
      return <ConvoGuestAccessWarning />;
    } else if (botWarning) {
      return <ConvoBotWarning />;
    } else {
      return (
        <>
          {isTypingIndicatorEnabled && <ConvoTypingIndicator />}
          <ConvoInputContainer
            onSubmit={() => {
              dispatch(
                switchActiveConvoAndMessage({
                  scrollToMsgId: convoNewestMsgId,
                })
              );
            }}
          />
        </>
      );
    }
  };

  return (
    <div className={styles.outerWrapper}>
      {selfUserIsUnauthorized && <UnauthorizedConvoMemberOverlay />}
      <div
        className={styles.convoContainer}
        // HTML attribute inert is not supported in React 18 so need this workaround
        {...({ inert: selfUserIsUnauthorized ? '' : undefined } as any)}
      >
        <ConvoHeader onSelectTab={handleTabChange} selectedTab={convoHeaderTabMap[activeTab]} />
        <ConvoBannersContainer />
        <div
          className={clsx(styles.tabContent, {
            [styles.hidden]: activeTab !== 'messages',
          })}
        >
          <VisibleMessagesProvider>
            <ArrowKeyNavigationProvider enabled={activeTab === 'messages'}>
              {/* We want new messages components every time the conversation changes, so change the key accordingly */}
              <Fragment key={activeConvoId}>
                <ConvoMessagesReadObserversProvider>
                  <ConvoMessagesContainer />
                </ConvoMessagesReadObserversProvider>
              </Fragment>
              {/* Try not to re-render chat input components to preserve its Tiptap editor and avoid memory leak */}
              {getConvoInputContent()}
            </ArrowKeyNavigationProvider>
          </VisibleMessagesProvider>
        </div>
        {isFileManagementEnabled && activeTab === 'files' && (
          <div className={styles.tabContent}>
            <FileManagementContainer />
          </div>
        )}
        {activeTab === 'webApp' && (
          <div className={styles.tabContent}>
            <WebAppContainer />
          </div>
        )}
      </div>
    </div>
  );
};

export default ConvoContainer;
