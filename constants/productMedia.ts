export const MAX_PRODUCT_IMAGES = 5;
export const MAX_PRODUCT_VIDEO_DURATION_MS = 20_000;
export const MAX_PRODUCT_VIDEO_SIZE_BYTES = 25 * 1_000_000;

export const getProductVideoValidationError = (asset: {
  duration?: number | null;
  fileSize?: number | null;
}) => {
  if (asset.duration == null) {
    return "Unable to verify video duration. Please choose another video.";
  }
  if (asset.duration > MAX_PRODUCT_VIDEO_DURATION_MS) {
    return "Product videos must be 20 seconds or shorter.";
  }
  if (asset.fileSize == null) {
    return "Unable to verify video size. Please choose another video.";
  }
  if (asset.fileSize > MAX_PRODUCT_VIDEO_SIZE_BYTES) {
    return "Product videos must be 25 MB or smaller.";
  }
  return null;
};
