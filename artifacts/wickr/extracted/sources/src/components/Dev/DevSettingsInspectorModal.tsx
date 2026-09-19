import { useEffect, useMemo, useState } from 'react';
import { useWebChannel } from '@/apis/webChannel/context';
import { getOrOpenWickrQWebChannels } from '@/apis/webChannel/utils';
import { Modal, ModalBody, Toggle } from '@/componentlibrary';
import useForceUpdate from '@/hooks/useForceUpdate';
import { Logger } from '@/lib/logger';
import { useAppDispatch } from '@/store';
import { closeModal } from '@/store/thunks/modals';

import styles from './Dev.module.less';

const logger = new Logger('SettingsInspector');

function propSignal(channel: any, prop: string): QSignal<any[]> | undefined {
  const signal = `${prop}Changed`;
  if (channel[signal] && channel[signal].connect && channel[signal].disconnect) {
    return channel[signal];
  }
}

const DevSettingsInspectorModal: React.FC = () => {
  const { wickrSettings } = useWebChannel();
  const [channel, setChannel] = useState<any>(null);
  const forceUpdate = useForceUpdate();
  const dispatch = useAppDispatch();

  const handleClose = () => {
    dispatch(closeModal('DevSettingsInspectorModal'));
  };

  useEffect(() => {
    let mounted = true;
    setChannel(null);
    getOrOpenWickrQWebChannels().then((channel) => {
      if (mounted) {
        setChannel(channel.objects.wickrSettings);
      }
    });
    return () => {
      mounted = false;
    };
  }, [wickrSettings]);

  const properties = useMemo(() => {
    if (!channel) return [];

    const props: string[] = [];

    const descriptors = Object.getOwnPropertyDescriptors(channel);
    for (const prop in descriptors) {
      const d = descriptors[prop];
      if (!d.enumerable) {
        props.push(prop);
      }
    }
    return props.sort();
  }, [channel]);

  const [hasSignal, setHasSignal] = useState(new Set<string>());

  useEffect(() => {
    const hasSignalsArr: string[] = [];
    const noSignals: string[] = [];
    const disconnectors = properties.map((prop) => {
      if (!channel) return () => {};

      const signal = propSignal(channel, prop);
      if (signal) {
        const handler = () => {
          logger.info(prop, 'changed:', channel[prop]);
          forceUpdate();
        };
        signal.connect(handler);
        hasSignalsArr.push(prop);
        return () => signal.disconnect(handler);
      } else {
        noSignals.push(prop);
      }
      return () => {};
    });
    logger.info('Listening to signals for:', hasSignalsArr.sort());
    logger.info('No signals for:', noSignals.sort());
    setHasSignal(new Set(hasSignalsArr));

    return () => {
      disconnectors.forEach((d) => d());
    };
  }, [channel, properties]);

  if (!channel) return null;

  return (
    <Modal onClose={handleClose} size="lg" closeLabel="Close" className={styles.modal}>
      <ModalBody>
        <div className={styles.settingsContainer}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Edit</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((prop) => {
                if (!channel) return null;

                const value = channel[prop];
                const valueString = JSON.stringify(value, null, 2);
                let rendered: any = <span title="No update signal">--</span>;
                if (hasSignal.has(prop)) {
                  switch (typeof value) {
                    case 'boolean':
                      rendered = (
                        <Toggle
                          checked={value}
                          label={prop}
                          onChange={() => (channel[prop] = !channel[prop])}
                        />
                      );
                      break;
                    case 'number':
                      rendered = (
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => (channel[prop] = parseInt(e.target.value, 10))}
                        />
                      );
                      break;
                    case 'string':
                      rendered = (
                        <input value={value} onChange={(e) => (channel[prop] = e.target.value)} />
                      );
                      break;
                    default:
                      rendered = null;
                  }
                }

                return (
                  <tr key={prop}>
                    <td>{prop}</td>
                    <td>
                      <center>{rendered}</center>
                    </td>
                    <td>
                      <pre>{valueString}</pre>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default DevSettingsInspectorModal;
