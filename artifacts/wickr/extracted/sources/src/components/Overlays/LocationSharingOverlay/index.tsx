import { clsx } from 'clsx';
import { FC } from 'react';
import SettingItem, { Divider } from '../SettingItem';
import { Counter, List, PanelOverlay, Toggle } from '@/componentlibrary';
import { SelectOption } from '@/componentlibrary/Select';
import AccessibleSelect from '@/componentlibrary/Select/AccessibleSelect';
import { AppTranslationKey, useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { setOverlay } from '@/store/slices/overlay';
import { updateZoomLevel, updateDisplayMaps, updateMapType } from '@/store/thunks/settings';

import styles from './styles.module.less';

export enum MapTypeValue {
  RoadMap = 0,
  Satellite = 1,
  Terrain = 2,
  Hybrid = 3,
}

export const MAX_MAP_ZOOM = 18; // Map stops rendering when zoom is more than this
export const MIN_MAP_ZOOM = 3;

type MapType = 'Road Map' | 'Satellite' | 'Terrain' | 'Hybrid';

export const mapTypes = new Map<MapType, MapTypeValue>([
  ['Road Map', MapTypeValue.RoadMap],
  ['Satellite', MapTypeValue.Satellite],
  ['Terrain', MapTypeValue.Terrain],
  ['Hybrid', MapTypeValue.Hybrid],
]);

export const LocationSharingOverlay: FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useAppTranslation();
  const displayMapsEnabled = useSetting('displayMaps');
  const mapType = useSetting('mapType') as number;
  const zoomLevel = useSetting('zoomLevel') as number;

  return (
    <PanelOverlay
      onClose={() => dispatch(setOverlay('PrivacyAndSafety'))}
      closeLabel={t('Back')}
      title={t('Location Sharing')}
    >
      <List>
        <SettingItem
          title={t('Enable Map Display')}
          description={t('Map will display automatically for shared locations')}
        >
          <Toggle
            label={t('Enable Map Display')}
            checked={displayMapsEnabled}
            onChange={() => dispatch(updateDisplayMaps(!displayMapsEnabled))}
          />
        </SettingItem>
        <SettingItem
          title={t('Default Map')}
          description={t('Default map type used when map is initially displayed')}
          className={clsx(styles.divided, styles.mapType)}
        >
          <Divider />
          <AccessibleSelect
            label={t('Map Type')}
            options={[...mapTypes].map(([mapType, value]) => ({ label: t(mapType), value }))}
            onChange={(value: SelectOption['value']) =>
              dispatch(updateMapType(parseInt(value.toString())))
            }
            selectedOption={{
              label: t(MapTypeValue[mapType] as AppTranslationKey),
              value: mapType,
            }}
            className={styles.selectContainer}
            offset={[20, -12]}
            menuClassName={styles.selectMenu}
          />
        </SettingItem>
        <SettingItem
          title={t('Default Map Zoom')}
          description={t('Default map zoom level when map is initially displayed')}
        >
          <Divider />
          <Counter
            count={zoomLevel}
            step={1}
            min={MIN_MAP_ZOOM}
            max={MAX_MAP_ZOOM}
            onChange={(count: number) => {
              dispatch(updateZoomLevel(count));
            }}
            className={styles.mapZoomCounter}
          />
        </SettingItem>
      </List>
    </PanelOverlay>
  );
};

export default LocationSharingOverlay;
