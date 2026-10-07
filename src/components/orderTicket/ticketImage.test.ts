// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyComputedStyles, dataURLtoBlob, fetchImageBase64FromServer } from './ticketImage';

describe('ticket image export helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('converts image data URLs to PNG blobs', () => {
    const blob = dataURLtoBlob('data:image/png;base64,cG5n');

    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(3);
  });

  it('converts cached blob URLs to data URLs before rendering tickets', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['png-bytes'], { type: 'image/png' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchImageBase64FromServer('blob:https://dunvex.com/cached-image'))
      .resolves.toBe('data:image/png;base64,cG5nLWJ5dGVz');
    expect(fetchMock).toHaveBeenCalledWith('blob:https://dunvex.com/cached-image');
  });

  it('preserves computed thumbnail sizing and layout styles on the export clone', () => {
    const source = document.createElement('div');
    source.innerHTML = '<div><img /></div>';
    source.style.display = 'flex';
    source.firstElementChild!.setAttribute('style', 'width: 48px; height: 48px; overflow: hidden');
    source.querySelector('img')!.setAttribute('style', 'width: 100%; height: 100%; object-fit: cover');
    document.body.appendChild(source);

    const clone = source.cloneNode(true) as HTMLElement;
    copyComputedStyles(source, clone);

    const clonedImage = clone.querySelector('img')!;
    expect(clone.style.display).toBe('flex');
    expect(clonedImage.style.width).toBe('100%');
    expect(clonedImage.style.height).toBe('100%');
    expect(clonedImage.style.objectFit).toBe('cover');

    source.remove();
  });
});
