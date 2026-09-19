import { createSelector } from '@reduxjs/toolkit';
import { AppRootState } from '@/store/models';
import {
  CustomConvoTimerModalParams,
  DeleteMeetingSeriesModalParams,
  ModalWithUserIdHashParam,
  ModalWithVGroupIdParam,
  RemoveSelfFromMeetingSeriesModalParams,
  SuspendDeviceModalParams,
  UploadFileModalParams,
  ChangeAddressModalParams,
  DataRetentionModalParams,
  AlertModalParams,
  ConvoMembersModalParams,
  ConfirmModalParams,
  LocationModalParams,
  LeaveNetworkModalParams,
  ViewImageModalParams,
  AddLinkModalParams,
  LoadingModalParams,
  ModalName,
  UserAlreadyHasAnAccountModalParams,
  ReactionsModalParams,
  ScanQRCodeModalParams,
  EnterCodeManuallyParams,
  ReportUserModalParams,
  AtoVerificationCodeModalParams,
  FilePreviewModalParams,
  ResetAppModalParams,
  SdkErrorModalParams,
  ForwardMessageModalParams,
  CannotAddUsersModalParams,
} from './modalModels';

const selectModalState = (appState: AppRootState) => appState.modal;

export const selectModalStack = createSelector(selectModalState, (state) => state.stack);

export const selectHasModals = createSelector(selectModalStack, (stack) => stack.length > 0);

export const selectActiveModal = createSelector(selectModalStack, (stack) => {
  if (!stack.length) return undefined;

  return stack[stack.length - 1];
});

function createModalParamsSelector<T>(modalName: ModalName) {
  return createSelector(selectModalStack, (stack) => {
    const modal = stack.find((modal) => modal.name === modalName);
    // Assume the params are defined, because we enforce the setting of params with TypeScript (build time).
    // We still have a runtime error handler if a Modal is missing its parameters, so bad params won't crash everything.
    return modal?.params as T;
  });
}

export const selectUploadFileModalParams =
  createModalParamsSelector<UploadFileModalParams>('UploadFileModal');

export const selectDeleteConvoModalParams =
  createModalParamsSelector<ModalWithVGroupIdParam>('DeleteConvoModal');

export const selectLeaveConvoModalParams =
  createModalParamsSelector<ModalWithVGroupIdParam>('LeaveConvoModal');

export const selectBlockUserModalParams =
  createModalParamsSelector<ModalWithUserIdHashParam>('BlockUserModal');

export const selectCustomConvoTimerModalParams =
  createModalParamsSelector<CustomConvoTimerModalParams>('CustomConvoTimerModal');

export const selectSuspendDeviceModalParams =
  createModalParamsSelector<SuspendDeviceModalParams>('SuspendDeviceModal');

export const selectDeleteMeetingSeriesModalParams =
  createModalParamsSelector<DeleteMeetingSeriesModalParams>('DeleteMeetingSeriesModal');

export const selectRemoveSelfFromMeetingSeriesModalParams =
  createModalParamsSelector<RemoveSelfFromMeetingSeriesModalParams>(
    'RemoveSelfFromMeetingSeriesModal'
  );

export const selectChangeAddressModalParams =
  createModalParamsSelector<ChangeAddressModalParams>('ChangeAddressModal');

export const selectDataRetentionModalParams =
  createModalParamsSelector<DataRetentionModalParams>('DataRetentionModal');

export const selectLoadingModalParams =
  createModalParamsSelector<LoadingModalParams>('LoadingModal');

export const selectConvoMembersModalParams =
  createModalParamsSelector<ConvoMembersModalParams>('ConvoMembersModal');

export const selectAlertModalParams = createModalParamsSelector<AlertModalParams>('AlertModal');

export const selectLocationModalParams =
  createModalParamsSelector<LocationModalParams>('LocationModal');

export const selectConfirmModalParams =
  createModalParamsSelector<ConfirmModalParams>('ConfirmModal');

export const selectLeaveNetworkModalParams =
  createModalParamsSelector<LeaveNetworkModalParams>('LeaveNetworkModal');

export const selectViewImageModalParams =
  createModalParamsSelector<ViewImageModalParams>('ViewImageModal');

export const selectAddLinkModalParams =
  createModalParamsSelector<AddLinkModalParams>('AddLinkModal');

export const selectUserAlreadyHasAnAccountParams =
  createModalParamsSelector<UserAlreadyHasAnAccountModalParams>('UserAlreadyHasAnAccountModal');

export const selectReactionsModalParams =
  createModalParamsSelector<ReactionsModalParams>('ReactionsModal');

export const selectCantLeaveRoomModalParams =
  createModalParamsSelector<ModalWithVGroupIdParam>('CantLeaveRoomModal');

export const selectScanQRCodeModalParams =
  createModalParamsSelector<ScanQRCodeModalParams>('ScanQRCodeModal');

export const selectEnterCodeManuallyModalParams =
  createModalParamsSelector<EnterCodeManuallyParams>('EnterCodeManuallyModal');

export const selectReportUserModalParams =
  createModalParamsSelector<ReportUserModalParams>('ReportUserModal');

export const selectAtoVerificationModalParams =
  createModalParamsSelector<AtoVerificationCodeModalParams>('AtoVerificationCodeModal');

export const selectFilePreviewModalParams =
  createModalParamsSelector<FilePreviewModalParams>('FilePreviewModal');

export const selectResetAppModalParams =
  createModalParamsSelector<ResetAppModalParams>('ResetAppModal');

export const selectSdkErrorModalParams =
  createModalParamsSelector<SdkErrorModalParams>('SdkErrorModal');

export const selectForwardMessageModalParams =
  createModalParamsSelector<ForwardMessageModalParams>('ForwardMessageModal');

export const selectCannotAddUsersModalParams =
  createModalParamsSelector<CannotAddUsersModalParams>('CannotAddUsersModal');
