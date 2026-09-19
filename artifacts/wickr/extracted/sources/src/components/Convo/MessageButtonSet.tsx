import { clsx } from 'clsx';
import React, { FC } from 'react';
import { Button } from '@/componentlibrary';
import { WickrMessageButton } from '@/lib/protobuf/messages';
import { useAppDispatch } from '@/store';
import { sendTextMessage, shareLocation, createDM } from '@/store/thunks/messages';
import { openLink } from '@/store/thunks/ui';

import styles from './MessageButtonSet.module.less';

interface MessageButtonSetProps {
  buttons?: WickrMessageButton[];
  convoId: string;
}

const MessageButtonSet: FC<MessageButtonSetProps> = ({ buttons, convoId }) => {
  const dispatch = useAppDispatch();
  const renderButtons = buttons?.map((button, index) => {
    let handleClick;
    let buttonLabel: string | null | undefined;
    const dmButton = button.dmButton;
    if (dmButton) {
      const message = dmButton.msgToDM || '';
      const ackMessage = dmButton.msgToSend || '';
      const userId = dmButton.userAlias || '';
      const userHash = dmButton.idhash || '';

      handleClick = () => {
        dispatch(createDM({ message, userId, userHash: userHash }));
        dispatch(sendTextMessage({ message: ackMessage, vgroupId: convoId }));
      };
      buttonLabel = dmButton.text;
    } else if (button.locationButton) {
      handleClick = () => {
        dispatch(shareLocation());
      };
      buttonLabel = button.locationButton.text;
    } else if (button.msgButton) {
      handleClick = () => {
        if (button.msgButton?.message) {
          dispatch(sendTextMessage({ message: button.msgButton.message, vgroupId: convoId }));
        }
      };
      buttonLabel = button.msgButton.text;
    } else if (button.urlButton) {
      buttonLabel = button.urlButton.text;
      handleClick = () => {
        if (button.urlButton?.url) {
          dispatch(
            openLink({
              link: button.urlButton?.url,
              showConfirmation: buttonLabel !== button.urlButton?.url,
            })
          );
        }
      };
    }

    return (
      buttonLabel && (
        <Button
          bordered
          key={index}
          className={clsx(styles.button, {
            [styles.preferred]: button.preferred,
          })}
          onClick={handleClick}
          shape="rounded"
        >
          {buttonLabel}
        </Button>
      )
    );
  });
  return <div className={styles.setContainer}>{renderButtons}</div>;
};

const MemoComponent = React.memo(MessageButtonSet);
if (__DEV__) MemoComponent.displayName = 'MessageButtonSet';

export default MemoComponent;
