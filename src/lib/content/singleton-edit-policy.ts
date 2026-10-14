type Body = Record<string, unknown>;
function object(value: unknown): Body {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Body : {};
}
function owned(current: unknown, submitted: unknown, keys: readonly string[]): Body {
  const result = { ...object(current) }; const input = object(submitted);
  for (const key of keys) if (Object.hasOwn(input, key)) result[key] = input[key];
  return result;
}
function list(current: unknown, submitted: unknown, keys: readonly string[]) {
  if (!Array.isArray(submitted)) throw new Error("Expected an edited content list.");
  const previous = Array.isArray(current) ? current : [];
  return submitted.map((item, index) => owned(previous[index], item, keys));
}
/** The advanced editor owns copy, not the dedicated slider/stat/About models. */
export function buildSingletonBodyUpdate(slug: string, currentBody: unknown, submittedBody: unknown): Body {
  if (!submittedBody || typeof submittedBody !== "object" || Array.isArray(submittedBody)) throw new Error("Content must be a JSON object.");
  const current = object(currentBody); const input = object(submittedBody);
  if (slug === "about") return { ...current };
  if (slug === "footer") return owned(current, input, ["email", "location", "phone", "subtitle", "university"]);
  if (slug === "contact") {
    const result = owned(current, input, ["address", "email", "foundedLabel", "googleBusinessHref", "location", "organizationType", "phone", "university"]);
    if (Object.hasOwn(input, "socialLinks")) result.socialLinks = list(current.socialLinks, input.socialLinks, ["href", "label"]);
    return result;
  }
  if (slug !== "home") throw new Error("Choose a supported singleton page.");
  const result = { ...current };
  const sections = {
    aboutSection: ["buttonLink", "buttonText", "description", "imageSrc", "title"],
    achievements: ["imageSrc", "title"], recentActivities: ["imageSrc", "title"],
  };
  for (const [section, keys] of Object.entries(sections)) {
    if (!Object.hasOwn(input, section)) continue;
    const updated = owned(current[section], input[section], keys);
    const listKey = section === "achievements" ? "items" : section === "recentActivities" ? "activities" : null;
    if (listKey && Object.hasOwn(object(input[section]), listKey)) updated[listKey] = list(object(current[section])[listKey], object(input[section])[listKey], listKey === "items" ? ["title", "description", "icon"] : ["title", "description", "link"]);
    result[section] = updated;
  }
  if (Object.hasOwn(input, "heroSlides")) {
    if (!Array.isArray(input.heroSlides) || input.heroSlides.length !== 1) throw new Error("Edit the first hero slide here; use Slider for the full collection.");
    const previous = Array.isArray(current.heroSlides) ? current.heroSlides : [];
    result.heroSlides = [owned(previous[0], input.heroSlides[0], ["buttonLink", "buttonText", "description", "imageSrc", "title"]), ...previous.slice(1)];
  }
  return result;
}
