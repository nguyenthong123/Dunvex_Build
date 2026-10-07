import React, { useState, useEffect } from 'react';
import { offlineImageCache } from '../../services/offlineImageCache';
import { Package } from 'lucide-react';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackIcon?: React.ReactNode;
  fallbackText?: string;
  containerClassName?: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  src,
  alt = '',
  className = 'w-full h-full object-cover',
  fallbackIcon,
  fallbackText,
  containerClassName = '',
  onError,
  ...props
}) => {
  const [displaySrc, setDisplaySrc] = useState<string>(() => {
    return src ? offlineImageCache.getCachedSync(src) : '';
  });
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) {
      setDisplaySrc('');
      setHasError(false);
      return;
    }

    let isMounted = true;
    const initialSync = offlineImageCache.getCachedSync(src);
    setDisplaySrc(initialSync);
    setHasError(false);

    // Resolve local display URL asynchronously from IndexedDB / Capacitor Filesystem
    offlineImageCache.getDisplayUrl(src).then((resolvedUrl) => {
      if (isMounted && resolvedUrl) {
        setDisplaySrc(resolvedUrl);
      }
    }).catch(() => {
      // Keep initial sync URL on error
    });

    return () => {
      isMounted = false;
    };
  }, [src]);

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    if (onError) {
      onError(e);
    }
  };

  if (!src || hasError) {
    if (fallbackIcon) {
      return <div className={`flex items-center justify-center ${containerClassName}`}>{fallbackIcon}</div>;
    }
    if (fallbackText) {
      return (
        <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold uppercase select-none ${containerClassName || className}`}>
          {fallbackText.slice(0, 2)}
        </div>
      );
    }
    return (
      <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 ${containerClassName || className}`}>
        <Package size={16} />
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onError={handleImgError}
      loading="lazy"
      {...props}
    />
  );
};
