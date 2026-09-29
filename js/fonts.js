window.TagLabFonts = (() => {
  const LV_CHARS = "ĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž";

  /**
   * One option per Marshall-facing font name.
   * weight is fixed per id (Overlock 900 / Overlock 700 are separate entries).
   */
  const CATALOG = {
    "overlock-900": {
      label: "Overlock 900",
      supportsLatvian: false,
      suggest: "comfortaa-700",
      /** Extra rim to join gaps — keep modest so Overlock letterforms stay readable */
      paddingFactor: 0.22,
      weights: {
        900: { label: "900", file: "fonts/Overlock-Black.ttf" },
      },
    },
    "overlock-700": {
      label: "Overlock 700",
      supportsLatvian: false,
      suggest: "comfortaa-700",
      paddingFactor: 0.22,
      weights: {
        700: { label: "700", file: "fonts/Overlock-Bold.ttf" },
      },
    },
    "comfortaa-700": {
      label: "Comfortaa Bold",
      supportsLatvian: true,
      weights: {
        700: { label: "Bold", file: "fonts/Comfortaa-Bold.ttf" },
      },
    },
    lobster: {
      label: "Lobster",
      supportsLatvian: false,
      suggest: "comfortaa-700",
      paddingFactor: 0.3,
      letterAdvanceScale: 0.92,
      weights: {
        400: { label: "Regular", file: "fonts/Lobster-Regular.ttf" },
      },
    },
    pacifico: {
      label: "Pacifico",
      supportsLatvian: false,
      suggest: "comfortaa-700",
      paddingFactor: 0.3,
      letterAdvanceScale: 0.92,
      weights: {
        400: { label: "Regular", file: "fonts/Pacifico-Regular.ttf" },
      },
    },
    righteous: {
      label: "Righteous",
      supportsLatvian: true,
      weights: {
        400: { label: "Regular", file: "fonts/Righteous-Regular.ttf" },
      },
    },
  };

  const cache = new Map();

  function familyIds() {
    return Object.keys(CATALOG);
  }

  function getFamily(id) {
    return CATALOG[id] || null;
  }

  function weightsFor(id) {
    const fam = CATALOG[id];
    return fam ? Object.keys(fam.weights).map(Number).sort((a, b) => a - b) : [];
  }

  function pickWeight(id, preferred) {
    const weights = weightsFor(id);
    if (!weights.length) return null;
    if (weights.includes(preferred)) return preferred;
    return weights[0];
  }

  function textNeedsLatvian(text) {
    return [...text].some((ch) => LV_CHARS.includes(ch));
  }

  function missingGlyphs(font, text) {
    const missing = [];
    for (const ch of text) {
      if (ch === " " || ch === "\n" || ch === "\t") continue;
      const g = font.charToGlyph(ch);
      if (!g || g.name === ".notdef" || g.index === 0) missing.push(ch);
    }
    return [...new Set(missing)];
  }

  async function loadFont(fontId, weight) {
    const fam = CATALOG[fontId];
    if (!fam) throw new Error("Nezināms fonts: " + fontId);
    const w = pickWeight(fontId, weight);
    const entry = fam.weights[w];
    if (!entry) throw new Error("Nav svara " + weight + " fontam " + fontId);
    const key = fontId + ":" + w;
    if (cache.has(key)) {
      return { font: cache.get(key), weight: w, meta: fam, file: entry.file };
    }

    const font = await new Promise((resolve, reject) => {
      opentype.load(entry.file, (err, loaded) => {
        if (err || !loaded) {
          reject(err || new Error("Fonta ielāde neizdevās: " + entry.file));
        } else resolve(loaded);
      });
    });
    cache.set(key, font);
    return { font, weight: w, meta: fam, file: entry.file };
  }

  return {
    CATALOG,
    LV_CHARS,
    familyIds,
    getFamily,
    weightsFor,
    pickWeight,
    textNeedsLatvian,
    missingGlyphs,
    loadFont,
  };
})();
