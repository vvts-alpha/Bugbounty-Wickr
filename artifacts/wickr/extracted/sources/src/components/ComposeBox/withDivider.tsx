import styles from './ComposeBox.module.less';

export const WithDivider: ReactFC<{ showDivider?: boolean }> = ({ children, showDivider = true }) =>
  showDivider ? (
    <div className={styles.dividerWrapper}>
      <div className={styles.divider} />
      {children}
    </div>
  ) : (
    children
  );
