import { ChangeEvent, FC } from 'react';
import { List, PanelOverlay, Radio, RadioGroup, Toggle } from '@/componentlibrary';
import { SelectOption } from '@/componentlibrary/Select';
import AccessibleSelect from '@/componentlibrary/Select/AccessibleSelect';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { Theme } from '@/store/slices/settings';
import {
  updateCombinedConvoList,
  updateMessagesRightSide,
  updateTheme,
  updateUseOpenGLES,
  updateWinTextScaleFactor,
} from '@/store/thunks/settings';
import { isWindows } from '@/utils/platform';
import { raw } from '@/utils/strings';
import SettingItem, { Divider } from './SettingItem';

import styles from './styles.module.less';

export const ZOOM_OPTIONS = [0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];

export const AppearanceOverlay: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const messagesRightSide = useSetting('messagesRightSide');
  const combinedConvoSetting = useSetting('convosCombined');
  const useOpenGLES = useSetting('useOpenGLES');
  const winTextScaleFactor = useSetting('winTextScaleFactor');
  const isProd = useSetting('isProduction');
  const theme = useSetting('theme');

  const handleThemeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value as Theme;
    dispatch(updateTheme(value));
  };

  return (
    <PanelOverlay title={t('Appearance')}>
      <List>
        <SettingItem
          title={t('Enable Stretch-to-Fit Messages')}
          description={t(
            'Enable this to left align all messages and have them stretch to fit across the entire chat. Eliminates white space. Disable for a text message-like appearance.'
          )}
        >
          <Toggle
            label={t('Enable Stretch-to-Fit Messages')}
            checked={!messagesRightSide} // messagesRightSide is the inverse of Stretch-to-Fit
            onChange={() => dispatch(updateMessagesRightSide(!messagesRightSide))}
          />
        </SettingItem>
        <SettingItem
          title={t('Combine my rooms/DMs')}
          description={t(
            'Enabling this will combine your rooms and direct messages on desktop sidebar.'
          )}
        >
          <Toggle
            label={t('Combine my rooms/DMs')}
            checked={combinedConvoSetting}
            onChange={() => dispatch(updateCombinedConvoList(!combinedConvoSetting))}
          />
        </SettingItem>
        {isWindows() && (
          <SettingItem
            title={t('Alternative OpenGL')}
            description={t(
              'Use alternative OpenGL option for users who experience display issues.  You must restart the application for this to take effect.'
            )}
          >
            <Toggle
              label={t('Alternative OpenGL')}
              checked={useOpenGLES}
              onChange={() => dispatch(updateUseOpenGLES(!useOpenGLES))}
            />
          </SettingItem>
        )}
        {isWindows() && (
          <SettingItem
            title="Zoom"
            description="Set the zoom of the app. You can also change the zoom level by pressing Ctrl +/-"
          >
            <Divider />
            <AccessibleSelect
              label={t('Zoom Level')}
              options={ZOOM_OPTIONS.map((z) => ({ label: `${Math.floor(z * 100)}%`, value: z }))}
              onChange={(value: SelectOption['value']) =>
                dispatch(updateWinTextScaleFactor(parseFloat(value.toString())))
              }
              selectedOption={{
                value: winTextScaleFactor,
                label: `${Math.floor(winTextScaleFactor * 100)}%`,
              }}
              className={styles.selectContainer}
              offset={[20, -12]}
              menuClassName={styles.selectMenu}
            />
          </SettingItem>
        )}

        <SettingItem title={t('Theme')}>
          <RadioGroup name="theme" className={styles.radioGroup}>
            <Radio
              value="classic-theme"
              label={t('Classic Theme')}
              checked={theme === 'classic-theme'}
              onChange={handleThemeChange}
            />
            <Radio
              value="dark-theme"
              label={t('Dark Theme')}
              checked={theme === 'dark-theme'}
              onChange={handleThemeChange}
            />
            {!isProd && (
              <Radio
                value="light-theme"
                label={raw('Light Theme (Beta only)')}
                checked={theme === 'light-theme'}
                onChange={handleThemeChange}
              />
            )}
          </RadioGroup>
        </SettingItem>
      </List>
    </PanelOverlay>
  );
};

export default AppearanceOverlay;
