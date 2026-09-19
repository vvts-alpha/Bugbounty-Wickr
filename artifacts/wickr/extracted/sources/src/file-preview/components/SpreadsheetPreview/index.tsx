import { read, utils, WorkBook } from '@e965/xlsx';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { FileLoading } from '../FileLoading';
import { Tab, Tabs } from '@/componentlibrary';
import { useAsyncEffect } from '@/hooks/useAsyncEffect';
import { useAppTranslation } from '@/lib/i18n';
import { metrics } from '@/lib/metrics';
import Table from './Table';

import styles from './styles.module.less';

const worksheetToJson = metrics.timeFunction('SpreadsheetToJson', utils.sheet_to_json);

const SpreadsheetPreview: ReactFC<{ url: string }> = ({ url }) => {
  const { t } = useAppTranslation();
  const [striped, setStriped] = useState(false);
  // Spreadsheet workbook
  const [workbook, setWorkbook] = useState<WorkBook>();
  // Current sheet we are viewing
  const [sheet, setSheet] = useState(0);
  // Rows of data for the given sheet
  const [rows, setRows] = useState<any[][]>();

  useAsyncEffect(
    async ({ signal }) => {
      const workbook = read(await (await fetch(url, { signal })).arrayBuffer());
      setWorkbook(workbook);
    },
    [url]
  );

  useEffect(() => {
    if (!workbook) return;
    const worksheet = workbook.Sheets[workbook.SheetNames[sheet]];
    // header : 1 outputs content as a 2-D array
    const tableRows: any[][] = worksheetToJson(worksheet, { header: 1 });
    setRows(tableRows);
  }, [sheet, workbook]);

  const worksheetNames = workbook?.SheetNames ?? [];

  return (
    <div className={styles.container}>
      {/* TODO Check with design is we should add spreadsheet formatting tools */}
      {/* <div className={styles.header}>
        <div className={styles.toggleWrapper}>
          <span>{raw('Contrast rows')}</span>
          <Toggle
            checked={striped}
            onChange={() => setStriped(!striped)}
            label={raw('Contrast rows')}
          />
        </div>
      </div> */}
      <div className={clsx(styles.tableWrapper, { [styles.striped]: striped })}>
        {rows ? <Table rows={rows} /> : <FileLoading />}
      </div>
      {worksheetNames.length > 1 && (
        <Tabs selectedLabel={t('selected')} className={styles.sheetsRow}>
          <div className={styles.tabFiller}></div>
          {worksheetNames.map((sheetName, idx) => {
            return (
              <Tab
                index={idx}
                ariaLabel={sheetName}
                key={sheetName}
                onClick={() => setSheet(idx)}
                wrapperClassName={clsx({ [styles.tabWrapper]: idx !== sheet })}
                className={clsx(styles.tab, { [styles.activeTab]: idx === sheet })}
                underlineClassName={styles.underline}
              >
                {sheetName}
              </Tab>
            );
          })}
          <div className={styles.tabFiller}></div>
        </Tabs>
      )}
    </div>
  );
};

export default SpreadsheetPreview;
