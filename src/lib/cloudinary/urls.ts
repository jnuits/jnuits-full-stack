export const CLOUDINARY_IMAGE_TRANSFORMS = {
  albumCard: "f_auto,q_auto,c_fill,w_900,h_600,g_auto",
  blur: "f_auto,q_auto:low,e_blur:800,w_32",
  detailGrid: "f_auto,q_auto,c_fill,w_700,h_500,g_auto",
  full: "f_auto,q_auto,c_limit,w_1800",
} as const;

export type CloudinaryImageVariant = keyof typeof CLOUDINARY_IMAGE_TRANSFORMS;

export function transformCloudinaryUrl(
  secureUrl: string | null | undefined,
  variant: CloudinaryImageVariant
) {
  if (!secureUrl) {
    return "";
  }

  const transform = CLOUDINARY_IMAGE_TRANSFORMS[variant];
  const uploadMarker = "/upload/";
  const markerIndex = secureUrl.indexOf(uploadMarker);

  if (markerIndex === -1) {
    return secureUrl;
  }

  const prefix = secureUrl.slice(0, markerIndex + uploadMarker.length);
  const suffix = secureUrl.slice(markerIndex + uploadMarker.length);

  return `${prefix}${transform}/${suffix}`;
}

export function getCloudinaryBlurUrl(secureUrl: string | null | undefined) {
  return transformCloudinaryUrl(secureUrl, "blur");
}
