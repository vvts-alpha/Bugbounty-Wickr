import { clsx } from 'clsx';
import React, { HTMLProps } from 'react';
import { BaseConvoMessage } from '@/components/Convo/BaseConvoMessage';
import { WickrMessage } from '@/lib/protobuf/messages';
import AnnotationBubbleContainer from './AnnotationBubbleContainer';

import styles from './MessageInfoPanel.module.less';

interface PanelMessageProps extends HTMLProps<HTMLElement> {
  id: string;
  message: WickrMessage;
}

const PanelMessage: React.FC<PanelMessageProps> = ({ id, message }) => {
  return (
    <div className={clsx(styles.panelMessage, 'panelMessage')}>
      <BaseConvoMessage id={id} message={message} isTableMessage={false} isInteractive={false} />
      <AnnotationBubbleContainer message={message} />
    </div>
  );
};

export default PanelMessage;
