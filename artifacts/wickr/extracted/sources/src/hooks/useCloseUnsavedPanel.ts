import { SaveFormModalReturn } from '@/components/Modals/SaveFormModal';
import { useAppDispatch } from '@/store';
import { useAbortableDispatch } from '@/store/hooks/useAbortableDispatch';
import { popPanel } from '@/store/slices/panels';
import { openModal } from '@/store/thunks/modals';

/**
 * A custom hook that handles the logic for closing a panel with unsaved changes.
 * It manages the workflow of prompting users to save or discard changes before closing.
 *
 * @param {boolean} changed - Indicates whether the form has unsaved changes
 * @param {Function} submitHandler - Function to execute when user chooses to save changes
 * @param {Function} [discardHandler] - Optional function to execute when user chooses to discard changes
 * @returns {() => Promise<void>} An async function that handles the panel closing logic
 *
 * @description
 * The hook implements the following behavior:
 * - If there are no changes (`changed` is false), it either calls the discardHandler or closes the panel
 * - If there are changes, it opens a confirmation modal with Save/Discard options
 * - On 'Save': Executes the submitHandler
 * - On 'Discard': Executes discardHandler if provided, otherwise closes the panel
 * - On modal cancellation or error: No action is taken
 *
 * @example
 * const closePanel = useCloseUnsavedPanel(
 *   formHasChanges,
 *   handleSubmit,
 *   handleDiscard
 * );
 */
export const useCloseUnsavedPanel = (
  changed: boolean,
  submitHandler: Function,
  discardHandler?: Function
) => {
  const abortableDispatch = useAbortableDispatch();
  const dispatch = useAppDispatch();

  const discard = () => {
    if (discardHandler) {
      discardHandler();
    } else {
      dispatch(popPanel());
    }
  };

  const handler = async () => {
    if (!changed) {
      discard();
      return;
    }
    try {
      const userSelection = (await abortableDispatch(
        openModal('SaveFormModal')
      )) as SaveFormModalReturn;

      if (userSelection === 'save') {
        submitHandler();
      } else if (userSelection === 'discard') {
        discard();
      }
    } catch {
      // no-op
    }
  };

  return handler;
};
