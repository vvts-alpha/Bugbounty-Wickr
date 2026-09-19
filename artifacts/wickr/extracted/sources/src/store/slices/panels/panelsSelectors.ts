import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';
import { Panel, PanelName } from './panelsModels';

const selectPanelsRoot = (state: AppRootState) => state.panels;

export const selectActivePanel = createSelector(selectPanelsRoot, (panels) =>
  panels.panelStack.length ? panels.panelStack[panels.panelStack.length - 1] : undefined
);

export const selectIsActivePanel = createSelector(
  selectActivePanel,
  (_: any, panelName: PanelName) => panelName,
  (panel: Panel | undefined, panelName: PanelName) => {
    return panel?.name === panelName;
  }
);

export const selectPanels = createSelector(selectPanelsRoot, (panels) => panels.panelStack);

export const selectContactsPanelInitialTab = createSelector(
  selectActivePanel,
  (panel: Panel | undefined) => {
    return panel?.name === 'ContactsPanel' ? panel.initialTab : undefined;
  }
);

export const selectSearchPanelInitialStarred = createSelector(
  selectActivePanel,
  (panel: Panel | undefined) => {
    return panel?.name === 'SearchPanel' ? panel.initialStarred : false;
  }
);
