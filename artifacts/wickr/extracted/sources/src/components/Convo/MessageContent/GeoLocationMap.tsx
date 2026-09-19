import { clsx } from 'clsx';
import Leaflet from 'leaflet';
import { FC, useEffect, useRef, useState } from 'react';
import { GetGoogleMapsApiInfoResult } from '@/apis/webChannel/BridgeWebChannel';
import { useWebChannel } from '@/apis/webChannel/context';
import { Button } from '@/componentlibrary';
import { SelectOption } from '@/componentlibrary/Select';
import AccessibleSelect from '@/componentlibrary/Select/AccessibleSelect';
import {
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  MapTypeValue,
  mapTypes,
} from '@/components/Overlays/LocationSharingOverlay';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useAppTranslation } from '@/lib/i18n';
import { Logger } from '@/lib/logger';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { LocationParams } from '@/store/slices/modal';
import { updateMapType } from '@/store/thunks/settings';
import { sanitizeHTML } from '@/utils/dom';
import { createGoogleMapsTileUrl } from '@/utils/geoLocation';
import mapMarker from './map-marker.png';

import styles from './GeoLocationMap.module.less';
import 'leaflet/dist/leaflet.css';

const logger = new Logger('GeoLocationMap');

interface GeoLocationMapProps extends LocationParams {
  /** Set to true if this map is interactive (eg. draggable, zoomable, show controls) */
  interactive?: boolean;
  /** Optional handler when clicking on the map (used for non-interactive maps) */
  onClick?: () => void;
}

const GOOGLE_ATTRIBUTION =
  '&copy; <a href="https://about.google/brand-resource-center/products-and-services/geo-guidelines/#google-maps">Google Maps</a>';

export const GeoLocationMap: FC<GeoLocationMapProps> = ({
  latitude,
  longitude,
  senderName,
  interactive = true,
  onClick,
}) => {
  const { t } = useAppTranslation();
  const dispatch = useAppDispatch();
  const { bridge } = useWebChannel();
  const map = useRef<Leaflet.Map>();
  const mapContainer = useRef<HTMLDivElement>(null);
  const roadmapLayer = useRef<Leaflet.TileLayer>();
  const satelliteLayer = useRef<Leaflet.TileLayer>();
  const terrainLayer = useRef<Leaflet.TileLayer>();
  const hybridLayer = useRef<Leaflet.TileLayer>();
  const mapType = useSetting('mapType');
  const zoomLevel = useSetting('zoomLevel');
  const [gmInfo, setGmInfo] = useState<GetGoogleMapsApiInfoResult | undefined>();
  const marker = useRef<Leaflet.Marker>();
  const prefersReducedMotion = usePrefersReducedMotion();

  const removeMap = () => {
    map.current?.remove();
    map.current = undefined;
    marker.current?.unbindPopup();
    marker.current = undefined;
    roadmapLayer.current = undefined;
    satelliteLayer.current = undefined;
    terrainLayer.current = undefined;
    hybridLayer.current = undefined;
  };

  const updateGmInfo = async () => {
    setGmInfo(await bridge.getGoogleMapsApiInfo());
  };

  /** Changes map layers based on current selected map type. */
  const updateMapLayers = () => {
    if (!map.current) {
      return;
    }

    roadmapLayer.current?.removeFrom(map.current);
    terrainLayer.current?.removeFrom(map.current);
    satelliteLayer.current?.removeFrom(map.current);
    hybridLayer.current?.removeFrom(map.current);

    switch (mapType) {
      case MapTypeValue.Satellite:
        satelliteLayer.current?.addTo(map.current);
        break;
      case MapTypeValue.Terrain:
        terrainLayer.current?.addTo(map.current);
        break;
      case MapTypeValue.Hybrid:
        hybridLayer.current?.addTo(map.current);
        break;
      default:
        roadmapLayer.current?.addTo(map.current);
    }
  };

  useEffect(updateMapLayers, [mapType, map]);

  const createMap = () => {
    if (!mapContainer.current || !gmInfo) {
      return;
    }

    const lat = latitude ?? 0;
    const lng = longitude ?? 0;

    // Create map
    map.current = Leaflet.map(mapContainer.current, {
      center: [lat, lng],
      minZoom: MIN_MAP_ZOOM,
      maxZoom: MAX_MAP_ZOOM,
      zoom: zoomLevel,
      zoomControl: false,
      dragging: interactive,
      keyboard: interactive,
      boxZoom: interactive,
      doubleClickZoom: interactive,
    });

    // Remove leaflet prefix on attribution
    map.current.attributionControl.setPrefix('');

    // Create tile layers

    // Roadmap
    roadmapLayer.current = Leaflet.tileLayer(
      createGoogleMapsTileUrl(`{x}`, `{y}`, `{z}`, gmInfo.roadmapSessionToken, gmInfo.apiKey),
      {
        attribution: GOOGLE_ATTRIBUTION,
      }
    );

    // Terrain
    terrainLayer.current = Leaflet.tileLayer(
      createGoogleMapsTileUrl(`{x}`, `{y}`, `{z}`, gmInfo.terrainSessionToken, gmInfo.apiKey),
      {
        attribution: GOOGLE_ATTRIBUTION,
      }
    );

    // Satellite
    satelliteLayer.current = Leaflet.tileLayer(
      createGoogleMapsTileUrl(`{x}`, `{y}`, `{z}`, gmInfo.satelliteSessionToken, gmInfo.apiKey),
      {
        attribution: GOOGLE_ATTRIBUTION,
      }
    );

    // Hybrid
    hybridLayer.current = Leaflet.tileLayer(
      createGoogleMapsTileUrl(`{x}`, `{y}`, `{z}`, gmInfo.hybridSessionToken, gmInfo.apiKey),
      {
        attribution: GOOGLE_ATTRIBUTION,
      }
    );

    updateMapLayers();

    // Add marker for the user's location
    const markerSize = 32;
    marker.current = Leaflet.marker([lat, lng], {
      icon: Leaflet.icon({
        iconUrl: mapMarker,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize],
        popupAnchor: [0, -markerSize],
      }),
      interactive,
      keyboard: interactive,
    }).addTo(map.current);

    if (interactive) {
      // Customize zoom control text
      const zoomControls = Leaflet.control.zoom({
        zoomInTitle: t('Zoom in'),
        zoomOutTitle: t('Zoom out'),
        position: 'bottomleft',
      });
      zoomControls.addTo(map.current);

      marker.current.bindPopup(sanitizeHTML(senderName ?? ''));
    }
  };

  // Get map API keys
  useEffect(() => {
    updateGmInfo();
  }, []);

  // Update the map's zoom if the zoom setting is changed
  useEffect(() => {
    map.current?.setZoom(zoomLevel);
  }, [zoomLevel]);

  useEffect(() => {
    createMap();
    return removeMap;
  }, [mapContainer, gmInfo, interactive]);

  // Update marker location
  useEffect(() => {
    if (!latitude || !longitude) {
      return;
    }

    marker.current?.setLatLng([latitude, longitude]);

    if (!interactive) {
      // Fly (or jump) to new location on non-interactive maps so the marker stays centered
      prefersReducedMotion
        ? map.current?.setView([latitude, longitude])
        : map.current?.flyTo([latitude, longitude]);
    }
  }, [latitude, longitude, marker, prefersReducedMotion]);

  const handleMapTypeChange = (value: SelectOption['value']) => {
    dispatch(updateMapType(parseInt(value.toString())));
  };

  // Use a button wrapper element for static maps in chat messages
  const WrappingEl = interactive ? 'div' : Button;

  if (!latitude || !longitude) {
    logger.warn(`Failed to render map: latitude/longitude not provided`);
    return null;
  }

  const selectedItemLabel = [...mapTypes].find((m) => m[1] === mapType)?.[0];

  return (
    <WrappingEl
      className={clsx(styles.container, {
        [styles.interactive]: interactive,
      })}
      onClick={onClick}
    >
      {interactive && (
        <AccessibleSelect
          label={t('Map Type')}
          options={[...mapTypes].map(([mapType, value]) => ({ label: t(mapType), value }))}
          onChange={handleMapTypeChange}
          selectedOption={{
            value: mapType,
            label: selectedItemLabel ? t(selectedItemLabel) : '',
          }}
          className={styles.accessibleSelect}
          menuClassName={styles.selectMenu}
          offset={[5, -5]}
        />
      )}
      <div
        className={styles.map}
        // Only include label for static maps. Interactive maps can be navigated around inside the
        // map (markers, controls, etc), so there is no need for an overall map label.
        aria-label={interactive ? undefined : t('Open map')}
        ref={mapContainer}
      >
        <div className={styles.innerDiv} />
      </div>
    </WrappingEl>
  );
};
