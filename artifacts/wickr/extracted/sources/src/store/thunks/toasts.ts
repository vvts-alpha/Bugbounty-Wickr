import { ToastItem } from '../slices/toast/toastModels';
import { addToast } from '../slices/toast/toastSlice';
import { createAppAsyncThunk } from '../utils';

export const pushToast = createAppAsyncThunk(
  'toasts/pushToast',
  async (toast: ToastItem, { dispatch }) => {
    dispatch(addToast(toast));
  }
);

export const pushCopyToast = createAppAsyncThunk(
  'toasts/pushCopyToast',
  async (success: boolean, { dispatch, extra }) => {
    if (success) {
      dispatch(
        pushToast({
          label: extra.t('Copied'),
          icon: 'check',
          color: 'primary',
          id: 'copy-success',
        })
      );
    } else {
      dispatch(
        pushToast({
          label: extra.t('Copy failed'),
          icon: 'close',
          color: 'red',
          id: 'copy-failed',
        })
      );
    }
  }
);
