import { useEffect, useState } from 'react';
import { mediaObjectUrl, readMedia } from '../services/mediaStore';
import { isDataUrl, parseBlobRef } from '../utils/media';

export function useMediaSrc(src: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!src) {
      setUrl(null);
      return;
    }
    if (isDataUrl(src)) {
      setUrl(src);
      return;
    }
    const id = parseBlobRef(src);
    if (!id) {
      setUrl(null);
      return;
    }
    let objectUrl = '';
    let cancelled = false;
    void readMedia(id).then((record) => {
      if (cancelled || !record) return;
      objectUrl = mediaObjectUrl(record);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  return url;
}
