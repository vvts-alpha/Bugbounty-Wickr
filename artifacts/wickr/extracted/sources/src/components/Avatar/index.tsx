import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';
import { useUser } from '../../store/hooks/useUsers';
import SafeImage, { SafeImageLoadingStrategy } from '../SafeImage';
import { wickrWebEndpoints } from '@/apis/webFetch/endpoints';
import { IconButton } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import { WickrUser } from '@/lib/protobuf/users';
import { useAppSelectorExtra } from '@/store';
import { useFeature } from '@/store/hooks/useFeature';
import { selectAvatarVersionByIdHash } from '@/store/slices/users';
import { getCatImageUrl } from '@/utils/catMode';
import { getContactDisplayName, getInitialsFromName } from '@/utils/strings';

import styles from './Avatar.module.less';

interface BaseProps extends HTMLAttributes<HTMLBaseElement> {
  className?: string;
  onClick?: () => void;
  loading?: SafeImageLoadingStrategy;
  size?: string | number;
}
interface AvatarPropsWithUser extends BaseProps {
  user: WickrUser;
  name?: string;
  userIdHash?: string;
}
interface AvatarPropsWithName extends BaseProps {
  name: string;
  userIdHash?: string;
  user?: WickrUser;
}
interface AvatarPropsWithUserId extends BaseProps {
  userIdHash: string;
  name?: string;
  user?: WickrUser;
}
type Props = AvatarPropsWithUser | AvatarPropsWithName | AvatarPropsWithUserId;

export const Avatar: React.FC<Props> = ({
  size = 42,
  userIdHash,
  name,
  onClick,
  loading = 'lazy',
  className,
  user,
  ...props
}) => {
  const { t } = useAppTranslation();
  const fetchedUser = useUser(userIdHash);
  const avatarUser = user || fetchedUser;
  const avatarUserIdHash = userIdHash || avatarUser?.idHash;
  const userAvatarVersion = useAppSelectorExtra(selectAvatarVersionByIdHash, avatarUserIdHash);
  const catModeEnabled = useFeature('CatMode');

  const userName = name || getContactDisplayName(avatarUser);

  const getAvatarInitials = () => {
    if (name === t('Compose.MentionAll')) {
      return 'All';
    }
    return getInitialsFromName(userName);
  };

  const initialsEl = () => (
    <div className={clsx(styles.avatar, styles.avatarBorder)}>{getAvatarInitials()}</div>
  );

  const getImageSrc = () => {
    if (catModeEnabled && avatarUserIdHash) {
      return getCatImageUrl(avatarUserIdHash);
    }
    return avatarUserIdHash && avatarUser?.hasProfilePicture
      ? `${wickrWebEndpoints.userAvatarImage(avatarUserIdHash)}?${userAvatarVersion}`
      : null;
  };

  const imageSrc = getImageSrc();
  const content = imageSrc ? (
    <SafeImage
      className={styles.avatar}
      loading={loading}
      src={imageSrc}
      alt={catModeEnabled ? `Cat for ${userName}` : userName}
      fallbackEl={initialsEl()}
      square
    />
  ) : (
    initialsEl()
  );

  const MIN_FONT_SIZE = 10;
  const fontSize = Math.max(MIN_FONT_SIZE, Math.floor(Number(size) * 0.4));
  const inlineStyle = { width: size, height: size, fontSize };

  return onClick ? (
    <IconButton
      style={inlineStyle}
      className={clsx(styles.avatarContainer, className)}
      onClick={onClick}
      label={userName}
      aria-disabled={props['aria-disabled']}
    >
      {content}
    </IconButton>
  ) : (
    <div
      style={inlineStyle}
      className={clsx(styles.avatarContainer, styles.noninteractiveAvatarContainer, className)}
    >
      {content}
    </div>
  );
};
