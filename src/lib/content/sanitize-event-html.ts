import sanitizeHtml from "sanitize-html";

const allowedSchemes = ["http", "https", "mailto", "tel"];

export function sanitizeEventHtml(content: string) {
  return sanitizeHtml(content, {
    allowedTags: [
      "a",
      "blockquote",
      "br",
      "code",
      "em",
      "h2",
      "h3",
      "h4",
      "hr",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "span",
      "strong",
      "ul",
    ],
    allowedAttributes: {
      a: ["href", "name", "rel", "target", "title"],
      img: ["alt", "height", "src", "title", "width"],
      span: ["title"],
    },
    allowedSchemes,
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noreferrer",
        target: "_blank",
      }),
    },
  });
}
