window.TagLabSymbols = (() => {
  /**
   * Simple filled shapes in a 100×100 design box, centered around (50,50).
   * Scaled later to letter height.
   */
  const SYMBOLS = {
    heart: {
      label: "Sirds",
      /** closed path */
      d: "M50 88 C20 65 8 48 8 32 C8 18 18 10 30 10 C38 10 45 14 50 22 C55 14 62 10 70 10 C82 10 92 18 92 32 C92 48 80 65 50 88 Z",
    },
    star: {
      label: "Zvaigzne",
      d: "M50 8 L61 38 L94 38 L67 58 L77 90 L50 72 L23 90 L33 58 L6 38 L39 38 Z",
    },
    moon: {
      label: "Mēness",
      d: "M62 12 C38 14 20 34 20 58 C20 82 40 98 64 98 C52 98 30 86 30 58 C30 32 48 14 62 12 Z",
    },
    bolt: {
      label: "Zibens",
      d: "M58 8 L28 52 L48 52 L40 92 L76 42 L54 42 Z",
    },
    paw: {
      label: "Ķepa",
      d: "M32 28 C32 20 38 14 44 14 C50 14 56 20 56 28 C56 36 50 42 44 42 C38 42 32 36 32 28 Z M54 22 C54 14 60 8 66 8 C72 8 78 14 78 22 C78 30 72 36 66 36 C60 36 54 30 54 22 Z M18 42 C18 34 24 28 30 28 C36 28 42 34 42 42 C42 50 36 56 30 56 C24 56 18 50 18 42 Z M66 42 C66 34 72 28 78 28 C84 28 90 34 90 42 C90 50 84 56 78 56 C72 56 66 50 66 42 Z M50 48 C62 48 72 58 72 72 C72 86 62 96 50 96 C38 96 28 86 28 72 C28 58 38 48 50 48 Z",
    },
    flower: {
      label: "Zieds",
      d: "M50 18 C58 18 64 26 64 34 C64 30 70 26 76 30 C82 34 82 44 76 48 C80 52 80 62 74 66 C70 70 62 68 58 64 C58 72 52 80 44 80 C36 80 30 72 30 64 C26 68 18 70 14 66 C8 62 8 52 12 48 C6 44 6 34 12 30 C18 26 24 30 26 34 C26 26 34 18 42 18 C46 18 50 18 50 18 Z M50 50 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0",
    },
  };

  function list() {
    return Object.entries(SYMBOLS).map(([id, s]) => ({ id, label: s.label }));
  }

  function get(id) {
    return SYMBOLS[id] || null;
  }

  /**
   * Scale 100×100 symbol into mm coordinates, centered at (cx, cy),
   * with target height ≈ letterHeightMm.
   */
  function toPathCommands(id, cx, cy, letterHeightMm) {
    const sym = SYMBOLS[id];
    if (!sym) return [];
    const scale = letterHeightMm / 100;
    // parse path roughly into polygons via SVGPath in geometry — return raw d + transform
    return {
      d: sym.d,
      transform: { cx, cy, scale, box: 100 },
    };
  }

  return { SYMBOLS, list, get, toPathCommands };
})();
