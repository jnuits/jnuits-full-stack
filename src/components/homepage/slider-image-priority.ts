export function getHomepageSlideImagePriority(index: number, activeIndex: number) {
  const isActive = index === activeIndex;

  return {
    fetchPriority: isActive ? "high" : "auto",
    loading: isActive ? "eager" : "lazy",
  } as const;
}
