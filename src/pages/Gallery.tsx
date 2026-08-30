import { useEffect, useState } from "react";
import "./Gallery.css";

type Category = "grounds" | "main-house" | "cottage";

interface GalleryImage {
  id: string;
  category: Category;
  caption: string;
  /** Once real photography exists, point this at the file — e.g.
   * "/gallery/grounds-01.jpg" with the image placed in /public/gallery/ —
   * and the placeholder tile below automatically switches to an <img>. */
  src?: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  grounds: "The Grounds",
  "main-house": "Main House",
  cottage: "Cottage",
};

// Placeholder inventory — swap in real photos by adding `src`. Add or
// remove entries freely; the grid and filters adapt automatically.
const IMAGES: GalleryImage[] = [
  { id: "g1", category: "grounds", caption: "Ceremony lawn, looking toward the tree line" },
  { id: "g2", category: "grounds", caption: "Grounds at golden hour" },
  { id: "g3", category: "grounds", caption: "13 acres, view from the drive" },
  { id: "g4", category: "grounds", caption: "Reception tent setup area" },
  { id: "h1", category: "main-house", caption: "Main house, front exterior" },
  { id: "h2", category: "main-house", caption: "Main house, living area" },
  { id: "h3", category: "main-house", caption: "Main house, one of seven bedrooms" },
  { id: "h4", category: "main-house", caption: "Main house, dining room" },
  { id: "c1", category: "cottage", caption: "Cottage exterior and deck" },
  { id: "c2", category: "cottage", caption: "Cottage living room" },
  { id: "c3", category: "cottage", caption: "Cottage bedroom" },
];

export function Gallery() {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);

  useEffect(() => {
    if (!lightboxImage) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxImage(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxImage]);

  const visibleImages = IMAGES.filter((img) => filter === "all" || img.category === filter);

  return (
    <div className="container gallery-page">
      <span className="eyebrow">Gallery</span>
      <h1>The grounds, the main house, and the cottage.</h1>
      <p className="gallery-page__lede">
        A look at the property — photography is being added as it comes in.
      </p>

      <div className="gallery-filters" role="tablist" aria-label="Filter gallery by area">
        {(["all", "grounds", "main-house", "cottage"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`gallery-filters__btn ${filter === key ? "gallery-filters__btn--active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {key === "all" ? "All" : CATEGORY_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="gallery-grid">
        {visibleImages.map((img) => (
          <button
            key={img.id}
            type="button"
            className="gallery-tile"
            onClick={() => setLightboxImage(img)}
            aria-label={`View larger: ${img.caption}`}
          >
            {img.src ? (
              <img src={img.src} alt={img.caption} />
            ) : (
              <div className="gallery-tile__placeholder">
                <span>{CATEGORY_LABELS[img.category]}</span>
              </div>
            )}
            <span className="gallery-tile__caption">{img.caption}</span>
          </button>
        ))}
      </div>

      {lightboxImage && (
        <div
          className="gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.caption}
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            className="gallery-lightbox__close"
            onClick={() => setLightboxImage(null)}
            aria-label="Close"
          >
            ×
          </button>
          <div className="gallery-lightbox__content" onClick={(e) => e.stopPropagation()}>
            {lightboxImage.src ? (
              <img src={lightboxImage.src} alt={lightboxImage.caption} />
            ) : (
              <div className="gallery-lightbox__placeholder">
                <span>{CATEGORY_LABELS[lightboxImage.category]}</span>
              </div>
            )}
            <p className="gallery-lightbox__caption">{lightboxImage.caption}</p>
          </div>
        </div>
      )}
    </div>
  );
}
