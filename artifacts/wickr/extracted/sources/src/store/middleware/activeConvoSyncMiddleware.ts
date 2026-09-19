import { Middleware } from '@reduxjs/toolkit';
import { AppStore } from '..';
import { selectActiveConvoId } from '../slices/shared';
import { setActiveConvoInQt } from '../thunks/convos';

/**
 * Keep activeConvoId in sync between web and QT
 */
export const activeConvoSyncMiddleware: Middleware = (store) => (next) => (action) => {
  const appStore = store as AppStore;
  const previousActiveConvoId = selectActiveConvoId(appStore.getState());

  // Update Redux state
  const result = next(action);

  const currentActiveConvoId = selectActiveConvoId(appStore.getState());

  // Sync with QT if the action caused a change in the activeConvoId
  if (currentActiveConvoId !== previousActiveConvoId) {
    appStore.dispatch(setActiveConvoInQt({ vgroupId: currentActiveConvoId || null }));
  }

  return result;
};
