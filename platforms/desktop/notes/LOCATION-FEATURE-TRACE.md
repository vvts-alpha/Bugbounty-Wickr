# Wickr 6.72.20 — Share Location / MsgType_Location trace (source-backed, no exploitation)

Sources recovered from embedded sourcemaps (`sourcesContent` = original TS). Bundles:
`wickr-BXqo7ivg.js` (main) + chunk `app-DOUtVdma.js` map = `map_014eb483` (12.5MB), chunk maps
`map_0175e9e0`, `map_01ae5cc5`. Extracted TS in `scratchpad/locsrc/`. Line numbers = original file.

## Key files
- src/store/thunks/ui.ts — shareCurrentLocation (360-427), openLink (146-169), showLocationShareErrorModal (337-358)
- src/store/thunks/convos.ts — sendLocationMessage (377-383)
- src/utils/geoLocation.ts — createGoogleMapsTileUrl (32-38), getGoogleMapsLocationUrl (40-41), getGeoLocation (48-66), fromLatLngToTileCoord (21-30)
- src/components/Modals/LocationModal/index.tsx — LocationModal (20-33), View (36-75), Forwarded (77-97), Share (100-141)
- src/components/Convo/MessageContent/GeoLocationMap.tsx — whole map (1-269): Leaflet import (2), tile layers (133-162), marker (168-177), bindPopup (188), container div (258-266), GOOGLE_ATTRIBUTION (38-39)
- src/components/Convo/ConvoMessageLocationContent.tsx — incoming render (74-116)
- src/components/Convo/ConvoMessageLocationText.tsx — text fallback + ExternalLink (11-24)
- src/components/Convo/BaseConvoMessage.tsx — MsgType_Location case (309-317), handleClickLocationContent (144-169), senderName (114)
- src/components/Convo/MessagePreview/index.tsx — handleClickLocationContent (69-96), MsgType_Location (141-151)
- src/components/ExternalLinks.tsx — ExternalLinkManager global <a> click→openLink (7-37)
- src/utils/links.ts — shouldShowLinkConfirmation (7-17)
- src/utils/dom.ts — sanitizeHTML (342-353)
- src/apis/webChannel/WickrSettingsSubscriptions.tsx — mapTypeChanged (89-92)
- src/components/Overlays/LocationSharingOverlay/index.tsx — MapTypeValue (15-20), zoom (22-23), mapTypes (27-32)
- src/lib/protobuf/messages.ts — WickrMessageLocation (127-130); MessageBody oneof `Location location = 9`
- node_modules/leaflet/dist/leaflet-src.js — popup innerHTML sink (10034)

## Answers
1. shareCurrentLocation (ui.ts:360-427) → openModal LocationModal {type:'share'} (396-407) → **LocationModal→ShareLocationModalContent** (LocationModal/index.tsx:100-141) → **GeoLocationMap** interactive (125-129). (LoadingModal may precede, 372-381.)
2. **Leaflet**, bundled LOCALLY (import 'leaflet' GeoLocationMap.tsx:2; leaflet-src.js ~450KB embedded). No CDN.
3. Only external network resource = Google 2D map **tiles (images)**: `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session={sessionToken}&key={apiKey}` (geoLocation.ts:38; tokens/key from native bridge.getGoogleMapsApiInfo, GeoLocationMap.tsx:74-75,133-162). Marker icon = local map-marker.png (24,170). Hyperlinks (navigated only on click, not fetched): attribution https://about.google/... (38-39) fixed; https://google.com/maps?q={lat},{lng} (geoLocation.ts:40-41) data-derived.
4. **Normal DOM** — Leaflet.map on a `<div ref>` (GeoLocationMap.tsx:115,258-266) with `<img>` tiles + `<img>` marker. No iframe / WebEngineView / canvas.
5. MsgType_Location = MessageBody oneof `Location location = 9`. Location proto (decode from bundle) = exactly **latitude (double #1), longitude (double #2), shareExpiration (int64 #3)**; verify() requires lat/long numbers. Envelope (not in Location sub-msg): senderHash→senderName, editTimestamp/timeStamp→lastUpdated.
6. Sender-controlled: **latitude, longitude, shareExpiration** (all numeric after decode) + envelope display name (senderName). Web send path only supplies lat/long/vgroupId (ui.ts:414-419 → convos.ts:377-383); a malicious peer's protobuf controls all three Location fields.
7. Incoming: BaseConvoMessage.tsx:309-317 `case MsgType_Location` → ConvoMessageLocationContent (74-116): maps-on → static GeoLocationMap interactive=false (91-97)+LiveLocationContentLabel; maps-off → ConvoMessageLocationText link (102); disabled → admin text. Click tile → handleClickLocationContent (BaseConvoMessage 144-169): enterprise→openLink(mapsURL,noConfirm); else openModal LocationModal 'view' (159-168)→ interactive GeoLocationMap + senderName popup.
8. Sender-data sinks:
   - HTML / marker-popup: senderName → sanitizeHTML (dom.ts:342-353, DOMParser→textContent strip) → Leaflet marker.bindPopup (GeoLocationMap.tsx:188, INTERACTIVE only; static tile 179-guarded) → Leaflet node.innerHTML (leaflet-src.js:10034). ONLY sender→innerHTML path. Any resulting inline handler is CSP-blocked (script-src 'self').
   - image/icon URL: none sender-controlled (marker=local png; tiles use native token + numeric {x}{y}{z}).
   - link URL: getGoogleMapsLocationUrl(lat,lng) https://google.com/maps?q=<num>,<num> (geoLocation.ts:40-41) in ConvoMessageLocationText:12,19 + handleClickLocationContent (BaseConvoMessage:149-152 / MessagePreview:76-79). Numeric → fixed scheme+host. Attribution href fixed.
   - CSS: none sender-controlled.
   - map config: lat/long (numeric) → center/marker/tiles; shareExpiration → live-until label. mapType/zoom/displayMaps = local settings, not sender-controlled.
9. openLink callers while map/tile open: (a) handleClickLocationContent enterprise branch (BaseConvoMessage.tsx:146-156, MessagePreview.tsx:73-84) → openLink({link:getGoogleMapsLocationUrl(msg.location.lat,lng), showConfirmation:false}); (b) global ExternalLinkManager (ExternalLinks.tsx:7-37) on any <a> click → openLink({link:anchor.href, showConfirmation:shouldShowLinkConfirmation}).
10. Data-derived (maps URL from sender lat/long, numeric) or fixed (attribution). Confirmation: enterprise tile-click passes showConfirmation:false (no ConfirmModal); ExternalLinkManager uses shouldShowLinkConfirmation (links.ts:7-17) = false when text==href (maps text-link) → no modal, true for attribution. Scheme validation: NONE in web layer (only ExternalLinkManager skips qrc:, ExternalLinks.tsx:20); openLink thunk passes link straight to native uiBridge.openLink (ui.ts:163/166) → native http/https/mailto allowlist. URL built as https://google.com/... with numeric params → no scheme/host injection from the web side.
