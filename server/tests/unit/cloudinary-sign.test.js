import { afterEach, describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  configureCloudinary,
  signParams,
  uploadBufferToCloudinary,
} from '../../src/services/cloudinary.js';

afterEach(() => {
  configureCloudinary({});
  vi.unstubAllGlobals();
});

describe('Cloudinary signing', () => {
  const params = { public_id: 'smart-routine/lessons/abc', timestamp: 1700000000, allowed_formats: 'jpg,png,webp' };
  const secret = 'test-secret';

  it('matches a manual SHA-1 over sorted key=value pairs plus the secret', () => {
    const text = 'allowed_formats=jpg,png,webp&public_id=smart-routine/lessons/abc&timestamp=1700000000';
    const expected = crypto.createHash('sha1').update(text + secret).digest('hex');
    expect(signParams(params, secret)).toBe(expected);
  });

  it('ignores the order the keys were given in', () => {
    const reordered = { timestamp: 1700000000, allowed_formats: 'jpg,png,webp', public_id: 'smart-routine/lessons/abc' };
    expect(signParams(reordered, secret)).toBe(signParams(params, secret));
  });

  it('changes if an allowed format is changed (so a client cannot widen it)', () => {
    expect(signParams({ ...params, allowed_formats: 'exe' }, secret)).not.toBe(signParams(params, secret));
  });

  it('signs every upload parameter sent to Cloudinary, including the folder', async () => {
    const config = {
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: secret,
    };
    const uploadResponse = vi.fn(async () => ({
      ok: true,
      json: async () => ({ secure_url: 'https://media.example/audio.mp3' }),
    }));
    configureCloudinary(config);
    vi.stubGlobal('fetch', uploadResponse);

    await uploadBufferToCloudinary({
      config,
      buffer: Buffer.from('audio'),
      publicId: 'story-segment',
      folder: 'smart-routine/audio-dramas',
      resourceType: 'video',
      format: 'mp3',
    });

    const body = uploadResponse.mock.calls[0][1].body;
    const signedParams = {
      folder: body.get('folder'),
      public_id: body.get('public_id'),
      timestamp: Number(body.get('timestamp')),
    };
    expect(body.get('signature')).toBe(signParams(signedParams, secret));
    expect(signedParams).toMatchObject({
      folder: 'smart-routine/audio-dramas',
      public_id: 'story-segment',
    });
  });

  it('uploads brand images with an image MIME type for Cloudinary optimization', async () => {
    const config = {
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: secret,
    };
    const uploadResponse = vi.fn(async () => ({
      ok: true,
      json: async () => ({ secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/brand.png' }),
    }));
    configureCloudinary(config);
    vi.stubGlobal('fetch', uploadResponse);

    await uploadBufferToCloudinary({
      config,
      buffer: Buffer.from('png'),
      publicId: 'abdul-malek-logo',
      folder: 'smart-routine/branding',
      resourceType: 'image',
      format: 'png',
    });

    const file = uploadResponse.mock.calls[0][1].body.get('file');
    expect(file.type).toBe('image/png');
    expect(file.name).toBe('abdul-malek-logo.png');
    expect(uploadResponse.mock.calls[0][0]).toContain('/image/upload');
  });
});
