import styles from './styles.module.less';

type Props = {
  name: string;
};

const Tag: React.FC<Props> = ({ name }) => {
  return <div className={styles.tag}>{name}</div>;
};

export default Tag;
