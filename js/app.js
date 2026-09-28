(() => {
  const cfg = window.TagLabConfig;
  const Fonts = window.TagLabFonts;
  const Pricing = window.TagLabPricing;
  const Geo = window.TagLabGeometry;

  const state = { ...cfg.DEFAULTS };
  let lastBuild = null;
  let renderToken = 0;

  const $ = (id) => document.getElementById(id);

  function colorById(id) {
    return cfg.COLORS.find((c) => c.id === id) || cfg.COLORS[0];
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

  function fillSelect(sel, items, value) {
    sel.innerHTML = items
      .map(
        ([v, label]) =>
          `<option value="${v}" ${String(v) === String(value) ? "selected" : ""}>${label}</option>`
      )
      .join("");
  }

  function refreshWeightSelect() {
    const weights = Fonts.weightsFor(state.fontId);
    const field = $("weightField");
    if (weights.length <= 1) {
      field.style.display = "none";
      state.weight = weights[0] || 400;
      return;
    }
    field.style.display = "";
    state.weight = Fonts.pickWeight(state.fontId, state.weight);
    fillSelect(
      $("weight"),
      weights.map((w) => [w, Fonts.getFamily(state.fontId).weights[w].label]),
      state.weight
    );
  }

  function setActive(container, attr, value) {
    container.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute(attr) === value);
    });
  }

  function renderSwatches(el, selected, onPick) {
    el.innerHTML = "";
    cfg.COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch" + (c.id === selected ? " active" : "");
      b.style.background = c.hex;
      b.title = c.label;
      b.addEventListener("click", () => onPick(c.id));
      el.appendChild(b);
    });
  }

  function renderSymbols(el, selected, onPick) {
    el.innerHTML = "";
    const none = document.createElement("button");
    none.type = "button";
    none.textContent = "Nav";
    none.className = selected ? "" : "active";
    none.addEventListener("click", () => onPick(null));
    el.appendChild(none);
    window.TagLabSymbols.list().forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.label;
      b.className = selected === s.id ? "active" : "";
      b.addEventListener("click", () => onPick(s.id));
      el.appendChild(b);
    });
  }

  function updateColorModeUi() {
    const double = state.colorMode === "double";
    $("textColorField").style.display = double ? "" : "none";
    $("baseColorLabel").textContent = double ? "Plāksnītes krāsa" : "Krāsa";
    document.querySelectorAll("[data-mode]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-mode") === state.colorMode);
    });
  }

  function glyphIssue(font) {
    const text = state.text || "";
    const missing = Fonts.missingGlyphs(font, text);
    const family = Fonts.getFamily(state.fontId);
    const lv = Fonts.textNeedsLatvian(text);
    if (missing.length || (lv && family && family.supportsLatvian === false)) {
      return {
        missing,
        suggest: (family && family.suggest) || "nunito",
      };
    }
    return null;
  }

  async function rebuild() {
    const token = ++renderToken;
    try {
      const loaded = await Fonts.loadFont(state.fontId, state.weight);
      if (token !== renderToken) return;
      state.weight = loaded.weight;
      const issue = glyphIssue(loaded.font);
      const warn = $("fontWarn");
      if (issue) {
        warn.classList.add("visible");
      } else {
        warn.classList.remove("visible");
      }

      const built = Geo.build(state, loaded.font);
      lastBuild = { ...built, issue, fontId: state.fontId, weight: state.weight };
      paint(lastBuild);
    } catch (err) {
      console.error(err);
      $("lenWarn").textContent = "Neizdevās ielādēt fontu.";
      $("lenWarn").classList.add("visible");
    }
  }

  function paint(built) {
    const svg = $("preview");
    const base = $("layer-base");
    const text = $("layer-text");
    const padWarn = $("padWarn");
    const lenWarn = $("lenWarn");
    const exportBtn = $("exportBtn");

    if (!built.ok) {
      base.setAttribute("d", "");
      text.setAttribute("d", "");
      $("lengthLabel").textContent = "—";
      $("priceLabel").textContent = "—";
      exportBtn.disabled = true;
      padWarn.classList.remove("visible");
      lenWarn.classList.remove("visible");
      return;
    }

    const pad = 3;
    svg.setAttribute(
      "viewBox",
      `${-pad} ${-pad} ${built.svgW + pad * 2} ${built.svgH + pad * 2}`
    );
    base.setAttribute("d", built.plateD);
    text.setAttribute("d", built.textD);

    const baseHex = colorById(state.baseColor).hex;
    const textHex = colorById(state.textColor).hex;
    base.setAttribute("fill", baseHex);
    if (state.colorMode === "single") {
      const lum =
        parseInt(baseHex.slice(1, 3), 16) * 0.3 +
        parseInt(baseHex.slice(3, 5), 16) * 0.5 +
        parseInt(baseHex.slice(5, 7), 16) * 0.2;
      text.setAttribute("fill", lum > 140 ? darken(baseHex, 45) : lighten(baseHex, 55));
    } else {
      text.setAttribute("fill", textHex);
    }

    $("lengthLabel").textContent = built.lengthMm.toFixed(1) + " mm";
    const price = Pricing.priceForLength(built.lengthMm);
    if (price.ok) {
      $("priceLabel").textContent = Pricing.formatPrice(price.priceEur);
      lenWarn.classList.remove("visible");
    } else {
      $("priceLabel").textContent = "—";
      lenWarn.textContent = price.message;
      lenWarn.classList.add("visible");
    }

    if (built.paddingMm < cfg.MIN_CONNECTION_MM) {
      padWarn.classList.add("visible");
    } else {
      padWarn.classList.remove("visible");
    }

    exportBtn.disabled = Boolean(built.issue) || !price.ok;
  }

  function downloadSvg() {
    if (!lastBuild || !lastBuild.ok || lastBuild.issue) return;
    const price = Pricing.priceForLength(lastBuild.lengthMm);
    if (!price.ok) return;

    const w = lastBuild.svgW.toFixed(2);
    const h = lastBuild.svgH.toFixed(2);
    const baseHex = colorById(state.baseColor).hex;
    const textHex =
      state.colorMode === "double"
        ? colorById(state.textColor).hex
        : baseHex;
    const name = (state.text || "piekarins").replace(/[^\p{L}\p{N}]+/gu, "-") || "piekarins";
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
  <desc>TagLab keychain | size=${state.size} | font=${state.fontId} ${state.weight} | mode=${state.colorMode} | length=${lastBuild.lengthMm.toFixed(1)}mm | price=${price.priceEur}EUR</desc>
  <g id="layer-base" data-role="plate">
    <path fill="${baseHex}" fill-rule="evenodd" d="${lastBuild.plateD}"/>
  </g>
  <g id="layer-text" data-role="raised-text">
    <path fill="${textHex}" fill-rule="evenodd" d="${lastBuild.textD}"/>
  </g>
</svg>
`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `taglab-${name}-${state.size}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function bind() {
    fillSelect(
      $("font"),
      Fonts.familyIds().map((id) => [id, Fonts.getFamily(id).label]),
      state.fontId
    );
    refreshWeightSelect();

    $("text").value = state.text;
    $("text").addEventListener("input", () => {
      state.text = $("text").value;
      rebuild();
    });
    $("font").addEventListener("change", () => {
      state.fontId = $("font").value;
      refreshWeightSelect();
      rebuild();
    });
    $("weight").addEventListener("change", () => {
      state.weight = Number($("weight").value);
      rebuild();
    });

    const sizeSeg = $("sizeSeg");
    Object.keys(cfg.SIZES).forEach((key) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = key;
      b.setAttribute("data-size", key);
      b.className = key === state.size ? "active" : "";
      b.addEventListener("click", () => {
        state.size = key;
        setActive(sizeSeg, "data-size", key);
        rebuild();
      });
      sizeSeg.appendChild(b);
    });

    const pad = $("padding");
    const t =
      (state.paddingFactor - cfg.PADDING.minFactor) /
      (cfg.PADDING.maxFactor - cfg.PADDING.minFactor);
    pad.value = String(Math.round(t * 100));
    pad.addEventListener("input", () => {
      const k = Number(pad.value) / 100;
      state.paddingFactor =
        cfg.PADDING.minFactor + k * (cfg.PADDING.maxFactor - cfg.PADDING.minFactor);
      rebuild();
    });

    document.querySelectorAll("[data-side]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-side") === state.holeSide);
      b.addEventListener("click", () => {
        state.holeSide = b.getAttribute("data-side");
        document.querySelectorAll("[data-side]").forEach((x) => {
          x.classList.toggle("active", x === b);
        });
        rebuild();
      });
    });

    document.querySelectorAll("[data-mode]").forEach((b) => {
      b.addEventListener("click", () => {
        state.colorMode = b.getAttribute("data-mode");
        updateColorModeUi();
        paint(lastBuild || { ok: false });
      });
    });

    const bindBase = () =>
      renderSwatches($("baseColors"), state.baseColor, (id) => {
        state.baseColor = id;
        bindBase();
        paint(lastBuild);
      });
    const bindText = () =>
      renderSwatches($("textColors"), state.textColor, (id) => {
        state.textColor = id;
        bindText();
        paint(lastBuild);
      });
    bindBase();
    bindText();

    const bindSym = (el, key) => {
      renderSymbols(el, state[key], (id) => {
        state[key] = id;
        bindSym(el, key);
        rebuild();
      });
    };
    bindSym($("symBefore"), "symbolBefore");
    bindSym($("symAfter"), "symbolAfter");

    $("useNunito").addEventListener("click", () => {
      const w = state.weight;
      state.fontId = "nunito";
      $("font").value = "nunito";
      refreshWeightSelect();
      state.weight = Fonts.pickWeight("nunito", w);
      $("weight").value = String(state.weight);
      rebuild();
    });

    $("exportBtn").addEventListener("click", downloadSvg);
    updateColorModeUi();
  }

  bind();
  rebuild();
})();
