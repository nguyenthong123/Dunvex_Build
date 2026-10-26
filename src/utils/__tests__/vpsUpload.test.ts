import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../platform', () => ({
  isNativeApp: vi.fn(),
}));

vi.mock('../../services/apiClient', () => ({
  uploadImageApi: vi.fn(),
}));

vi.mock('../../services/localFileService', () => ({
  localFileService: {
    saveImage: vi.fn(),
  },
}));

import { isNativeApp } from '../platform';
import { uploadImageApi } from '../../services/apiClient';
import { localFileService } from '../../services/localFileService';
import { uploadImageToVPS } from '../vpsUpload';

describe('VPS Image Upload Suite (WEB-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upload image to VPS and return persistent URL on Web', async () => {
    vi.mocked(isNativeApp).mockReturnValue(false);
    vi.mocked(uploadImageApi).mockResolvedValue({
      success: true,
      url: 'https://dunvex.com/uploads/images/2026/10/img_123456.jpg',
      relativeUrl: '/uploads/images/2026/10/img_123456.jpg',
      fileName: 'img_123456.jpg',
      size: 1024,
    });

    const result = await uploadImageToVPS('data:image/jpeg;base64,sampleBase64', 'product_1.jpg');

    expect(uploadImageApi).toHaveBeenCalledWith('data:image/jpeg;base64,sampleBase64', 'product_1.jpg', 'images');
    expect(localFileService.saveImage).not.toHaveBeenCalled();
    expect(result).toBe('https://dunvex.com/uploads/images/2026/10/img_123456.jpg');
    expect(result.startsWith('blob:')).toBe(false);
  });

  it('should throw an error on Web when VPS upload fails instead of returning a temporary blob URL', async () => {
    vi.mocked(isNativeApp).mockReturnValue(false);
    vi.mocked(uploadImageApi).mockRejectedValue(new Error('Network error 500'));

    await expect(uploadImageToVPS('data:image/jpeg;base64,sampleBase64', 'product_1.jpg'))
      .rejects
      .toThrow('Network error 500');

    expect(localFileService.saveImage).not.toHaveBeenCalled();
  });

  it('should delegate to localFileService on Native Apps (Offline-first)', async () => {
    vi.mocked(isNativeApp).mockReturnValue(true);
    vi.mocked(localFileService.saveImage).mockResolvedValue({
      localPath: 'dunvex_images/img_offline.jpg',
      url: 'capacitor://localhost/_capacitor_file_/dunvex_images/img_offline.jpg',
    });

    const result = await uploadImageToVPS('data:image/jpeg;base64,sampleBase64', 'product_1.jpg');

    expect(localFileService.saveImage).toHaveBeenCalled();
    expect(uploadImageApi).not.toHaveBeenCalled();
    expect(result).toBe('capacitor://localhost/_capacitor_file_/dunvex_images/img_offline.jpg');
  });
});
