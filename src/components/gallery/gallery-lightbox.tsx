"use client";

// Lazily loaded by gallery-load-more: this module (and the lightbox CSS it
// imports) is only fetched when a visitor opens a photo.
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";

type GalleryLightboxProps = {
  activeIndex: number;
  onClose: () => void;
  slides: Slide[];
};

const LIGHTBOX_PLUGINS = [Captions] as const;

export function GalleryLightbox({
  activeIndex,
  onClose,
  slides,
}: GalleryLightboxProps) {
  return (
    <Lightbox
      captions={{
        descriptionMaxLines: 2,
        descriptionTextAlign: "center",
      }}
      carousel={{
        imageFit: "contain",
        padding: "16px",
        preload: 2,
      }}
      className="jnuits-gallery-lightbox"
      close={onClose}
      controller={{ closeOnBackdropClick: true }}
      index={activeIndex}
      open
      plugins={LIGHTBOX_PLUGINS}
      slides={slides}
    />
  );
}
