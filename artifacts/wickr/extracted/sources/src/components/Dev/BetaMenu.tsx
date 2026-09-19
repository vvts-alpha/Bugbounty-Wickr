import capitalize from 'lodash/capitalize';
import NavRailButton from '../NavRail/NavRailButton';
import { DEFAULT_WEB_ADDRESS } from '../Overlays/BetaFeaturesOverlay';
import {
  AppearanceIcon,
  CodeIcon,
  ConnectivityIcon,
  EditIcon,
  PopOver,
  PopOverItem,
  PopOverSeparator,
  RetryIcon,
  UploadFileIcon,
} from '@/componentlibrary';
import { useAppDispatch, useAppSelector } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { selectAppStage } from '@/store/slices/settings';
import { openModal } from '@/store/thunks/modals';
import { updateTheme } from '@/store/thunks/settings';
import { openLink } from '@/store/thunks/ui';
import { reloadApp } from '@/utils/url';

const BetaMenu = () => {
  const dispatch = useAppDispatch();
  const stageName = capitalize(useAppSelector(selectAppStage));
  const isDarkTheme = useSetting('theme') === 'dark-theme';

  const popoverContent = () => {
    return (
      <>
        <PopOverItem
          icon={<EditIcon />}
          variant="alert"
          onClick={() =>
            dispatch(
              openLink({
                // Web intake SIM
                link: 'https://tiny.amazon.com/be1hg3a6',
                showConfirmation: false,
              })
            )
          }
        >
          {stageName} feedback/bug report
        </PopOverItem>
        <PopOverItem icon={<RetryIcon />} onClick={reloadApp}>
          Reload UI
        </PopOverItem>
        <PopOverItem
          onClick={() => dispatch(updateTheme(isDarkTheme ? 'classic-theme' : 'dark-theme'))}
          icon={<AppearanceIcon />}
        >
          {isDarkTheme ? 'Use classic theme' : 'Use dark theme'}
        </PopOverItem>
        <PopOverItem
          icon={<ConnectivityIcon />}
          onClick={() => dispatch(openModal('CheckSpeedModal'))}
        >
          Speed test
        </PopOverItem>
        <PopOverSeparator />
        <PopOverItem icon={<RetryIcon />} onClick={() => (location.href = DEFAULT_WEB_ADDRESS)}>
          Goto {DEFAULT_WEB_ADDRESS}
        </PopOverItem>
        <PopOverItem
          icon={<UploadFileIcon />}
          onClick={() => dispatch(openModal('UploadDesktopLogsModal'))}
        >
          Upload Desktop Logs
        </PopOverItem>
      </>
    );
  };

  return (
    <PopOver popoverContent={popoverContent} iconGutter placement="right-start">
      <NavRailButton label={stageName} icon={<CodeIcon />} testId="beta-menu" />
    </PopOver>
  );
};
export default BetaMenu;
