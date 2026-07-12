import React, { useState, useEffect } from 'react';
import { getLocalImageSrc } from '../lib/imageCache';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export default function CachedImage({ src, ...props }: CachedImageProps) {
  const [localSrc, setLocalSrc] = useState<string>(src);

  useEffect(() => {
    let isMounted = true;
    
    if (src && src.startsWith('http')) {
      getLocalImageSrc(src).then(resolvedSrc => {
        if (isMounted && resolvedSrc) {
          setLocalSrc(resolvedSrc);
        }
      });
    } else {
      setLocalSrc(src);
    }

    return () => {
      isMounted = false;
    };
  }, [src]);

  return <img src={localSrc} {...props} />;
}
