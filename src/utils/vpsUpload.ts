import { getAuthHeaders } from '../services/apiClient';
import { getAuth } from 'firebase/auth';

const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL || '/api/upload';

// Helper to compress image before uploading
async function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.85): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

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

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
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
