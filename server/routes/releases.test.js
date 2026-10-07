import { createServer } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import releases, { getReleaseManifest } from './releases.js';

describe('platform release channels', () => {
  let server;
  let origin;

  beforeAll(async () => {
    const app = express();
    app.use('/api/releases', releases);
    server = createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it.each(['web', 'android', 'mac', 'windows'])('returns %s metadata from its own manifest', async (platform) => {
    const response = await fetch(`${origin}/api/releases/${platform}/version`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.platform).toBe(platform);
    expect(body.buildNumber).toBeGreaterThan(0);
  });

  it('keeps macOS and Windows OTA bundle URLs on separate channels', () => {
    expect(getReleaseManifest('mac').bundleUrl).toBe('/api/releases/mac/bundle.zip');
    expect(getReleaseManifest('windows').bundleUrl).toBe('/api/releases/windows/bundle.zip');
  });

  it('does not expose OTA bundles for Android', async () => {
    const response = await fetch(`${origin}/api/releases/android/bundle.zip`);
    expect(response.status).toBe(404);
  });

  it('rejects unknown release channels', async () => {
    const response = await fetch(`${origin}/api/releases/unknown/version`);
    expect(response.status).toBe(404);
  });
});
