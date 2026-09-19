import { AppsItem } from './AppsItem';
import styles from './styles.module.less';

const IntegratedApps: React.FC = () => {
  return (
    <div className={styles.body}>
      <AppsItem
        name="Bedrock"
        publisher="Amazon"
        description="Bed rokk 🪨 description"
        tags={['Built for your org', 'AI']}
        onOpen={() => {}}
      />
    </div>
  );
};

export default IntegratedApps;
