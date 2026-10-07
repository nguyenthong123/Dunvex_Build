// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyOrShareImage } from './imageSharing';
import { localFileService } from '../services/localFileService';

describe('copyOrShareImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests browser clipboard access before the generated image promise resolves', async () => {
    let resolveImage!: (dataUrl: string) => void;
    const imagePromise = new Promise<string>((resolve) => {
      resolveImage = resolve;
    });
    const write = vi.fn().mockResolvedValue(undefined);
    class FakeClipboardItem {
      constructor(public readonly items: Record<string, Blob | Promise<Blob>>) {}
    }

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write },
    });
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    Object.defineProperty(window, 'ClipboardItem', {
      configurable: true,
      value: FakeClipboardItem,
    });

    const resultPromise = copyOrShareImage({ dataUrl: imagePromise });
    expect(write).toHaveBeenCalledTimes(1);

    resolveImage('data:image/png;base64,cG5n');
    await expect(resultPromise).resolves.toMatchObject({
      success: true,
      mode: 'web_clipboard',
    });
  });

  it('does not fall back to a file download when native desktop clipboard copy fails', async () => {
    const error = new Error('Clipboard is unavailable');
    vi.spyOn(localFileService, 'copyImageToClipboard').mockRejectedValueOnce(error);
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: { webview: {} },
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    await expect(copyOrShareImage({ dataUrl: 'data:image/png;base64,cG5n' }))
      .rejects.toBe(error);

    expect(localFileService.copyImageToClipboard).toHaveBeenCalledOnce();
    expect(click).not.toHaveBeenCalled();
  });
});
