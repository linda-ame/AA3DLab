window.TagLabConfig = (() => {
  /** Fixed preview letter height (mm) — screen size never changes with order size */
  const LETTER_HEIGHT_MM = 22;

  const SIZES = {
    M: { label: "M", letterHeightMm: LETTER_HEIGHT_MM },
  };

  /**
   * Order-only sizes. letterHeightMm used to scale length estimate from preview.
   * L uses 28.4 (not 30) so S/M/L length ratios match physical samples.
   */
  const ORDER_SIZES = {
    S: { label: "S · ≈ 1,6 cm", short: "S", letterHeightMm: 16 },
    M: { label: "M · ≈ 2,2 cm", short: "M", letterHeightMm: 22 },
    L: { label: "L · ≈ 3 cm", short: "L", letterHeightMm: 28.4 },
  };

  /**
   * Geo plate length → approximate physical length.
   * Calibrated on Righteous “RĪDZE”: S 5,2 / M 7,2 / L 9,3 cm.
   */
  const LENGTH_ESTIMATE_SCALE = 0.76;

  /** Marshall recipe — remake in Marshall with these */
  const MARSHALL = {
    fontSizePx: 72,
    bodyThicknessPx: 16,
    extraPaddingPx: 6,
  };

  const PADDING = {
    minFactor: 0.1,
    maxFactor: 0.55,
    defaultFactor: 0.2,
    minMm: 1.0,
  };

  const TRACKING = 1;

  const HOLE_DIAMETER_MM = 4;
  const TAB_RADIUS_MM = 5;
  const MIN_CONNECTION_MM = 1.8;

  /** Same palette as ready-made collection (landing.js) */
  const COLORS = [
    { id: "blue", label: "Zils", hex: "#1565c0" },
    { id: "light-grey", label: "Gaiši pelēks", hex: "#c8ccd1" },
    { id: "crimson", label: "Karmīnsarkans", hex: "#a01830", shine: true },
    { id: "yellow", label: "Dzeltens", hex: "#e6c200" },
  ];

  const ORDER_EMAIL = "armands@pd.lv";

  /** Piekariņa tips — riņķītis vai + karabīne */
  const HARDWARE = {
    ring: {
      id: "ring",
      label: "Standarta riņķītis",
      short: "Riņķītis",
      surchargeEur: 0,
    },
    carabiner: {
      id: "carabiner",
      label: "Riņķītis + karabīne",
      short: "Riņķītis + karabīne",
      surchargeEur: 0.5,
    },
  };

  /**
   * Cenas (€). Individuālajā bāzē ietilpst līdz freeChars simboliem;
   * virs tam — longTextSurchargeEur.
   */
  const PRICING = {
    readyBaseEur: { S: 1.5, M: 2.0, L: 2.5 },
    customBaseEur: { S: 2.0, M: 2.5, L: 3.5 },
    freeChars: 10,
    longTextSurchargeEur: 0.5,
  };

  const DEFAULTS = {
    text: "RĪDZE",
    size: "M",
    fontId: "righteous",
    weight: 400,
    paddingFactor: PADDING.defaultFactor,
    holeSide: "start",
    showHole: false,
    colorMode: "single",
    baseColor: "blue",
    textColor: "white",
    symbolBefore: null,
    symbolAfter: null,
    hardwareId: "ring",
  };

  return {
    LETTER_HEIGHT_MM,
    SIZES,
    ORDER_SIZES,
    LENGTH_ESTIMATE_SCALE,
    MARSHALL,
    HOLE_DIAMETER_MM,
    TAB_RADIUS_MM,
    PADDING,
    MIN_CONNECTION_MM,
    COLORS,
    HARDWARE,
    PRICING,
    DEFAULTS,
    ORDER_EMAIL,
    TRACKING,
  };
})();
