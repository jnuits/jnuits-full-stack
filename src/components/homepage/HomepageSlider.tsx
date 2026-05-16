"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { transformCloudinaryUrl } from "@/lib/cloudinary/urls";
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

function pickRandomSlides(images: HomepageSliderImage[]) {
  const limit = Math.min(5, images.length);
  const pool = [...images];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, limit);
}

export function HomepageSlider({ images }: HomepageSliderProps) {
  const initialSlides = useMemo(() => images.slice(0, Math.min(5, images.length)), [images]);
  const [slides, setSlides] = useState(initialSlides);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSlides(pickRandomSlides(images));
      setActiveIndex(0);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [images]);

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

  const activeSlide = slides[activeIndex];

  function goToSlide(index: number) {
    setActiveIndex((index + slides.length) % slides.length);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToSlide(activeIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToSlide(activeIndex + 1);
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
          {slides.map((slide, index) => (
            <div
              aria-hidden={index === activeIndex ? undefined : true}
              className="hp-slider__slide"
              data-active={index === activeIndex ? "true" : "false"}
              key={slide.id}
            >
              <Image
                alt={slide.title}
                className="hp-slider__image"
                fill
                onError={(event) => {
                  const fallback = fallbackImages[index % fallbackImages.length];
                  if (event.currentTarget.src.endsWith(fallback)) {
                    return;
                  }
                  event.currentTarget.src = fallback;
                }}
                sizes="(min-width: 1280px) 1220px, 94vw"
                src={transformCloudinaryUrl(slide.imageUrl, "full")}
                unoptimized={true}
              />
              <div className="hp-slide-overlay" />
              <p className="hp-slide-title">{slide.title}</p>
              <p className="hp-slide-caption">{slide.caption}</p>
              {slide.link ? (
                <a
                  aria-label={`View ${slide.title}`}
                  className="hp-slide-view"
                  href={slide.link}
                  tabIndex={index === activeIndex ? 0 : -1}
                >
                  View →
                </a>
              ) : null}
            </div>
          ))}

          {slides.length > 1 ? (
            <>
              <button
                aria-label="Previous slide"
                className="hp-slider__control hp-slider__control--prev"
                onClick={() => goToSlide(activeIndex - 1)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={24} strokeWidth={2.2} />
              </button>
              <button
                aria-label="Next slide"
                className="hp-slider__control hp-slider__control--next"
                onClick={() => goToSlide(activeIndex + 1)}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={24} strokeWidth={2.2} />
              </button>
            </>
          ) : null}

        </div>

        <div className="hp-slider__dots" role="tablist" aria-label="Slider navigation">
          {slides.map((slide, index) => (
            <button
              aria-label={`Slide ${index + 1} of ${slides.length}`}
              aria-selected={index === activeIndex}
              className="hp-slider__dot"
              data-active={index === activeIndex ? "true" : "false"}
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
