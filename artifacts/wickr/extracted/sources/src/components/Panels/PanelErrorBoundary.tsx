import { FC } from 'react';
import ErrorBoundary from '../Errors/ErrorBoundary';
import { Panel, PanelBody, PanelHeader } from '@/componentlibrary';
import { PanelSide } from '@/componentlibrary/Panel';
import { useAppTranslation } from '@/lib/i18n';
import { useAppDispatch } from '@/store';
import { useSetting } from '@/store/hooks/useSetting';
import { clearPanelStack, PanelName, popPanel } from '@/store/slices/panels';

type PanelErrorProps = { panelName: PanelName; side: PanelSide };

export const PanelErrorBoundary: ReactFC<PanelErrorProps> = ({ children, ...props }) => {
  return (
    <ErrorBoundary id="panels" Fallback={({ error }) => <ErrorPanel error={error} {...props} />}>
      {children}
    </ErrorBoundary>
  );
};

const ErrorPanel: FC<PanelErrorProps & { error: Error }> = ({ error, panelName, side }) => {
  const { t } = useAppTranslation();
  const isProd = useSetting('isProduction');
  const dispatch = useAppDispatch();

  return (
    <Panel
      onClose={() => dispatch(popPanel())}
      onOutsideClick={() => dispatch(clearPanelStack())}
      side={side}
    >
      <PanelHeader title={`${t('Error')}: ${panelName}`} closeLabel={t('Close')} />
      <PanelBody>
        <div style={{ margin: '1em' }}>
          <p>{error.message}</p>
          {!isProd && (
            <>
              <hr />
              <p>
                <b>Stack trace</b> <small>(beta only)</small>
              </p>
              <pre
                style={{
                  backgroundColor: 'var(--surface-container-high)',
                  color: 'var(--on-surface-variant)',
                  padding: '8px',
                  overflow: 'auto',
                  borderRadius: '4px',
                }}
              >
                {error.stack}
              </pre>
            </>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
};
