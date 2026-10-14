type BrandMarkProps = {
  className?: string;
};

const BrandMark = ({ className = "h-9 w-9" }: BrandMarkProps) => (
  <img src="/intellipond-mark.svg" alt="" aria-hidden="true" className={`shrink-0 ${className}`} />
);

export default BrandMark;
