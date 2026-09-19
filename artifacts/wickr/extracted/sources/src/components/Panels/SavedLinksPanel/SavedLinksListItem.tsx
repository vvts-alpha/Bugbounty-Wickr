import { clsx } from 'clsx';
import { ChangeEventHandler, FC, MouseEvent } from 'react';
import {
  Button,
  Checkbox,
  GlobeIcon,
  IconButton,
  MoreIcon,
  PopOver,
  PopOverItem,
  SpinnerIcon,
} from '@/componentlibrary';
import { lineClamp } from '@/componentlibrary/Utilities';
import SafeImage from '@/components/SafeImage';
import { useAppTranslation } from '@/lib/i18n';
import { WickrLinkItem } from '@/lib/protobuf/links';
import { useAppDispatch, useAppSelector, useAppSelectorExtra } from '@/store';
import {
  selectConvoMemberOrUserByIdHash,
  selectActiveConvoCanModifyPinnedFilesLinks,
} from '@/store/slices/convos';
import { selectActiveConvoId } from '@/store/slices/shared';
import { unpinLink } from '@/store/thunks/files';
import { openLink } from '@/store/thunks/ui';
import { formatTimestampToDate } from '@/utils/date';
import { copyTextToClipboard, getContactDisplayName } from '@/utils/strings';

import styles from './SavedLinksPanel.module.less';

interface SavedLinksListItemProps {
  link: WickrLinkItem;
  showCheck?: boolean;
  checked?: boolean;
  onCheck?: ChangeEventHandler<HTMLInputElement>;
}

export const SavedLinksListItem: FC<SavedLinksListItemProps> = ({
  link,
  showCheck = false,
  checked,
  onCheck = () => {},
}) => {
  const dispatch = useAppDispatch();
  const activeConvoId = useAppSelector(selectActiveConvoId);
  const { t } = useAppTranslation();
  const sentByUser = useAppSelectorExtra(
    selectConvoMemberOrUserByIdHash,
    activeConvoId,
    link.sentByUser || ''
  );
  const savedByUser = useAppSelectorExtra(
    selectConvoMemberOrUserByIdHash,
    activeConvoId,
    link.savedByUser || ''
  );
  const canModifyPinnedFilesLinks = useAppSelector(selectActiveConvoCanModifyPinnedFilesLinks);

  const renderLinkItemContent = () => {
    if (!link) return;

    const handleLinkButtonClick = () => {
      dispatch(openLink({ link: link.url || '', showConfirmation: true }));
    };

    return (
      <Button
        className={clsx(styles.itemInfo, styles.linkInfoButton)}
        onClick={handleLinkButtonClick}
      >
        <div className={styles.linkInfo}>
          <div className={styles.siteNameContainer}>
            <SafeImage
              src={link.favIconUrl ?? ''}
              fallbackEl={<GlobeIcon filled={true} />}
              wrapperClassName={styles.favicon}
            />
            <div className={styles.siteName}>{link.url}</div>
          </div>
          <div className={styles.pageTitle} style={lineClamp(1)}>
            {link.pageTitle}
          </div>
          <div className={styles.linkDescription} style={lineClamp(2)}>
            {link.description}
          </div>
        </div>
        {link.imageUrl && (
          <SafeImage
            src={link.imageUrl ?? ''}
            fallbackEl={<SpinnerIcon />}
            wrapperClassName={styles.imagePreview}
          />
        )}
      </Button>
    );
  };

  const handleLinkButtonClick = () => {
    dispatch(openLink({ link: link.url || '', showConfirmation: true }));
  };

  const handleUnpinLink = () => {
    dispatch(unpinLink({ vgroupId: activeConvoId, link: link.url || '' }));
  };

  const handleCopyLinkClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    copyTextToClipboard(link.url);
  };

  // VoiceOver cannot read <li> tags in the QT WebEngine
  return (
    <div className={styles.savedItem}>
      {showCheck && (
        <div className={styles.checkboxContainer}>
          <Checkbox
            onChange={onCheck}
            checked={checked}
            className={styles.checkbox}
            aria-label={link.siteName || t('Saved link item checkbox')}
          />
        </div>
      )}
      <div className={styles.savedItemContent}>
        <div className={styles.upperInfo}>
          <div>
            {sentByUser && (
              <div className={styles.sentByUser}>{getContactDisplayName(sentByUser)}</div>
            )}
            {!!link.sentTimestamp && (
              <div className={styles.sentByUserTimestamp}>
                {formatTimestampToDate(link.sentTimestamp, 'long', t)}
              </div>
            )}
          </div>
          <PopOver
            popoverContent={[
              <PopOverItem onClick={handleCopyLinkClick} key={'CopyLink'}>
                {t('Message.Menu.CopyLink')}
              </PopOverItem>,
              canModifyPinnedFilesLinks && (
                <PopOverItem variant="alert" onClick={handleUnpinLink} key={'Delete'}>
                  {t('Remove From Links')}
                </PopOverItem>
              ),
            ]}
          >
            <IconButton className={styles.popoverBtn} label={t('Message.Menu.OpenMenu')}>
              <MoreIcon />
            </IconButton>
          </PopOver>
        </div>
        <Button
          className={clsx(styles.itemInfo, styles.linkInfoButton)}
          onClick={handleLinkButtonClick}
        >
          <div className={styles.linkInfo}>
            <div className={styles.siteNameContainer}>
              <SafeImage
                src={link.favIconUrl ?? ''}
                fallbackEl={<GlobeIcon filled={true} />}
                wrapperClassName={styles.favicon}
              />
              <div className={styles.siteName}>{link.url}</div>
            </div>
            <div className={styles.pageTitle} style={lineClamp(1)}>
              {link.pageTitle}
            </div>
            <div className={styles.linkDescription} style={lineClamp(2)}>
              {link.description}
            </div>
          </div>
          {link.imageUrl && (
            <SafeImage
              src={link.imageUrl ?? ''}
              fallbackEl={<SpinnerIcon />}
              wrapperClassName={styles.imagePreview}
            />
          )}
        </Button>
        {savedByUser && !!link.savedTimestamp && (
          <div className={styles.savedByUser}>
            {t('Saved by {{name}} on {{savedDate}}', {
              name: getContactDisplayName(savedByUser),
              savedDate: formatTimestampToDate(link.savedTimestamp, 'long', t),
            })}
          </div>
        )}
      </div>
    </div>
  );
};
