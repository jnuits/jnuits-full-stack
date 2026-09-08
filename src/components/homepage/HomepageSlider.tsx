"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getImageProps } from "next/image";
import { useEffect, useMemo, useState } from "react";
import { transformCloudinaryUrl, buildCloudinarySrcSet } from "@/lib/cloudinary/urls";
import { getHomepageSlideImagePriority } from "@/components/homepage/slider-image-priority";
import type { HomepageSliderImage } from "@/lib/content/public-content";

type HomepageSliderProps = {
  images: HomepageSliderImage[];
};

const fallbackImages = [
  "/images/workshop.jpg",
  "/images/home-group.jpg",
  "/images/achievement.jpg",
  "/images/gallery-1.jpg",
  "/images/gallery-2.jpg",
];

export function HomepageSlider({ images }: HomepageSliderProps) {
  const slides = useMemo(() => images.slice(0, Math.min(5, images.length)), [images]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || slides.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [reducedMotion, slides.length]);

  if (slides.length === 0) {
    return null;
  }

  const safeActiveIndex = Math.min(activeIndex, slides.length - 1);
  const activeSlide = slides[safeActiveIndex];

  function goToSlide(index: number) {
    setActiveIndex((index + slides.length) % slides.length);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToSlide(safeActiveIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToSlide(safeActiveIndex + 1);
    }

    if (event.key === "Enter" && activeSlide?.link) {
      window.location.href = activeSlide.link;
    }
  }

  return (
    <section className="hp-slider-section">
      <div
        aria-label="JnUITS activity gallery"
        className="hp-slider"
        data-reduced-motion={reducedMotion ? "true" : "false"}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="hp-slider__viewport">
          {slides.map((slide, index) => {
            const isActive = index === safeActiveIndex;
            const imagePriority = getHomepageSlideImagePriority(index, safeActiveIndex);
            // images.unoptimized is on globally: getImageProps + a native <img>
            // is the documented way to attach a custom Cloudinary srcSet.
            const { props: imageProps } = getImageProps({
              alt: slide.title,
              fill: true,
              sizes: "(min-width: 1280px) 1220px, 94vw",
              src: transformCloudinaryUrl(slide.imageUrl, "full"),
            });
            const slideSrcSet = buildCloudinarySrcSet(slide.imageUrl);

            return (
              <div
                aria-hidden={isActive ? undefined : true}
                className="hp-slider__slide"
                data-active={isActive ? "true" : "false"}
                key={slide.id}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  {...imageProps}
                  alt={slide.title}
                  className="hp-slider__image"
                  fetchPriority={imagePriority.fetchPriority}
                  loading={imagePriority.loading}
                  onError={(event) => {
                    const fallback = fallbackImages[index % fallbackImages.length];
                    if (event.currentTarget.src.endsWith(fallback)) {
                      return;
                    }
                    event.currentTarget.removeAttribute("srcset");
                    event.currentTarget.src = fallback;
                  }}
                  {...(slideSrcSet ? { srcSet: slideSrcSet } : null)}
                />
                <div className="hp-slide-overlay" />
                <p className="hp-slide-title">{slide.title}</p>
                <p className="hp-slide-caption">{slide.caption}</p>
                {slide.link ? (
                  <a
                    aria-label={`View ${slide.title}`}
                    className="hp-slide-view"
                    href={slide.link}
                    tabIndex={isActive ? 0 : -1}
                  >
                    View →
                  </a>
                ) : null}
              </div>
            );
          })}

          {slides.length > 1 ? (
            <>
              <button
                aria-label="Previous slide"
                className="hp-slider__control hp-slider__control--prev"
                onClick={() => goToSlide(safeActiveIndex - 1)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={24} strokeWidth={2.2} />
              </button>
              <button
                aria-label="Next slide"
                className="hp-slider__control hp-slider__control--next"
                onClick={() => goToSlide(safeActiveIndex + 1)}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={24} strokeWidth={2.2} />
              </button>
            </>
          ) : null}

        </div>

        <div className="hp-slider-dots" role="tablist" aria-label="Slider navigation">
          {slides.map((slide, index) => (
            <button
              aria-label={`Slide ${index + 1} of ${slides.length}`}
              aria-selected={index === safeActiveIndex}
              className={`hp-slider-dot${index === safeActiveIndex ? " active" : ""}`}
              data-active={index === safeActiveIndex ? "true" : "false"}
              key={slide.id}
              onClick={() => goToSlide(index)}
              role="tab"
              type="button"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
