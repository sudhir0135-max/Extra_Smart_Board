// ── Annotation data store ─────────────────────────────────────────
// In production, fetch this from your backend keyed by annotation id.
// Notice each annotation now holds an ARRAY of "items" — this is what
// lets one tagged span open a sheet with text + an image + a video
// together, instead of being locked to a single content type.

export const ITEM_TYPE_META = {
  text: { icon: "ti-note", label: "Note" },
  formula: { icon: "ti-math-function", label: "Formula" },
  image: { icon: "ti-photo", label: "Image" },
  video: { icon: "ti-player-play", label: "Video" },
};

export const ANNOTATION_DB = {
  a1: {
    title: "Newton's second law",
    items: [
      {
        type: "text",
        body: "Force equals mass times acceleration. This is one of the three foundational laws of classical mechanics.",
      },
      {
        type: "formula",
        latex: "F = ma",
      },
    ],
  },
  a2: {
    title: "Quadratic formula",
    items: [
      {
        type: "text",
        body: "Used to solve any quadratic equation of the form ax\u00b2 + bx + c = 0.",
      },
      {
        type: "formula",
        latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
      },
    ],
  },
  a3: {
    title: "Cell structure",
    items: [
      {
        type: "text",
        body: "A labeled diagram of a typical eukaryotic animal cell, showing major organelles.",
      },
      {
        type: "image",
        imageUrl:
          "https://images.unsplash.com/photo-1583912267550-d6c2ac3196c0?w=800&q=80",
      },
    ],
  },
  a4: {
    title: "Photosynthesis",
    items: [
      {
        type: "text",
        body: "A short visual walkthrough of how plants convert light energy into chemical energy.",
      },
      {
        type: "video",
        videoUrl: "https://www.youtube.com/embed/UPBMG5EYydo",
      },
    ],
  },
};
