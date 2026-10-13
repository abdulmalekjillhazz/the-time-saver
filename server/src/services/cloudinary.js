import crypto from 'node:crypto';

// Signed uploads and Admin API calls. The API secret stays on the server.
let current = null; // { config, client }

export class CloudinaryApiError extends Error {
  constructor(operation, status) {
    super(`Cloudinary ${operation} failed (${status}).`);
    this.name = 'CloudinaryApiError';
    this.operation = operation;
    this.status = status;
  }
}

// Signs parameters the way Cloudinary expects: sorted key=value pairs, joined with &, plus the secret.
export function signParams(params, apiSecret) {
  const text = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(text + apiSecret).digest('hex');
}

function buildClient(config) {
  const auth = `Basic ${Buffer.from(`${config.CLOUDINARY_API_KEY}:${config.CLOUDINARY_API_SECRET}`).toString('base64')}`;
  const base = `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}`;
  return {
    async resourceInfo(publicId, resourceType) {
      const res = await fetch(`${base}/resources/${resourceType}/upload/${encodeURIComponent(publicId)}`, {
        headers: { Authorization: auth },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new CloudinaryApiError('lookup', res.status);
      return res.json();
    },
    async uploadBuffer({ buffer, publicId, folder, resourceType = 'video', fileName, format = 'mp3' }) {
      const timestamp = Math.floor(Date.now() / 1000);
      const uploadPublicId = publicId.startsWith('/') ? publicId.slice(1) : publicId;
      const uploadParams = {
        folder,
        public_id: uploadPublicId,
        timestamp,
      };
      const signature = signParams(uploadParams, config.CLOUDINARY_API_SECRET);
      const body = new FormData();
      const contentType = format === 'mp3'
        ? 'audio/mpeg'
        : format === 'jpg' || format === 'jpeg'
          ? 'image/jpeg'
          : `${resourceType}/${format}`;
      body.append('file', new Blob([buffer], { type: contentType }), fileName || `${uploadPublicId}.${format}`);
      body.append('api_key', config.CLOUDINARY_API_KEY);
      body.append('signature', signature);
      body.append('timestamp', String(timestamp));
      body.append('folder', folder);
      body.append('public_id', uploadParams.public_id);
      body.append('resource_type', resourceType);
      const res = await fetch(`${base}/${resourceType}/upload`, { method: 'POST', body });
      if (!res.ok) throw new CloudinaryApiError('upload', res.status);
      return res.json();
    },
    async destroy(publicId, resourceType) {
      const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
      const signature = signParams(params, config.CLOUDINARY_API_SECRET);
      const body = new URLSearchParams({ ...params, api_key: config.CLOUDINARY_API_KEY, signature });
      const res = await fetch(`${base}/${resourceType}/destroy`, { method: 'POST', body });
      if (!res.ok) throw new Error(`cloudinary destroy failed (${res.status})`);
      const json = await res.json();
      return json.result; // 'ok' or 'not found'
    },
  };
}

export async function uploadBufferToCloudinary({ config, buffer, publicId, folder = 'smart-routine/daily-lessons', resourceType = 'video', format = 'mp3' }) {
  if (!config?.CLOUDINARY_CLOUD_NAME || !config?.CLOUDINARY_API_KEY || !config?.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials are not configured.');
  }
  const { client } = cloudinary();
  return client.uploadBuffer({
    buffer,
    publicId,
    folder,
    resourceType,
    fileName: `${publicId}.${format}`,
    format,
  });
}

export function configureCloudinary(config) {
  if (!config.CLOUDINARY_CLOUD_NAME) {
    current = null;
    return;
  }
  current = { config, client: buildClient(config) };
}

// Tests replace the network calls with fakes. Production never calls this.
export function setCloudinaryClient(client) {
  if (!current) throw new Error('configure Cloudinary before replacing its client');
  current.client = client;
}

export const isCloudinaryConfigured = () => current !== null;

export function cloudinary() {
  if (!current) throw new Error('Cloudinary is not configured');
  return current;
}
