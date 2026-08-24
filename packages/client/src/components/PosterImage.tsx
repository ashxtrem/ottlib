import { useState, type ImgHTMLAttributes } from 'react';

type PosterImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'onLoad'>;

export function PosterImage({ className = '', ...props }: PosterImageProps) {
  const [loaded, setLoaded] = useState(false);
  return <img {...props} onLoad={() => setLoaded(true)} className={`${className} opacity-0 transition-opacity duration-base ease-standard ${loaded ? 'opacity-100' : ''}`} />;
}
