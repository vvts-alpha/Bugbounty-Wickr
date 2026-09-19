import { Logger } from '@/lib/logger';

import * as account from './slices/account';
import * as coachMarks from './slices/coachMarks';
import * as convos from './slices/convos';
import * as deviceSync from './slices/deviceSync';
import * as features from './slices/features';
import * as files from './slices/files';
import * as identity from './slices/identity';
import * as media from './slices/media';
import * as meetings from './slices/meetings';
import * as modal from './slices/modal';
import * as os from './slices/os';
import * as overlay from './slices/overlay';
import * as panels from './slices/panels';
import * as roomHistory from './slices/roomHistory';
import * as roomSearch from './slices/roomSearch';
import * as settings from './slices/settings';
import * as shared from './slices/shared';
import * as toast from './slices/toast';
import * as uiApp from './slices/uiApp';
import * as uiChat from './slices/uiChat';
import * as users from './slices/users';
import * as windows from './slices/windows';

import * as coachMarkThunks from './thunks/coachMarks';
import * as convosThunks from './thunks/convos';
import * as featureThunks from './thunks/features';
import * as fileThunks from './thunks/files';
import * as identityThunks from './thunks/identity';
import * as messagesThunks from './thunks/messages';
import * as modalThunks from './thunks/modals';
import * as roomHistoryThunks from './thunks/roomHistory';
import * as roomSearchThunks from './thunks/roomSearch';
import * as sdkErrorCodeThunks from './thunks/sdkErrorCode';
import * as settingsThunks from './thunks/settings';
import * as toastThunks from './thunks/toasts';
import * as translationThunks from './thunks/translation';
import * as uiThunks from './thunks/ui';
import * as usersThunks from './thunks/users';

export function getStoreActionsAndSelectors() {
  const logger = new Logger('store-dev');

  const actions: any = {};
  const dispatchActions: any = {};
  const selectors: any = {};
  const getStore = () => (globalThis as any)._store;

  const process = (mod: any, dryRun = false) => {
    for (const key in mod) {
      const value = mod[key];

      if (typeof value === 'function') {
        if (key.startsWith('select')) {
          if (dryRun) {
            logger.info('selector:', key);
          } else {
            selectors[key] = (...args: any[]) => {
              args[0] ??= getStore()?.getState();
              return value(...args);
            };
          }
        } else if (!key.endsWith('Reducer')) {
          // assume action
          if (dryRun) {
            logger.info('action:', key);
          } else {
            actions[key] = value;
            dispatchActions[key] = (...args: any[]) => {
              getStore()?.dispatch(value(...args));
            };
          }
        }
      }
    }
  };

  process(account);
  process(coachMarks);
  process(convos);
  process(deviceSync);
  process(features);
  process(files);
  process(identity);
  process(media);
  process(meetings);
  process(modal);
  process(os);
  process(overlay);
  process(panels);
  process(roomHistory);
  process(roomSearch);
  process(settings);
  process(shared);
  process(toast);
  process(uiApp);
  process(uiChat);
  process(users);
  process(windows);

  process(coachMarkThunks);
  process(convosThunks);
  process(featureThunks);
  process(fileThunks);
  process(identityThunks);
  process(messagesThunks);
  process(modalThunks);
  process(roomHistoryThunks);
  process(roomSearchThunks);
  process(sdkErrorCodeThunks);
  process(settingsThunks);
  process(toastThunks);
  process(translationThunks);
  process(uiThunks);
  process(usersThunks);

  return {
    _action: actions,
    _dispatch: dispatchActions,
    _select: selectors,
  };
}

if (__DEV__) {
  // Object.assign(globalThis, getStoreActionsAndSelectors())
}
