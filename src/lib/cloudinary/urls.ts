export const CLOUDINARY_IMAGE_TRANSFORMS = {
  albumCard: "f_auto,q_auto,c_fill,w_900,h_600,g_auto",
  blur: "f_auto,q_auto:low,e_blur:800,w_32",
  detailGrid: "f_auto,q_auto,c_fill,w_700,h_500,g_auto",
  full: "f_auto,q_auto,c_limit,w_1800",
} as const;

export type CloudinaryImageVariant = keyof typeof CLOUDINARY_IMAGE_TRANSFORMS;

/** Width candidates for responsive delivery while the optimizer stays off. */
export const CLOUDINARY_SRCSET_WIDTHS = [640, 960, 1280, 1600, 1800] as const;

function insertCloudinaryTransform(secureUrl: string, transform: string) {
  const uploadMarker = "/upload/";
  const markerIndex = secureUrl.indexOf(uploadMarker);

  if (markerIndex === -1) {
    return secureUrl;
  }

  const prefix = secureUrl.slice(0, markerIndex + uploadMarker.length);
  const suffix = secureUrl.slice(markerIndex + uploadMarker.length);

  return `${prefix}${transform}/${suffix}`;
}

function isCloudinaryImageDeliveryUrl(value: string) {
  try {
    const url = new URL(value);
    const [cloudName, resourceType, deliveryType] = url.pathname
      .split("/")
      .filter(Boolean);

    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      Boolean(cloudName) &&
      resourceType === "image" &&
      deliveryType === "upload"
    );
  } catch {
    return false;
  }
}

export function transformCloudinaryUrl(
  secureUrl: string | null | undefined,
  variant: CloudinaryImageVariant
) {
  if (!secureUrl) {
    return "";
  }

  return insertCloudinaryTransform(secureUrl, CLOUDINARY_IMAGE_TRANSFORMS[variant]);
}

/**
 * Builds a `srcSet` string of width-specific Cloudinary variants so browsers
 * can pick an appropriately sized download even though `next/image`
 * optimization is disabled (`images.unoptimized`). Non-Cloudinary URLs are
 * returned without candidates.
 */
export function buildCloudinarySrcSet(
  secureUrl: string | null | undefined,
  widths: readonly number[] = CLOUDINARY_SRCSET_WIDTHS
) {
  if (!secureUrl || !isCloudinaryImageDeliveryUrl(secureUrl)) {
    return undefined;
  }

  return widths
    .map((width) => `${insertCloudinaryTransform(secureUrl, `f_auto,q_auto,c_limit,w_${width}`)} ${width}w`)
    .join(", ");
}

export function getCloudinaryBlurUrl(secureUrl: string | null | undefined) {
  return transformCloudinaryUrl(secureUrl, "blur");
}
