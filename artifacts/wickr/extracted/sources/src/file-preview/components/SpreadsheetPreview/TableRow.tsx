import clsx from 'clsx';
import styles from './styles.module.less';

const TableRow: ReactFC<{ row: any[]; rowNumber: number; header?: boolean }> = ({
  row,
  rowNumber,
  header,
}) => {
  if (!row) return null;
  const CellTag = header ? 'th' : 'td';
  return (
    <tr>
      <CellTag className={clsx({ [styles.rowNumber]: CellTag === 'td' })}>
        {rowNumber ? rowNumber : ''}
      </CellTag>
      {row.map((cellData, i) => (
        <CellTag key={i}>{cellData}</CellTag>
      ))}
    </tr>
  );
};

export default TableRow;
