import { FC, useRef } from 'react';
import DevAllIconsModal from '../Dev/DevAllIconsModal';
import DevSettingsInspectorModal from '../Dev/DevSettingsInspectorModal';
import LabFeatureModal from '../Labs/LabFeatureModal';
import { KEY_CODES } from '@/componentlibrary/constants';
import trapFocus from '@/componentlibrary/utils/trap-focus';
import useEventListener from '@/hooks/useEventListener';
import { useAppDispatch, useAppSelector } from '@/store';
import { ModalName, selectActiveModal, selectModalStack } from '@/store/slices/modal';
import { closeModal } from '@/store/thunks/modals';
import AddLinkModal from './AddLinkModal';
import AlertModal from './AlertModal';
import AtoVerificationCodeModal from './AtoVerificationCodeModal';
import BlockUserModal from './BlockUserModal';
import CannotAddUsersModal from './CannotAddUsersModal';
import CantLeaveRoomModal from './CantLeaveRoomModal';
import ChangeAddressModal from './ChangeAddressModal';
import ChangePasswordModal from './ChangePasswordModal';
import CheckSpeedModal from './CheckSpeed';
import CloseAccountModal from './CloseAccountModal';
import ConfirmModal from './ConfirmModal';
import ConvoMembersModal from './ConvoMembersModal';
import CustomConvoTimerModal from './CustomConvoTimerModal';
import DataRetentionModal from './DataRetentionModal';
import DeleteConvoModal from './DeleteConvoModal';
import DeleteFileModal from './DeleteFileModal';
import EnterCodeManuallyModal from './EnterCodeManuallyModal';
import FilePreviewModal from './FilePreviewModal';
import ForceUpdateModal from './ForceUpdateModal';
import ForwardMessageModal from './ForwardMessageModal';
import LeaveConvoModal from './LeaveConvoModal';
import LeaveNetworkModal from './LeaveNetworkModal';
import LimitedGuestAccessModal from './LimitedGuestAccessModal';
import LoadingModal from './LoadingModal';
import LocationModal from './LocationModal';
import ModalErrorBoundary from './ModalErrorBoundary';
import MoveFileModal from './MoveFileModal';
import MyAccountModal from './MyAccountModal';
import MySecurityCodeModal from './MySecurityCodeModal';
import NewFolderModal from './NewFolderModal';
import NewRoomModal from './NewRoomModal';
import ReactionsModal from './ReactionsModal';
import ReferAFriendModal from './ReferAFriendModal';
import RenameItemModal from './RenameItemModal';
import ReportUserModal from './ReportUserModal';
import ResetAccountModal from './ResetAccountModal';
import ResetAppModal from './ResetAppModal';
import SaveFormModal from './SaveFormModal';
import ScanQRCodeModal from './ScanQRCodeModal';
import SdkErrorModal from './SdkErrorModal';
import SessionExpiringModal from './SessionExpiringModal';
import SignIntoOutlookAddInModal from './SignIntoOutlookAddInModal';
import SomethingWentWrongModal from './SomethingWentWrongModal';
import SuspendDeviceModal from './SuspendDeviceModal';
import SyncingDeviceModal from './SyncingDeviceModal';
import TranslationIsEnabledModal from './TranslationIsEnabled';
import UninstallAppModal from './UninstallAppModal';
import UploadDesktopLogsModal from './UploadDesktopLogsModal';
import UploadFileModal from './UploadFileModal';
import UserAlreadyHasAnAccountModal from './UserAlreadyHasAnAccountModal';
import ViewImageModal from './ViewImageModal';

export const ModalManager: FC = () => {
  const modalStack = useAppSelector(selectModalStack);
  const activeModalName = useAppSelector(selectActiveModal)?.name;
  const dispatch = useAppDispatch();
  const modalRefMap = useRef<Map<ModalName, HTMLElement | null>>(new Map());

  const renderModal = (name: ModalName) => {
    if (__DEV__) {
      switch (name) {
        case 'DevSettingsInspectorModal':
          return <DevSettingsInspectorModal />;
        case 'DevAllIconsModal':
          return <DevAllIconsModal />;
      }
    }
    switch (name) {
      case 'MoveFileModal':
        return <MoveFileModal />;
      case 'NewFolderModal':
        return <NewFolderModal />;
      case 'DeleteFileModal':
        return <DeleteFileModal />;
      case 'RenameFileModal':
        return <RenameItemModal />;
      case 'UploadFileModal':
        return <UploadFileModal />;
      case 'SomethingWentWrongModal':
        return <SomethingWentWrongModal />;
      case 'DeleteConvoModal':
        return <DeleteConvoModal />;
      case 'LeaveConvoModal':
        return <LeaveConvoModal />;
      case 'BlockUserModal':
        return <BlockUserModal />;
      case 'SuspendDeviceModal':
        return <SuspendDeviceModal />;
      case 'CustomConvoTimerModal':
        return <CustomConvoTimerModal />;
      case 'ChangeAddressModal':
        return <ChangeAddressModal />;
      case 'AlertModal':
        return <AlertModal />;
      case 'ConvoMembersModal':
        return <ConvoMembersModal />;
      case 'ConfirmModal':
        return <ConfirmModal />;
      case 'CloseAccountModal':
        return <CloseAccountModal />;
      case 'ResetAppModal':
        return <ResetAppModal />;
      case 'ResetAccountModal':
        return <ResetAccountModal />;
      case 'UninstallAppModal':
        return <UninstallAppModal />;
      case 'DataRetentionModal':
        return <DataRetentionModal />;
      case 'TranslationIsEnabledModal':
        return <TranslationIsEnabledModal />;
      case 'MyAccountModal':
        return <MyAccountModal />;
      case 'ChangePasswordModal':
        return <ChangePasswordModal />;
      case 'SignIntoOutlookAddInModal':
        return <SignIntoOutlookAddInModal />;
      case 'LocationModal':
        return <LocationModal />;
      case 'NewRoomModal':
        return <NewRoomModal />;
      case 'LeaveNetworkModal':
        return <LeaveNetworkModal />;
      case 'ViewImageModal':
        return <ViewImageModal />;
      case 'AddLinkModal':
        return <AddLinkModal />;
      case 'LoadingModal':
        return <LoadingModal />;
      case 'ReferAFriendModal':
        return <ReferAFriendModal />;
      case 'UserAlreadyHasAnAccountModal':
        return <UserAlreadyHasAnAccountModal />;
      case 'ReactionsModal':
        return <ReactionsModal />;
      case 'CantLeaveRoomModal':
        return <CantLeaveRoomModal />;
      case 'ScanQRCodeModal':
        return <ScanQRCodeModal />;
      case 'EnterCodeManuallyModal':
        return <EnterCodeManuallyModal />;
      case 'SyncingDeviceModal':
        return <SyncingDeviceModal />;
      case 'ReportUserModal':
        return <ReportUserModal />;
      case 'CheckSpeedModal':
        return <CheckSpeedModal />;
      case 'AtoVerificationCodeModal':
        return <AtoVerificationCodeModal />;
      case 'ForceUpdateModal':
        return <ForceUpdateModal />;
      case 'LimitedGuestAccessModal':
        return <LimitedGuestAccessModal />;
      case 'SaveFormModal':
        return <SaveFormModal />;
      case 'FilePreviewModal':
        return <FilePreviewModal />;
      case 'UploadDesktopLogsModal':
        return <UploadDesktopLogsModal />;
      case 'SdkErrorModal':
        return <SdkErrorModal />;
      case 'CannotAddUsersModal':
        return <CannotAddUsersModal />;
      case 'LabFeatureModal':
        return <LabFeatureModal />;
      case 'MySecurityCodeModal':
        return <MySecurityCodeModal />;
      case 'ForwardMessageModal':
        return <ForwardMessageModal />;
      case 'SessionExpiringModal':
        return <SessionExpiringModal />;
      default:
        return null;
    }
  };

  useEventListener(window, 'keydown', (e) => {
    // Clear the top level modal on ESC
    if (activeModalName && e.key === KEY_CODES.ESCAPE) {
      dispatch(closeModal(activeModalName));
    }

    // Handle focus trapping at the manager level
    // so modals don't need to know if they are active are not
    const activeModalEl = (activeModalName && modalRefMap.current.get(activeModalName)) || null;

    if (e.key === KEY_CODES.TAB && activeModalEl) {
      trapFocus(e, activeModalEl);
    }
  });

  return (
    <>
      {modalStack.map((modal, index) => (
        <div
          ref={(el) => modalRefMap.current.set(modal.name, el)}
          key={modal.name}
          aria-hidden={index !== modalStack.length - 1} // aria-hidden=true for all except the top modal
        >
          <ModalErrorBoundary modalName={modal.name}>{renderModal(modal.name)}</ModalErrorBoundary>
        </div>
      ))}
    </>
  );
};
