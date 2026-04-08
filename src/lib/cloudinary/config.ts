export type CloudinaryConfig = {
  apiKey: string;
  apiSecret: string;
  cloudName: string;
  uploadPreset: string | null;
};

function clean(value: string | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = clean(process.env.CLOUDINARY_API_KEY);
  const apiSecret = clean(process.env.CLOUDINARY_API_SECRET);

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not fully configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }

  return {
    apiKey,
    apiSecret,
    cloudName,
    uploadPreset: clean(process.env.CLOUDINARY_UPLOAD_PRESET),
  };
}

export function isCloudinaryConfigured() {
  return Boolean(
    clean(process.env.CLOUDINARY_CLOUD_NAME) &&
      clean(process.env.CLOUDINARY_API_KEY) &&
      clean(process.env.CLOUDINARY_API_SECRET)
  );
}

export function isCloudinaryAssetUrl(value: string) {
  try {
    const url = new URL(value);

    return url.hostname.endsWith("res.cloudinary.com");
  } catch {
    return false;
  }
}
