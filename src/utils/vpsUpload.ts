import { getAuthHeaders } from '../services/apiClient';
import { getAuth } from 'firebase/auth';

const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL || '/api/upload';

// Helper to compress image before uploading (Optimized for iOS / Android low-memory devices)
async function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // Use ObjectURL instead of reading entire 15MB file into string memory
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
          // Fallback: read directly as DataURL if dimensions not readable
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

        // Immediate release of backing buffer to avoid WebKit jetsam OOM crash
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
      // Fallback
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}

// Helper to upload image to VPS endpoint /api/upload
export async function uploadImageToVPS(fileOrBase64: File | string, fileName?: string): Promise<string> {
  let imageBase64: string = '';

  if (typeof fileOrBase64 === 'string') {
    imageBase64 = fileOrBase64;
  } else if (fileOrBase64 instanceof File) {
    try {
      // Compress the image before uploading (default: max 1200px width/height, 0.85 quality)
      imageBase64 = await compressImage(fileOrBase64, 1200, 1200, 0.85);
    } catch (err) {
      console.warn('Failed to compress image, falling back to original upload', err);
      imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(fileOrBase64);
      });
    }
  }

  let token = '';
  try {
    const auth = getAuth();
    if (auth && auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    }
  } catch (e) {
    console.warn('Failed to get Firebase token for upload', e);
  }

  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageBase64,
      fileName: fileName || (fileOrBase64 instanceof File ? fileOrBase64.name : 'image')
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`VPS Upload failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  if (data.success && data.url) {
    return data.url;
  }
  throw new Error(data.error || 'Failed to upload image to VPS');
}
