import { Extension } from "@tiptap/core";

// The four fixed text styles. Sizes live in globals.css, so every entry looks the same.
export type TextStyleName = "heading" | "subheading" | "body" | "description";

export const TEXT_STYLES: { name: TextStyleName; label: string }[] = [
  { name: "heading", label: "Heading" },
  { name: "subheading", label: "Subheading" },
  { name: "body", label: "Body" },
  { name: "description", label: "Description" },
];

// "Description" is a paragraph with a class, shown in grey italics.
export const DescriptionText = Extension.create({
  name: "descriptionText",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          kind: {
            default: null,
            keepOnSplit: false, // pressing Enter goes back to Body
            parseHTML: (el) => (el.classList.contains("jdesc") ? "description" : null),
            renderHTML: (attrs) => (attrs.kind === "description" ? { class: "jdesc" } : {}),
          },
        },
      },
    ];
  },
});
