/**
 * Generic placeholder photos via Lorem Picsum (https://picsum.photos) — a
 * free, no-signup placeholder-image service. Each call is seeded, so the
 * "random" photo stays the same across reloads instead of changing every
 * time, which matters for a site people will revisit.
 *
 * These are NOT real photos of the property — they're purely visual filler
 * until real photography exists. Every call site using this function is a
 * placeholder that should eventually be replaced with a real image path
 * (e.g. "/images/cottage-exterior.jpg" once photos are added to
 * /public/images/).
 */
export function placeholderPhoto(seed: string, width: number, height: number): string {
  return `https://picsum.photos/seed/high-meadows-${seed}/${width}/${height}`;
}

/**
 * The one real photo currently available — hotlinked directly from Wix.
 * This works, but depends on that URL staying valid on Wix's end. Once
 * you're ready to make this permanent, download the file and place it at
 * /public/images/main-house.png, then swap this constant to
 * "/images/main-house.png" instead.
 */
export const MAIN_HOUSE_PHOTO_URL =
  "https://static.wixstatic.com/media/58d776_94e5964eed494003aa14220f9aff6ad9~mv2.png/v1/fill/w_572,h_812,al_c,q_90,enc_auto/58d776_94e5964eed494003aa14220f9aff6ad9~mv2.png";
