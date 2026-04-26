/**
 * Regional-map anchor projection.
 *
 * A regional map (e.g. Anna B. Meyer's Flanaess Atlas page) is anchored to
 * the real world by **two named features** pinned to known lat/lng. With
 * an optional E↔W mirror flag (no rotation — north stays north), the two
 * anchors uniquely determine an axis-aligned linear projection from
 * image pixels to lat/lng.
 *
 * Math: independent linear interp on each axis.
 *   x' = mirror ? (imageWidth − imageX) : imageX
 *   lng = lng1 + (lng2 − lng1) × (x' − x1') / (x2' − x1')
 *   lat = lat1 + (lat2 − lat1) × (y  − y1 ) / (y2  − y1 )
 *
 * Returns null if either anchor is missing image-px coordinates.
 */

export interface RegionalAnchorPx {
  imagePxX: number;
  imagePxY: number;
  realLat: number;
  realLng: number;
}

export interface RegionalProjection {
  /** image px → real lat/lng */
  toLatLng(imageX: number, imageY: number): { lat: number; lng: number };
  /** real lat/lng → image px */
  toImagePx(lat: number, lng: number): { x: number; y: number };
}

export function buildRegionalProjection(opts: {
  anchors: [RegionalAnchorPx, RegionalAnchorPx];
  imageWidth: number;
  mirrorHorizontal: boolean;
}): RegionalProjection | null {
  const [a1, a2] = opts.anchors;
  if (
    a1.imagePxX === a2.imagePxX ||
    a1.imagePxY === a2.imagePxY
  ) {
    // Anchors share an axis — projection is degenerate.
    return null;
  }
  const mirror = (x: number) => (opts.mirrorHorizontal ? opts.imageWidth - x : x);
  const x1p = mirror(a1.imagePxX);
  const x2p = mirror(a2.imagePxX);
  const y1 = a1.imagePxY;
  const y2 = a2.imagePxY;

  const lngPerPx = (a2.realLng - a1.realLng) / (x2p - x1p);
  const latPerPx = (a2.realLat - a1.realLat) / (y2 - y1);

  return {
    toLatLng(imageX, imageY) {
      const xp = mirror(imageX);
      return {
        lng: a1.realLng + lngPerPx * (xp - x1p),
        lat: a1.realLat + latPerPx * (imageY - y1),
      };
    },
    toImagePx(lat, lng) {
      const xp = x1p + (lng - a1.realLng) / lngPerPx;
      const y = y1 + (lat - a1.realLat) / latPerPx;
      return { x: mirror(xp), y };
    },
  };
}
