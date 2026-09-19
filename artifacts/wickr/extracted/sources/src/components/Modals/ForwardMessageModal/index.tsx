import { useEffect, useMemo, useRef, useState, useCallback, createRef } from 'react';
import searchNoResults from '../../images/search_no_results.png';
import { MAX_MEMBERS } from '../ConvoMembersModal';
import { convertDirectoryUser } from '@/apis/webFetch';
import {
  AvatarGroupFilledIcon,
  AvatarPairFilledIcon,
  Button,
  ChipInput,
  ChipItem,
  GridGlobeFilledIcon,
  Modal,
  ModalBody,
  ModalButtonGroup,
  ModalHeader,
  PrimaryButton,
  Tooltip,
} from '@/componentlibrary';
import { Avatar } from '@/components/Avatar';
import { ComposeBox, EditorRef } from '@/components/ComposeBox';

import { createEmojiSearchExtension } from '@/components/ComposeBox/Extensions/EmojiSearch/suggestion';
import { IMentionModel } from '@/components/ComposeBox/Extensions/Mention/MentionModel';
import { createMentionExtension } from '@/components/ComposeBox/Extensions/Mention/Suggestion';
import { MessagePreview } from '@/components/Convo/MessagePreview';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import useClickOutside from '@/hooks/useClickOutside';
import useContactsSearch from '@/hooks/useContactsSearch';
import useConversationsSearch from '@/hooks/useConversationsSearch';
import useDebouncedCallback from '@/hooks/useDebouncedCallback';
import useLatestCallback from '@/hooks/useLatestCallback';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { WickrConvoType } from '@/lib/protobuf/convos';
import { WickrMessage } from '@/lib/protobuf/messages';
import { WickrUser } from '@/lib/protobuf/users';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { useFeature } from '@/store/hooks/useFeature';
import { AppRootState } from '@/store/models';
import {
  ConvoEntity,
  selectAllConvos,
  selectPinnedConvos,
  selectConvoMembers,
  selectConvoCrossBoundary,
  selectConvoMessage,
} from '@/store/slices/convos';
import { selectSelfUserIdHash } from '@/store/slices/identity';
import { selectForwardMessageModalParams } from '@/store/slices/modal';
import { selectAllUsers } from '@/store/slices/users';
import { fetchConvo } from '@/store/thunks/convos';
import { forwardMessage as forwardMessageThunk } from '@/store/thunks/messages';
import { closeModal, openAlertModal, openModal } from '@/store/thunks/modals';
import { queryEmojiSuggestions } from '@/utils/emoji/emojiSearch';
import { aliasFromEmail, getContactDisplayName, isValidEmail, raw } from '@/utils/strings';
import {
  getDefaultMarkdownExtensions,
  prepareTextMessageForSending,
} from '@/utils/tiptap/markdown';
import Row from './Row';

import styles from './styles.module.less';

const logger = new Logger('ForwardMessageModal');

const ForwardMessageModal = () => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const abortableDispatch = useAbortableDispatch();
  const selfUserIdHash = useAppSelector(selectSelfUserIdHash);
  const modalParams = useAppSelector(selectForwardMessageModalParams);
  const message = modalParams.message as WickrMessage;
  const messageAvailable = useAppSelectorExtra(selectConvoMessage, message.vGroupID, message.msgId);

  const [inputValue, setInputValue] = useState('');
  const [selectedConvoId, setSelectedConvoId] = useState<string>('');
  const [selectedUsers, setSelectedUsers] = useState<Partial<WickrUser>[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const [conversationMembers, setConversationMembers] = useState<IMentionModel[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const composeBoxRef = createRef<EditorRef>();
  const suggestionContainerRef = useRef<HTMLDivElement>(null);

  useAsyncEffect(async () => {
    if (selectedConvoId) {
      try {
        await dispatch(fetchConvo(selectedConvoId));
      } catch (error) {
        logger.error('Error fetching conversation', error);
        setConversationMembers([]);
      }
    } else {
      setConversationMembers([]);
    }
  }, [selectedConvoId, dispatch]);

  const memberSelector = useMemo(
    () => (state: AppRootState) =>
      selectedConvoId ? selectConvoMembers(state, selectedConvoId) : [],
    [selectedConvoId]
  );

  const selectedConvoMembers = useAppSelector(memberSelector);

  useEffect(() => {
    if (selectedConvoId && selectedConvoMembers.length > 0) {
      // For selected conversations (rooms/groups), use the conversation members
      const mentionMembers: IMentionModel[] = selectedConvoMembers
        .filter((member) => !member.selfUser)
        .map((member) => ({
          id: member.id,
          alias: aliasFromEmail(member.id),
          label: getContactDisplayName(member),
          name: member.name || undefined,
          email: isValidEmail(member.id) ? member.id : undefined,
        }));

      const mentionAll = t('Compose.MentionAll');
      const allMembers: IMentionModel = {
        id: mentionAll,
        idHash: mentionAll,
        alias: mentionAll,
        label: mentionAll,
        name: mentionAll,
      };
      mentionMembers.unshift(allMembers);

      setConversationMembers(mentionMembers);
    } else if (selectedUsers.length > 1) {
      // For multiple selected users (will create a group), allow mentions to those users
      const mentionMembers: IMentionModel[] = selectedUsers
        .filter((user): user is WickrUser & { id: string; idHash: string } =>
          Boolean(user.id && user.idHash)
        )
        .map((user) => ({
          id: user.idHash, // `id` used by mention extension
          alias: user.id,
          label: getContactDisplayName(user),
          name: user.name || undefined,
          email: isValidEmail(user.id) ? user.id : undefined,
        }));

      // Add @all option when there are multiple users (2+)
      if (mentionMembers.length >= 2) {
        const mentionAll = t('Compose.MentionAll');
        const allMembers: IMentionModel = {
          id: mentionAll,
          idHash: mentionAll,
          alias: mentionAll,
          label: mentionAll,
          name: mentionAll,
        };
        mentionMembers.unshift(allMembers);
      }

      setConversationMembers(mentionMembers);
    } else {
      setConversationMembers([]);
    }
  }, [selectedConvoId, selectedConvoMembers, selectedUsers, t]);

  const pinnedConvos = useAppSelector(selectPinnedConvos);
  const unfilteredConvos = useAppSelector(selectAllConvos);
  const unfilteredUsers = useAppSelector(selectAllUsers);
  const selectedConvoIsCrossBoundary = useAppSelectorExtra(
    selectConvoCrossBoundary,
    selectedConvoId
  );

  const allConvos = useMemo(() => unfilteredConvos.filter((u) => !u.isBot), [unfilteredConvos]);
  const allUsers = useMemo(
    () => unfilteredUsers.filter((u) => !u.isBot && !u.isDirectoryUser),
    [unfilteredUsers]
  );

  useEffect(() => {
    setIsDropdownVisible(true);
  }, []);

  const {
    search: searchConvos,
    searchResults: convoSearchResults,
    isLoading: isConvosLoading,
    isSearching: isConvosSearching,
  } = useConversationsSearch();

  const {
    search: searchContacts,
    contactsSearchResults: contactsSearchResults,
    directorySearchResults: directorySearchResults,
    isLoading: isContactsLoading,
    isSearching: isContactsSearching,
  } = useContactsSearch();

  const userSearchResults = useMemo(() => {
    const seen = new Set<string>();
    return [...contactsSearchResults, ...directorySearchResults].filter((contact) => {
      if (contact.idHash === selfUserIdHash || contact.isBot || seen.has(contact.idHash)) {
        return false;
      }
      seen.add(contact.idHash);
      return true;
    });
  }, [contactsSearchResults, directorySearchResults, selfUserIdHash]);

  const chips = useMemo<(ChipItem | ChipItem[])[]>(() => {
    const convo = allConvos.find((c) => c.vGroupID === selectedConvoId);
    const convoTitle = (convo || convoSearchResults.find((c) => c.vGroupID === selectedConvoId))
      ?.title;
    const crossBoundary = convo?.crossBoundary;

    const convoChips: ChipItem[] =
      selectedConvoId && convoTitle
        ? [
            {
              id: selectedConvoId,
              label: convoTitle,
              crossBoundary,
            },
          ]
        : [];

    const userChipItems: ChipItem[] = selectedUsers
      .filter((user): user is WickrUser & { idHash: string } => Boolean(user.idHash))
      .map((user) => {
        const crossBoundary = allConvos.find((c) => user.idHash === c.dmUserHash)?.crossBoundary;
        return {
          id: user.idHash,
          label: getContactDisplayName(user),
          crossBoundary,
        };
      });

    return userChipItems.length ? [...convoChips, userChipItems] : convoChips;
  }, [selectedConvoId, selectedUsers, allConvos, convoSearchResults]);

  const handleClose = () => {
    dispatch(closeModal('ForwardMessageModal'));
  };

  const handleForward = async () => {
    if (!selectedConvoId && selectedUsers.length === 0) {
      return;
    }

    if (!messageAvailable) {
      // Message was deleted while modal was open
      await dispatch(
        openModal({
          name: 'AlertModal',
          params: {
            title: t('Message failed to send'),
            body: t('This message is no longer available.'),
          },
        })
      );
      return handleClose();
    }

    // Check if forwarding to cross-boundary or external recipients
    const hasExternalUsers = selectedUsers.some((user) => !user.inNetwork);
    const hasExternalConvoMembers =
      selectedConvoId && selectedConvoMembers.some((member) => !member.inNetwork);
    const hasExternalRecipients = hasExternalUsers || hasExternalConvoMembers;
    const hasCrossBoundaryUsers = selectedUsers.some((user) => {
      const dmConvo = allConvos.find((convo) => convo.dmUserHash === user.idHash);
      return dmConvo?.crossBoundary;
    });
    const hasCrossBoundaryRecipients = selectedConvoIsCrossBoundary || hasCrossBoundaryUsers;

    if (hasCrossBoundaryRecipients || hasExternalRecipients) {
      try {
        const confirmation = await abortableDispatch(
          openModal({
            name: 'ConfirmModal',
            params: {
              title: t('Forward message?'),
              body: hasCrossBoundaryRecipients
                ? t(
                    "Members of this room may have a lower security level. Don't share any sensitive information in this room."
                  )
                : t(
                    "There are external members present. All messages sent here may be retained based on external organizations' policies."
                  ),
              confirmText: t('Compose.Send'),
              cancelText: t('Cancel'),
            },
          })
        );

        if (!confirmation) {
          return;
        }
      } catch {
        // no-op
      }
    }

    let additionalMessage = '';
    let mentions: any[] = [];

    if (composeBoxRef.current?.hasEditor()) {
      const jsonContent = composeBoxRef.current.getJSON();
      if (jsonContent) {
        const { message, mentions: parsedMentions } = prepareTextMessageForSending({
          jsonContent,
          extensions: [...getDefaultMarkdownExtensions(), ...extensions],
          allUsersLabel: t('Compose.MentionAll'),
          members: membersForSending,
        });
        additionalMessage = message;
        mentions = parsedMentions || [];
      }
    }

    try {
      // Convert directory users to contacts if needed
      const directoryUsers = selectedUsers.filter((user) => user.isDirectoryUser);
      for (const user of directoryUsers) {
        if (user.id && user.idHash) {
          try {
            await convertDirectoryUser(user.id, user.idHash);
          } catch (err) {
            logger.warn('Failed to convert directory user', user.id, err);
          }
        }
      }

      const forwardPayload = {
        originalVGroupId: message.vGroupID,
        originalMessageId: message.msgId,
        ...(selectedConvoId
          ? { targetVGroupId: selectedConvoId }
          : {
              targetUserHashes: selectedUsers
                .map((user) => user.idHash)
                .filter(Boolean) as string[],
            }),
        ...(additionalMessage && { comment: additionalMessage }),
        ...(mentions.length > 0 && { mentions }),
      };

      dispatch(forwardMessageThunk(forwardPayload));
      handleClose();
    } catch (error) {
      logger.error('Error forwarding message', error);
    }
  };

  const handleRemoveChip = (id: string) => {
    if (selectedConvoId === id) {
      setSelectedConvoId('');
    }
    setSelectedUsers(selectedUsers.filter((user) => user.idHash !== id));
    searchInputRef.current?.focus();
  };

  const showMaxMembersAlertModal = () => {
    dispatch(
      openAlertModal({
        title: t('Limit Reached'),
        body: t(
          'The maximum number of users that may be in this conversation, including yourself, is {{ limit }}',
          {
            limit: MAX_MEMBERS,
          }
        ),
      })
    );
  };

  const handleSelectConvo = useLatestCallback((convoId: string, convo: ConvoEntity) => {
    if (convo.type === WickrConvoType.DM) {
      const newUser: Partial<WickrUser> = {
        id: convo.dmUserId || '',
        idHash: convo.dmUserHash || '',
        name: convo.title || '',
        inNetwork: !convo.containsExternal,
        isBot: convo.isBot || false,
      };

      const isUserSelected = selectedUsers.some((user) => user.idHash === newUser.idHash);

      if (isUserSelected) {
        setSelectedUsers(selectedUsers.filter((user) => user.idHash !== newUser.idHash));
      } else {
        if (selectedUsers.length >= MAX_MEMBERS - 1) {
          return showMaxMembersAlertModal();
        }
        setSelectedUsers([...selectedUsers, newUser]);
      }
    } else {
      if (selectedConvoId === convoId) {
        setSelectedConvoId('');
      } else {
        setSelectedConvoId(convoId);
        setSelectedUsers([]);
      }
    }

    setInputValue('');
    searchInputRef.current?.focus();
    setIsDropdownVisible(false);
  });

  const handleSelectContact = useLatestCallback((user: WickrUser) => {
    const isUserSelected = selectedUsers.some(
      (selectedUser) => selectedUser.idHash === user.idHash
    );

    if (isUserSelected) {
      setSelectedUsers(selectedUsers.filter((selectedUser) => selectedUser.idHash !== user.idHash));
    } else {
      if (selectedUsers.length >= MAX_MEMBERS - 1) {
        return showMaxMembersAlertModal();
      }
      setSelectedUsers([...selectedUsers, user]);
      setSelectedConvoId('');
    }

    setInputValue('');
    searchInputRef.current?.focus();
    setIsDropdownVisible(false);
  });

  const searchConversationsAndContacts = useCallback(async () => {
    await Promise.all([searchConvos(inputValue), searchContacts(inputValue)]);
  }, [inputValue, searchConvos, searchContacts]);

  const throttledSearch = useDebouncedCallback(searchConversationsAndContacts, 150, {
    maxWait: 500,
  });

  useEffect(() => {
    throttledSearch();
    // Show dropdown when typing, but only if no room/group is already selected
    if (inputValue.trim().length > 0 && !selectedConvoId) {
      setIsDropdownVisible(true);
    }
  }, [inputValue, selectedConvoId, throttledSearch]);

  const renderConvoItem = useLatestCallback((convo: ConvoEntity) => {
    if (!convo.title) return;

    const renderExternalAvatar = () => {
      return (
        <Tooltip tip={t('ConvoList.OutOfNetworkUser')}>
          <span>
            <Avatar userIdHash={convo.dmUserHash ?? ''} />
            <GridGlobeFilledIcon className={styles.externalBadge} color="blue" />
          </span>
        </Tooltip>
      );
    };

    const iconProps = { size: 24, className: styles.icon };
    const renderExternalRoomOrGroup = () => (
      <Tooltip
        tip={t(
          convo.type === WickrConvoType.Room
            ? 'One or more members of this room may not be part of your network.'
            : 'One or more members of this group may not be part of your network.'
        )}
      >
        <span>
          <GridGlobeFilledIcon {...iconProps} color="blue" />
        </span>
      </Tooltip>
    );

    const avatar =
      convo.type === WickrConvoType.Group ? (
        convo.containsExternal ? (
          renderExternalRoomOrGroup()
        ) : (
          <AvatarPairFilledIcon {...iconProps} />
        )
      ) : convo.type === WickrConvoType.Room ? (
        convo.containsExternal ? (
          renderExternalRoomOrGroup()
        ) : (
          <AvatarGroupFilledIcon {...iconProps} />
        )
      ) : convo.dmUserHash ? (
        convo.containsExternal ? (
          renderExternalAvatar()
        ) : (
          <Avatar userIdHash={convo.dmUserHash} />
        )
      ) : null;

    return (
      <div key={convo.vGroupID} className={styles.convoItem}>
        <Row
          title={convo.title}
          subtitle={convo.dmUserId}
          selected={
            convo.type === WickrConvoType.DM
              ? selectedUsers.some((user) => user.idHash === convo.dmUserHash)
              : selectedConvoId === convo.vGroupID
          }
          onClick={() => handleSelectConvo(convo.vGroupID, convo)}
          avatar={avatar}
          crossBoundary={convo.crossBoundary}
        />
      </div>
    );
  });

  const renderContactItem = useLatestCallback((user: WickrUser) => (
    <div key={user.idHash} className={styles.convoItem}>
      <Row
        title={getContactDisplayName(user)}
        subtitle={user.id}
        selected={selectedUsers.some((selectedUser) => selectedUser.idHash === user.idHash)}
        onClick={() => handleSelectContact(user)}
        avatar={
          user.inNetwork ? (
            <Avatar user={user} size={39} />
          ) : (
            <Tooltip tip={t('ConvoList.OutOfNetworkUser')}>
              <span>
                <Avatar user={user} size={39} />
                <GridGlobeFilledIcon className={styles.externalBadge} color="blue" />
              </span>
            </Tooltip>
          )
        }
      />
    </div>
  ));

  const renderDropdownContent = () => {
    const isSearching = isConvosSearching || isContactsSearching;
    const isLoading = isConvosLoading || isContactsLoading;
    const hasNoResults = convoSearchResults.length === 0 && userSearchResults.length === 0;

    const hasSelectedContact = selectedUsers.length > 0;

    if (isSearching) {
      if (hasNoResults && !isLoading) {
        return (
          <div className={styles.noResultsDropdown}>
            <img src={searchNoResults} alt={t('No results')} width="40" height="40" />
            <div>{t('No results found')}</div>
          </div>
        );
      }

      // If a contact is already selected, show all contacts (no filtering)
      if (hasSelectedContact) {
        return (
          <>
            {userSearchResults.length > 0 && (
              <>
                <div className={styles.dropdownSectionHeading}>{t('CONTACTS')}</div>
                {userSearchResults.map(renderContactItem)}
              </>
            )}
          </>
        );
      }

      const pinnedResults = convoSearchResults.filter((convo) => {
        return pinnedConvos.some((pinnedConvo) => pinnedConvo.vGroupID === convo.vGroupID);
      });

      const recentResults = convoSearchResults
        .filter(
          (convo) => !pinnedConvos.some((pinnedConvo) => pinnedConvo.vGroupID === convo.vGroupID)
        )
        .sort((a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0));

      // Get user hashes from recent conversations (including DMs) to avoid duplication
      const recentDMUserHashes = recentResults
        .filter((convo) => convo.type === WickrConvoType.DM)
        .map((convo) => convo.dmUserHash)
        .filter(Boolean);

      // Get user hashes from pinned DM conversations to avoid duplication in search results too
      const pinnedDMUserHashes = pinnedConvos
        .filter((convo) => convo.type === WickrConvoType.DM)
        .map((convo) => convo.dmUserHash)
        .filter(Boolean);

      // Show contact search results that don't have existing conversations
      const otherContactResults = userSearchResults.filter(
        (contact) =>
          !pinnedDMUserHashes.includes(contact.idHash) &&
          !recentDMUserHashes.includes(contact.idHash)
      );

      const hasResults =
        pinnedResults.length > 0 || recentResults.length > 0 || otherContactResults.length > 0;

      if (!hasResults && !isLoading) {
        return (
          <div className={styles.noResultsDropdown}>
            <div>{t('No results found')}</div>
          </div>
        );
      }

      return (
        <>
          {pinnedResults.length > 0 && (
            <>
              <div className={styles.dropdownSectionHeading}>{t('PINNED')}</div>
              {pinnedResults.map(renderConvoItem)}
            </>
          )}

          {recentResults.length > 0 && (
            <>
              <div className={styles.dropdownSectionHeading}>{t('RECENT')}</div>
              {recentResults.map(renderConvoItem)}
            </>
          )}

          {otherContactResults.length > 0 && (
            <>
              <div className={styles.dropdownSectionHeading}>{t('CONTACTS')}</div>
              {otherContactResults.map(renderContactItem)}
            </>
          )}
        </>
      );
    }

    // Show all conversations and users (including selected ones)
    // If a contact is already selected, don't include any conversations
    const filteredPinnedConvos = hasSelectedContact
      ? []
      : pinnedConvos.filter((convo) => !convo.isBot);

    // Recent conversations include all non-pinned conversations
    const recentConvosToShow = hasSelectedContact
      ? []
      : allConvos
          .filter(
            (convo) => !pinnedConvos.some((pinnedConvo) => pinnedConvo.vGroupID === convo.vGroupID)
          )
          .sort((a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0));

    // Get user hashes from recent conversations (including DMs) to avoid duplication
    const recentDMUserHashes = recentConvosToShow
      .filter((convo) => convo.type === WickrConvoType.DM)
      .map((convo) => convo.dmUserHash)
      .filter(Boolean);

    // Get user hashes from pinned DM conversations to avoid duplication
    const pinnedDMUserHashes = pinnedConvos
      .filter((convo) => convo.type === WickrConvoType.DM)
      .map((convo) => convo.dmUserHash)
      .filter(Boolean);

    const otherContactsToShow = allUsers.filter(
      (contact) =>
        !pinnedDMUserHashes.includes(contact.idHash) &&
        !recentDMUserHashes.includes(contact.idHash) &&
        contact.idHash !== selfUserIdHash &&
        !contact.isBot
    );

    return (
      <>
        {!hasSelectedContact && filteredPinnedConvos.length > 0 && (
          <>
            <div className={styles.dropdownSectionHeading}>{t('PINNED')}</div>
            {filteredPinnedConvos.map(renderConvoItem)}
          </>
        )}

        {!hasSelectedContact && recentConvosToShow.length > 0 && (
          <>
            <div className={styles.dropdownSectionHeading}>{t('RECENT')}</div>
            {recentConvosToShow.map(renderConvoItem)}
          </>
        )}

        {otherContactsToShow.length > 0 && (
          <>
            <div className={styles.dropdownSectionHeading}>
              {t(hasSelectedContact ? 'CONTACTS' : 'OTHER CONTACTS')}
            </div>
            {otherContactsToShow.map(renderContactItem)}
          </>
        )}
      </>
    );
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await searchConversationsAndContacts();
  };

  const handleInputFocus = () => {
    // Only show dropdown if no room/group is already selected
    if (!selectedConvoId) {
      setIsDropdownVisible(true);
    }
  };

  // Handle backspace key to delete selection
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (selectedConvoId) {
        if (e.key === 'Backspace' && inputValue === '') {
          setSelectedConvoId('');
        } else if (e.key !== 'Backspace' && e.key !== 'Tab') {
          // Prevent typing any other keys since only one room or group may be selected
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'Backspace' && inputValue === '') {
        if (selectedUsers.length > 0) {
          // Remove the last selected user
          setSelectedUsers(selectedUsers.slice(0, -1));
        }
      }
    },
    [inputValue, selectedConvoId, selectedUsers]
  );

  useClickOutside(wrapperRef, () => {
    setIsDropdownVisible(false);
  });

  const membersForMentions = useMemo(() => {
    return new Map(conversationMembers.map((member) => [member.id, member]));
  }, [conversationMembers]);

  const membersForSending = useMemo(() => {
    return Object.fromEntries(conversationMembers.map((member) => [member.id, { id: member.id }]));
  }, [conversationMembers]);

  const membersRef = useRef<Map<string, IMentionModel>>(new Map());

  useEffect(() => {
    membersRef.current = membersForMentions;
  }, [membersForMentions]);

  // Clear mentions from editor when conversation members are removed
  useEffect(() => {
    if (composeBoxRef.current?.hasEditor() && conversationMembers.length === 0) {
      const jsonContent = composeBoxRef.current.getJSON();
      if (jsonContent) {
        const convertMentionsToText = (content: any): any => {
          if (Array.isArray(content)) {
            return content.map(convertMentionsToText);
          }

          if (content && typeof content === 'object') {
            if (content.type === 'Mention') {
              return {
                type: 'text',
                text: `@${content.attrs.label}`,
              };
            }

            const result = { ...content };
            if (result.content) {
              result.content = convertMentionsToText(result.content);
            }
            return result;
          }

          return content;
        };

        const updatedContent = convertMentionsToText(jsonContent);
        composeBoxRef.current.setContent(updatedContent);
      }
    }
  }, [conversationMembers.length]);

  const isEmojiMartEnabled = useFeature('EmojiMartSearch');

  const stableQueryMentionHandler = useCallback((props: { query: string }) => {
    const currentMembers = membersRef.current;
    if (!currentMembers.size) return [];

    const lowerQuery = props.query.toLowerCase();
    return Array.from(currentMembers.values()).filter(
      (member) =>
        member.label.toLowerCase().includes(lowerQuery) ||
        (member.name && member.name.toLowerCase().includes(lowerQuery)) ||
        (member.alias && member.alias.toLowerCase().includes(lowerQuery))
    );
  }, []);

  const extensions = useMemo(() => {
    return [
      createEmojiSearchExtension(queryEmojiSuggestions(isEmojiMartEnabled), suggestionContainerRef),
      createMentionExtension(stableQueryMentionHandler, suggestionContainerRef),
    ];
  }, [isEmojiMartEnabled, stableQueryMentionHandler]);

  return (
    <Modal
      onClose={handleClose}
      className={styles.modal}
      closeLabel={t('Close')}
      closeOnOutsideClick={false}
    >
      <ModalHeader>
        <div className={styles.header}>
          <div className={styles.heading}>{t('Forward message')}</div>
          {selectedUsers.length > 0 && (
            <div className={styles.memberCount}>
              {selectedUsers.length + 1}/{MAX_MEMBERS}
            </div>
          )}
        </div>
      </ModalHeader>
      <ModalBody className={styles.body}>
        <form className={styles.form} onSubmit={handleSubmitForm}>
          <div ref={wrapperRef} className={styles.chipInputWrapper}>
            <ChipInput
              className={styles.input}
              inputValue={inputValue}
              selectedItems={chips}
              onRemoveItem={handleRemoveChip}
              onChange={setInputValue}
              placeholder={t('ConvoList.Header.Search.Placeholder')}
              chipRemoveLabel={t('Remove')}
              ref={searchInputRef}
              onFocus={handleInputFocus}
              onMouseUp={handleInputFocus}
              onKeydown={handleInputKeyDown}
            />

            {isDropdownVisible && (
              <div className={styles.dropdownContainer} ref={dropdownRef}>
                <div className={styles.dropdown}>{renderDropdownContent()}</div>
              </div>
            )}
          </div>
        </form>
        <MessagePreview message={message} type="outgoing-forward" />
        <i className={styles.forwardedLabel}>{t('Forwarded message')}</i>
        <div className={styles.composeBoxContainer}>
          <ComposeBox
            simple
            ref={composeBoxRef}
            placeholder={
              selectedConvoIsCrossBoundary ? raw("Don't share CUI") : t('Add an optional message')
            }
            autoMarkdown={true}
            hasAttachment={false}
            extensions={extensions}
            mentionsEnabled={!!conversationMembers.length}
            availableMembers={membersForMentions}
          />
          <div ref={suggestionContainerRef} />
        </div>
      </ModalBody>
      <ModalButtonGroup>
        <Button bordered onClick={handleClose}>
          {t('Cancel')}
        </Button>
        <PrimaryButton
          onClick={handleForward}
          aria-disabled={!selectedConvoId && selectedUsers.length === 0}
        >
          {t('Forward')}
        </PrimaryButton>
      </ModalButtonGroup>
    </Modal>
  );
};

export default ForwardMessageModal;
