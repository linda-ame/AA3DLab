(() => {
  const cfg = window.TagLabConfig;
  const Fonts = window.TagLabFonts;
  const Geo = window.TagLabGeometry;

  const state = {
    ...cfg.DEFAULTS,
    showHole: false,
    symbolBefore: null,
    symbolAfter: null,
  };

  let lastBuild = null;
  /** Plate length at preview letter height, using standard padding (not visual Overlock padding). */
  let lastLengthMm = null;
  let renderToken = 0;
  const $ = (id) => document.getElementById(id);

  function colorById(id) {
    return cfg.COLORS.find((c) => c.id === id) || cfg.COLORS[0];
  }

  function fontLabel(id) {
    const fam = Fonts.getFamily(id);
    return (fam && fam.label) || id;
  }

  function lighten(hex, amt) {
    const n = hex.replace("#", "");
    const r = Math.min(255, parseInt(n.slice(0, 2), 16) + amt);
    const g = Math.min(255, parseInt(n.slice(2, 4), 16) + amt);
    const b = Math.min(255, parseInt(n.slice(4, 6), 16) + amt);
    const h = (x) => x.toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  function darken(hex, amt) {
    const n = hex.replace("#", "");
    const r = Math.max(0, parseInt(n.slice(0, 2), 16) - amt);
    const g = Math.max(0, parseInt(n.slice(2, 4), 16) - amt);
    const b = Math.max(0, parseInt(n.slice(4, 6), 16) - amt);
    const h = (x) => x.toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  function raisedInk(plateHex) {
    const lum =
      parseInt(plateHex.slice(1, 3), 16) * 0.3 +
      parseInt(plateHex.slice(3, 5), 16) * 0.5 +
      parseInt(plateHex.slice(5, 7), 16) * 0.2;
    // Subtle shade only — same colour, emboss hint (not a second colour).
    return lum > 140 ? darken(plateHex, 28) : darken(plateHex, 22);
  }

  function sizeLabel(id) {
    const s = cfg.ORDER_SIZES && cfg.ORDER_SIZES[id];
    return (s && s.label) || id;
  }

  function orderLetterHeightMm(sizeId) {
    const s = cfg.ORDER_SIZES && cfg.ORDER_SIZES[sizeId];
    if (s && typeof s.letterHeightMm === "number") return s.letterHeightMm;
    return cfg.LETTER_HEIGHT_MM || 22;
  }

  /** Scale length build (standard padding @ LETTER_HEIGHT_MM) to chosen S/M/L. */
  function estimateLengthMm() {
    if (!Number.isFinite(lastLengthMm) || lastLengthMm <= 0) return null;
    const previewH = cfg.LETTER_HEIGHT_MM || 22;
    const orderH = orderLetterHeightMm(state.size);
    const scale = cfg.LENGTH_ESTIMATE_SCALE || 1;
    return lastLengthMm * (orderH / previewH) * scale;
  }

  function formatLengthCm(mm) {
    if (!Number.isFinite(mm) || mm <= 0) return "—";
    const cm = mm / 10;
    return "≈ " + cm.toFixed(1).replace(".", ",") + " cm";
  }

  function holeLabel(side) {
    return side === "end" ? "vārda beigās" : "vārda sākumā";
  }

  function setActive(container, attr, value) {
    container.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("is-on", btn.getAttribute(attr) === value);
    });
  }

  function paint(built) {
    const svg = $("preview");
    const base = $("layer-base");
    const text = $("layer-text");
    const plateHex = colorById(state.baseColor).hex;

    if (!built || !built.ok) {
      base.setAttribute("d", "");
      text.setAttribute("d", "");
      return;
    }

    const pad = 3;
    svg.setAttribute(
      "viewBox",
      `${-pad} ${-pad} ${built.svgW + pad * 2} ${built.svgH + pad * 2}`
    );
    base.setAttribute("d", built.plateD);
    text.setAttribute("d", built.textD);
    base.setAttribute("fill", plateHex);
    text.setAttribute("fill", raisedInk(plateHex));
  }

  function updateSummary() {
    const text = (state.text || "").trim() || "—";
    $("summaryText").textContent = text;
    $("summaryFont").textContent = fontLabel(state.fontId);
    $("summaryColor").textContent = colorById(state.baseColor).label;
    const sizeEl = $("summarySize");
    if (sizeEl) sizeEl.textContent = sizeLabel(state.size);
    const lenEl = $("summaryLength");
    if (lenEl) {
      const mm = estimateLengthMm();
      lenEl.textContent = mm == null ? "—" : formatLengthCm(mm);
    }
    $("summaryHole").textContent = holeLabel(state.holeSide);
  }

  function updateFontWarnings(fam, missing) {
    const warn = $("fontWarn");
    const stage = $("stageFontWarn");
    const noLv = Boolean(fam && fam.supportsLatvian === false);

    const lvMsg =
      "! Šis fonts neatbalsta latviešu mīkstinājumus un garumzīmes. Ja tās ir nepieciešamas, tad izvēlies citu fontu.";

    if (missing.length) {
      const missMsg =
        "! Šajā fontā trūkst burti: " +
        missing.join(", ") +
        ". Ja tie ir nepieciešami, tad izvēlies citu fontu.";
      if (warn) {
        warn.hidden = false;
        warn.textContent = missMsg;
      }
      if (stage) {
        stage.hidden = false;
        stage.textContent = missMsg;
      }
      return;
    }

    if (warn) warn.hidden = true;

    if (stage) {
      if (noLv) {
        stage.hidden = false;
        stage.textContent = lvMsg;
      } else {
        stage.hidden = true;
        stage.textContent = "";
      }
    }
  }

  async function rebuild() {
    const token = ++renderToken;
    updateSummary();
    try {
      const weight = Fonts.pickWeight(state.fontId, state.weight);
      const loaded = await Fonts.loadFont(state.fontId, weight);
      if (token !== renderToken) return;
      state.weight = loaded.weight;

      const fam = Fonts.getFamily(state.fontId);
      const text = state.text || "";
      const missing = Fonts.missingGlyphs(loaded.font, text);
      updateFontWarnings(fam, missing);

      const paddingFactor =
        fam && typeof fam.paddingFactor === "number"
          ? fam.paddingFactor
          : state.paddingFactor;
      const letterAdvanceScale =
        fam && typeof fam.letterAdvanceScale === "number"
          ? fam.letterAdvanceScale
          : 1;

      const built = Geo.build(
        {
          ...state,
          size: "M",
          showHole: false,
          paddingFactor,
          letterAdvanceScale,
        },
        loaded.font
      );
      lastBuild = built;
      paint(built);

      // Length uses standard rim padding — Overlock's fat visual padding must not inflate cm.
      const lengthPad =
        (cfg.PADDING && cfg.PADDING.defaultFactor) || state.paddingFactor || 0.2;
      if (paddingFactor === lengthPad && letterAdvanceScale === 1 && built.ok) {
        lastLengthMm = built.lengthMm;
      } else {
        const lengthBuilt = Geo.build(
          {
            ...state,
            size: "M",
            showHole: false,
            paddingFactor: lengthPad,
            letterAdvanceScale: 1,
          },
          loaded.font
        );
        lastLengthMm =
          lengthBuilt && lengthBuilt.ok ? lengthBuilt.lengthMm : null;
      }
      updateSummary();
    } catch (err) {
      console.error(err);
      lastLengthMm = null;
      const msg =
        "Neizdevās ielādēt fontu. Pārbaudi, ka lapa atvērta caur http:// (ne file://).";
      const warn = $("fontWarn");
      if (warn) {
        warn.hidden = false;
        warn.textContent = msg;
      }
      const stage = $("stageFontWarn");
      if (stage) {
        stage.hidden = false;
        stage.textContent = msg;
      }
    }
  }

  function orderBody() {
    const color = colorById(state.baseColor);
    const m = cfg.MARSHALL;
    const len = estimateLengthMm();

    return [
      "Individuālais piekariņš:",
      `Teksts: ${(state.text || "").trim() || "—"}`,
      `Fonts: ${fontLabel(state.fontId)}`,
      `Krāsa: ${color.label} (${color.hex})`,
      `Izmērs: ${sizeLabel(state.size)}`,
      `Aptuvenais garums: ${len == null ? "—" : formatLengthCm(len)}`,
      `Caurums: ${holeLabel(state.holeSide)}`,
      "",
      "Marshall parametri (ražošanai):",
      `  font size ${m.fontSizePx}px`,
      `  body thickness ${m.bodyThicknessPx}px`,
      `  extra padding ${m.extraPaddingPx}px`,
    ].join("\n");
  }

  function previewSvgMarkup() {
    const svg = $("preview");
    if (!svg) return "";
    const clone = svg.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    let vbW = 120;
    let vbH = 40;
    if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) {
      const vb = svg.viewBox.baseVal;
      vbW = vb.width;
      vbH = vb.height;
      if (!clone.getAttribute("viewBox")) {
        clone.setAttribute(
          "viewBox",
          `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
        );
      }
    }
    clone.setAttribute("width", String(Math.round(vbW * 4)));
    clone.setAttribute("height", String(Math.round(vbH * 4)));
    return new XMLSerializer().serializeToString(clone);
  }

  function previewPngDataUrl(svgMarkup) {
    return new Promise((resolve) => {
      if (!svgMarkup) {
        resolve("");
        return;
      }
      const blob = new Blob([svgMarkup], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const w = Math.max(320, Math.round(img.naturalWidth || 320));
          const h = Math.max(120, Math.round(img.naturalHeight || 120));
          const scale = Math.min(1, 640 / w);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#e8ecef";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        } catch (err) {
          console.warn("PNG preview failed", err);
          resolve("");
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve("");
      };
      img.src = url;
    });
  }

  async function addToCart() {
    const Cart = window.AA3DCart;
    if (!Cart) {
      $("copyStatus").textContent = "Pasūtījuma sistēma nav ielādēta.";
      return;
    }
    const text = (state.text || "").trim();
    if (!text) {
      $("copyStatus").textContent = "Vispirms ieraksti tekstu.";
      return;
    }
    if (!lastBuild || !lastBuild.ok) {
      $("copyStatus").textContent = "Pagaidi, kamēr ielādējas priekšskatījums…";
      return;
    }

    const color = colorById(state.baseColor);
    const previewSvg = previewSvgMarkup();
    const previewPng = await previewPngDataUrl(previewSvg);
    if (!previewSvg && !previewPng) {
      $("copyStatus").textContent =
        "Neizdevās saglabāt vizualizāciju. Pārlādē lapu un mēģini vēlreiz.";
      return;
    }

    try {
      Cart.addCustom({
        text,
        fontId: state.fontId,
        fontLabel: fontLabel(state.fontId),
        colorId: color.id,
        colorLabel: color.label,
        colorHex: color.hex,
        sizeId: state.size,
        sizeLabel: sizeLabel(state.size),
        lengthMm: estimateLengthMm(),
        lengthLabel: formatLengthCm(estimateLengthMm()),
        holeSide: state.holeSide,
        holeLabel: holeLabel(state.holeSide),
        previewSvg,
        previewPng,
      });
    } catch (err) {
      console.error(err);
      $("copyStatus").textContent =
        "Neizdevās saglabāt grozā (pārāk liela vizualizācija?). Mēģini īsāku tekstu.";
      return;
    }
    window.location.href = "pasutit.html";
  }

  async function copyOrder() {
    try {
      await navigator.clipboard.writeText(orderBody());
      $("copyStatus").textContent = "Nokopēts — ielīmē e-pastā vai Instagram.";
    } catch {
      $("copyStatus").textContent = "Neizdevās nokopēt.";
    }
  }

  function bind() {
    const textInput = $("text");
    textInput.value = state.text;
    textInput.addEventListener("input", () => {
      state.text = textInput.value;
      rebuild();
    });

    const fontSel = $("font");
    Fonts.familyIds().forEach((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = fontLabel(id);
      fontSel.appendChild(opt);
    });
    fontSel.value = state.fontId;
    fontSel.addEventListener("change", () => {
      state.fontId = fontSel.value;
      state.weight = Fonts.pickWeight(state.fontId, state.weight);
      rebuild();
    });

    const holeSeg = $("holeSeg");
    holeSeg.querySelectorAll("[data-hole]").forEach((b) => {
      b.classList.toggle("is-on", b.getAttribute("data-hole") === state.holeSide);
      b.addEventListener("click", () => {
        state.holeSide = b.getAttribute("data-hole");
        setActive(holeSeg, "data-hole", state.holeSide);
        updateSummary();
      });
    });

    const swatches = $("colorSwatches");
    cfg.COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className =
        "swatch" +
        (c.shine ? " swatch--shine" : "") +
        (c.id === state.baseColor ? " is-on" : "");
      b.style.background = c.hex;
      b.dataset.color = c.id;
      b.title = c.label;
      b.setAttribute("aria-label", c.label);
      b.addEventListener("click", () => {
        state.baseColor = c.id;
        swatches.querySelectorAll(".swatch").forEach((x) => {
          x.classList.toggle("is-on", x === b);
        });
        paint(lastBuild);
        updateSummary();
      });
      swatches.appendChild(b);
    });

    const sizeSeg = $("sizeSeg");
    if (sizeSeg && cfg.ORDER_SIZES) {
      Object.keys(cfg.ORDER_SIZES).forEach((key) => {
        const s = cfg.ORDER_SIZES[key];
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("data-size", key);
        b.className = key === state.size ? "is-on" : "";
        b.textContent = s.label;
        b.addEventListener("click", () => {
          state.size = key;
          setActive(sizeSeg, "data-size", key);
          updateSummary();
        });
        sizeSeg.appendChild(b);
      });
    }

    $("orderBtn").addEventListener("click", addToCart);
    $("copyBtn").addEventListener("click", copyOrder);
  }

  bind();
  rebuild();
})();
