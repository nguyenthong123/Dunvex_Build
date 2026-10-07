import { localFileService } from '../services/localFileService';

// Helper to compress image before saving (Optimized for macOS / iOS / Android memory and storage)
export async function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.82): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    const cleanup = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (e) {
        // ignore
      }
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          cleanup();
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
          return;
        }

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          cleanup();
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Immediate release of backing buffer
        canvas.width = 0;
        canvas.height = 0;
        cleanup();

        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    img.onerror = () => {
      cleanup();
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Save image 100% locally to machine storage (macOS SSD / Mobile Filesystem / Local IndexedDB).
 * Does NOT upload image binaries to VPS server to protect VPS disk storage.
 */
export async function uploadImageToVPS(fileOrBase64: File | string, fileName?: string): Promise<string> {
  let imageBase64: string = '';

  if (typeof fileOrBase64 === 'string') {
    imageBase64 = fileOrBase64;
  } else if (fileOrBase64 instanceof File) {
    try {
      imageBase64 = await compressImage(fileOrBase64, 1200, 1200, 0.82);
    } catch (err) {
      console.warn('Failed to compress image, using original read', err);
      imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(fileOrBase64);
      });
    }
  }

  const customName = fileName || (fileOrBase64 instanceof File ? fileOrBase64.name : `img_${Date.now()}.jpg`);

  try {
    const saved = await localFileService.saveImage(imageBase64, customName);
    if (saved && (saved.url || saved.localPath)) {
      return saved.url || saved.localPath;
    }
  } catch (err) {
    console.warn('[LocalFile] Local save failed, returning data URI:', err);
  }

  return imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
}
