import { useEffect, useState } from "react";
import { placeholderPhoto, MAIN_HOUSE_PHOTO_URL } from "../lib/placeholderImages";
import "./Gallery.css";

type Category = "grounds" | "main-house" | "cottage";

interface GalleryImage {
  id: string;
  category: Category;
  caption: string;
  src: string;
}

const CATEGORY_LABELS: Record<Category, string> = {
  grounds: "The Grounds",
  "main-house": "Main House",
  cottage: "Cottage",
};

// Placeholder inventory — every `src` here is filler (Lorem Picsum, seeded
// per id) except h1, which uses the one real photo we have. Swap any entry's
// `src` for a real photo path (e.g. "/images/grounds-lawn.jpg", once added
// to /public/images/) as photography comes in — nothing else needs to change.
const IMAGES: GalleryImage[] = [
  { id: "g1", category: "grounds", caption: "Ceremony lawn, looking toward the tree line", src: placeholderPhoto("g1", 640, 480) },
  { id: "g2", category: "grounds", caption: "Grounds at golden hour", src: placeholderPhoto("g2", 640, 480) },
  { id: "g3", category: "grounds", caption: "13 acres, view from the drive", src: placeholderPhoto("g3", 640, 480) },
  { id: "g4", category: "grounds", caption: "Reception tent setup area", src: placeholderPhoto("g4", 640, 480) },
  { id: "h1", category: "main-house", caption: "Main house exterior", src: MAIN_HOUSE_PHOTO_URL },
  { id: "h2", category: "main-house", caption: "Main house, living area", src: placeholderPhoto("h2", 640, 480) },
  { id: "h3", category: "main-house", caption: "Main house, one of seven bedrooms", src: placeholderPhoto("h3", 640, 480) },
  { id: "h4", category: "main-house", caption: "Main house, dining room", src: placeholderPhoto("h4", 640, 480) },
  { id: "c1", category: "cottage", caption: "Cottage exterior and deck", src: placeholderPhoto("c1", 640, 480) },
  { id: "c2", category: "cottage", caption: "Cottage living room", src: placeholderPhoto("c2", 640, 480) },
  { id: "c3", category: "cottage", caption: "Cottage bedroom", src: placeholderPhoto("c3", 640, 480) },
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
            <img src={img.src} alt={img.caption} loading="lazy" />
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
            <img src={lightboxImage.src} alt={lightboxImage.caption} />
            <p className="gallery-lightbox__caption">{lightboxImage.caption}</p>
          </div>
        </div>
      )}
    </div>
  );
}
