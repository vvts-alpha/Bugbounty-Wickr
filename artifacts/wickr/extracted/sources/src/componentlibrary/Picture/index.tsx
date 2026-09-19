interface PictureProps {
  /** Default fallback image */
  src: string;
  /** 2x density version of image */
  src2x: string;
}

const Picture: ReactFC<PictureProps> = ({ src, src2x }) => {
  return (
    <picture>
      <source srcSet={`${src2x} 2x`} />
      <img src={src} />
    </picture>
  );
};

export default Picture;
