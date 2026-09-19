import { useEffect, useReducer } from 'react';
import { useInView } from 'react-intersection-observer';
import { Button } from '@/componentlibrary';
import { useAppTranslation } from '@/lib/i18n';
import TableRow from './TableRow';

/** Number of rows to show on the sheet */
const INITIAL_MAX_ROWS = 250;
/** Number of rows to add on Show More */
const INCREMENT_ROWS = 200;

function loadRowsReducer(state: number) {
  return state + INCREMENT_ROWS;
}

const Table: ReactFC<{ rows: any[][] }> = ({ rows }) => {
  const { t } = useAppTranslation();
  const [maxRows, loadMoreRows] = useReducer(loadRowsReducer, INITIAL_MAX_ROWS);
  const renderedRows = rows.length > maxRows ? rows.slice(0, maxRows) : rows;
  const nextRowCount = Math.min(maxRows + INCREMENT_ROWS, INCREMENT_ROWS);
  const firstRowCols = rows[0]?.length;
  const [ref, inView] = useInView();

  useEffect(() => {
    if (inView) loadMoreRows();
  }, [inView]);

  return (
    <>
      <table>
        {firstRowCols && (
          <thead>
            <TableRow header row={generateColumnHeaders(firstRowCols)} rowNumber={0} />
          </thead>
        )}
        <tbody>
          {renderedRows.map((row, i) => (
            <TableRow row={row} key={i} rowNumber={i + 1} />
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <Button onClick={loadMoreRows} ref={ref}>
          {t('Loading')} {nextRowCount} / {t('Intl.Number', { val: rows.length })}...
        </Button>
      )}
    </>
  );
};

/** Convert a number into an Excel header, e.g., 28 => AB */
function convertColumnNumberToColumnHeaderLabel(col: number) {
  let label = '';
  let remainder = col;
  while (remainder > 0) {
    const mod = (remainder - 1) % 26;
    label = String.fromCharCode(65 + mod) + label;
    remainder = Math.floor((remainder - mod) / 26);
  }
  return label;
}

/** Generate Excel column headers */
function generateColumnHeaders(cols: number) {
  const headers: string[] = [];
  for (let i = 1; i <= cols; i++) {
    headers.push(convertColumnNumberToColumnHeaderLabel(i));
  }
  return headers;
}

export default Table;
