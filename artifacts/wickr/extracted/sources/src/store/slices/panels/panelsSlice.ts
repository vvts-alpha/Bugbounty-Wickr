import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createResetSliceReducer, resetSlice } from '../shared';
import { Logger } from '@/lib/logger';
import { Panel, PanelsState } from './panelsModels';

const initialState: PanelsState = { panelStack: [] };

const logger = new Logger('PanelSlice');

export const panelsSlice = createSlice({
  name: 'panels',
  initialState,
  reducers: {
    pushPanel: (state, { payload }: PayloadAction<Panel>) => {
      if (state.panelStack.find((p) => p.name === payload.name)) {
        return logger.warn('Panel rejected, already open:', payload.name);
      }
      state.panelStack.push(payload);
    },
    popPanel: (state) => {
      state.panelStack.pop();
    },
    /**
     * Pushes the panel if it is not present,
     * and pops the panel if it is the top panel,
     * even if other args are different.
     */
    togglePanel: (state, { payload }: PayloadAction<Panel>) => {
      if (state.panelStack[0]?.name === payload.name) {
        state.panelStack.pop();
      } else {
        if (state.panelStack.find((p) => p.name === payload.name)) {
          return logger.warn('Panel rejected, already open:', payload.name);
        }
        state.panelStack.push(payload);
      }
    },
    clearPanelStack: (state) => {
      state.panelStack = [];
    },
    setPanelStack: (state, { payload }: PayloadAction<Panel>) => {
      state.panelStack = [payload];
    },
  },
  extraReducers(builder) {
    builder.addCase(resetSlice, createResetSliceReducer('panels', initialState));
  },
});

export const panelsReducer = panelsSlice.reducer;
export const { pushPanel, popPanel, togglePanel, clearPanelStack, setPanelStack } =
  panelsSlice.actions;
