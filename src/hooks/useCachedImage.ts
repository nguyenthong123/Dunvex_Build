import { useState, useEffect } from 'react';
import { offlineImageCache } from '../services/offlineImageCache';

export function useCachedImage(src?: string): string {
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    return src ? offlineImageCache.getCachedSync(src) : '';
  });

  useEffect(() => {
    if (!src) {
      setResolvedUrl('');
      return;
    }

    let isMounted = true;
    setResolvedUrl(offlineImageCache.getCachedSync(src));

    offlineImageCache.getDisplayUrl(src).then((url) => {
      if (isMounted && url) {
        setResolvedUrl(url);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [src]);

  return resolvedUrl;
}
