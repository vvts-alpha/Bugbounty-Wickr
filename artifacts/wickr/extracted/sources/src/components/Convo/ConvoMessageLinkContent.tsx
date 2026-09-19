import { clsx } from 'clsx';
import React from 'react';

import { useNavigate } from 'react-router';
import SafeImage from '../SafeImage';
import { generateChatRoute } from '@/chat/routes';
import { Button, IconButton, PopOver, PopOverItem, PopOverSeparator } from '@/componentlibrary';
import { GlobeIcon, MoreIcon } from '@/componentlibrary/icons';
import { SaveToIcon } from '@/componentlibrary/icons/SaveTo';
import { useAppTranslation } from '@/lib/i18n';
import { WickrMessageLink } from '@/lib/protobuf/messages';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setConvoWebAppLoaded } from '@/store/slices/convos';
import { configureWebApp, webAppLoadUrl } from '@/store/thunks/convos';
import { openLink, saveLinkToRoom } from '@/store/thunks/ui';
import { copyTextToClipboard } from '@/utils/strings';

import styles from './ConvoMessageLinkContent.module.less';

interface ConvoMessageLinkContentProps {
  link: WickrMessageLink;
  vgroupId: string;
  messageId: string;
  showSaveToRoom?: boolean;
  className?: string;
  tabIndex?: number;
}

const ConvoMessageLinkContent: React.FC<ConvoMessageLinkContentProps> = ({
  link,
  vgroupId,
  messageId,
  showSaveToRoom,
  tabIndex,
  className,
}) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const isBeta = useSetting('isBeta');
  const navigate = useNavigate();
  const a11yImgText =
    link?.pageTitle ||
    link?.description ||
    link?.siteName ||
    link?.url ||
    t('Message.Link.DefaultText');

  let siteName = link?.siteName ?? '';
  if (!siteName && link.url) {
    try {
      siteName = new URL(link.url).host;
    } catch {
      siteName = '';
    }
  }
  const favIconText = t('Message.Link.FaviconText', { siteName });

  const handleOpenLink = () => {
    if (link.url) {
      dispatch(
        openLink({
          link: link.url,
          showConfirmation: true,
        })
      );
    }
  };

  const handleSaveLinkToRoom = () => {
    if (!link.url) {
      return;
    }
    dispatch(saveLinkToRoom({ link: link.url, vgroupId, messageId }));
  };

  return (
    <div className={styles.linkContentWrapper}>
      <Button
        className={clsx(styles.linkContainer, className)}
        onClick={handleOpenLink}
        tabIndex={tabIndex}
      >
        <div className={styles.header}>
          <span className={styles.favicon}>
            <SafeImage
              src={link.favIconUrl ?? ''}
              alt={favIconText}
              width={16}
              height={16}
              fallbackEl={<GlobeIcon width="16" height="16" filled />}
            />
          </span>
          <p>{siteName}</p>
        </div>
        <div>
          <p className={styles.pageTitle}>{link.pageTitle}</p>
          <p className={styles.description}>{link.description}</p>
        </div>
        {link.imageUrl && (
          <div className={styles.imagePreview}>
            {/* link preview image has unknown size before loaded, we need to call RSC for it */}
            <SafeImage
              src={link.imageUrl || ''}
              loading={'lazy'}
              alt={a11yImgText}
              errorEl={<></>}
            />
          </div>
        )}
      </Button>
      <PopOver
        iconGutter
        contentWrapperClassName={styles.popoverWrapper}
        popoverContent={
          <>
            {showSaveToRoom && (
              <PopOverItem icon={<SaveToIcon />} onClick={handleSaveLinkToRoom}>
                <>{t('Message.Link.SaveToRoom')}</>
              </PopOverItem>
            )}
            <PopOverItem onClick={() => copyTextToClipboard(link.url)}>
              <>{t('Message.Menu.CopyLink')}</>
            </PopOverItem>

            {isBeta && link.url && (
              <>
                <PopOverSeparator />
                <PopOverItem
                  onClick={() => {
                    if (!link.url) return;
                    // switch to app tab
                    navigate(generateChatRoute.convo(vgroupId, 'webApp'));
                    // open webview
                    dispatch(
                      configureWebApp({
                        id: vgroupId,
                        visible: false,
                        x: 0,
                        y: 0,
                        width: 0,
                        height: 0,
                      })
                    );
                    // open link url in webview
                    dispatch(webAppLoadUrl({ id: vgroupId, url: link.url }));
                    // set a local state in redux for other components to check
                    dispatch(setConvoWebAppLoaded({ vgroupId: vgroupId, loaded: true }));
                  }}
                >
                  Open Link in WebApp (Beta)
                </PopOverItem>
              </>
            )}
          </>
        }
      >
        <IconButton label={t('Message.Menu.Open')} className={styles.moreOptionsButton}>
          <MoreIcon />
        </IconButton>
      </PopOver>
    </div>
  );
};

export default ConvoMessageLinkContent;
