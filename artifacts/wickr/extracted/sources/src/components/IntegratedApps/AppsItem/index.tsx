import { Button, Heading, StarFilledIcon, StarIcon } from '@/componentlibrary';

import styles from './styles.module.less';

type Props = {
  name: string;
  publisher: string;
  description: string;
  rating?: number;
  tags?: string[];
  onOpen: () => void;
};

export const AppsItem: ReactFC<Props> = ({
  name,
  publisher,
  description,
  rating,
  tags,
  onOpen,
}) => {
  return (
    <div className={styles.container}>
      <Button bordered className={styles.btn} onClick={onOpen}>
        Open
      </Button>
      <Heading className={styles.heading} level={2}>
        {name}
      </Heading>
      <p>{publisher}</p>
      <p>{description}</p>
      <div className={styles.rating}>
        {rating ? (
          <>
            <StarFilledIcon />
            <p>{rating}</p>
          </>
        ) : (
          <>
            <StarIcon />
            <p>No ratings yet</p>
          </>
        )}
      </div>
      <div className={styles.tags}>
        {tags?.map((tag, i) => (
          <span key={i}>{tag}</span>
        ))}
      </div>
    </div>
  );
};
