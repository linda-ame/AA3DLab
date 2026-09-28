window.TagLabGeometry = (() => {
  const CLIP = 1000; // clipper integer units per mm
  const CURVE_STEPS = 10;

  function clip(n) {
    return Math.round(n * CLIP);
  }

  function unclip(n) {
    return n / CLIP;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function sampleCubic(p0, p1, p2, p3, steps) {
    const pts = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      pts.push({
        x:
          u * u * u * p0.x +
          3 * u * u * t * p1.x +
          3 * u * t * t * p2.x +
          t * t * t * p3.x,
        y:
          u * u * u * p0.y +
          3 * u * u * t * p1.y +
          3 * u * t * t * p2.y +
          t * t * t * p3.y,
      });
    }
    return pts;
  }

  function sampleQuad(p0, p1, p2, steps) {
    const pts = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      pts.push({
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
      });
    }
    return pts;
  }

  function opentypePathToPolys(otPath) {
    const polys = [];
    let current = [];
    let start = null;
    let last = { x: 0, y: 0 };

    function close() {
      if (current.length >= 3) polys.push(current);
      current = [];
    }

    for (const cmd of otPath.commands) {
      if (cmd.type === "M") {
        close();
        last = { x: cmd.x, y: cmd.y };
        start = { ...last };
        current = [{ ...last }];
      } else if (cmd.type === "L") {
        last = { x: cmd.x, y: cmd.y };
        current.push({ ...last });
      } else if (cmd.type === "C") {
        const p1 = { x: cmd.x1, y: cmd.y1 };
        const p2 = { x: cmd.x2, y: cmd.y2 };
        const p3 = { x: cmd.x, y: cmd.y };
        current.push(...sampleCubic(last, p1, p2, p3, CURVE_STEPS));
        last = p3;
      } else if (cmd.type === "Q") {
        const p1 = { x: cmd.x1, y: cmd.y1 };
        const p2 = { x: cmd.x, y: cmd.y };
        current.push(...sampleQuad(last, p1, p2, CURVE_STEPS));
        last = p2;
      } else if (cmd.type === "Z") {
        if (start) last = { ...start };
        close();
      }
    }
    close();
    return polys;
  }

  function tokenizePath(d) {
    return d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  }

  function svgPathToPolys(d) {
    const tokens = tokenizePath(d);
    let i = 0;
    const polys = [];
    let current = [];
    let start = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };
    let lastC = null;
    let cmd = "M";

    function num() {
      return parseFloat(tokens[i++]);
    }
    function close() {
      if (current.length >= 3) polys.push(current);
      current = [];
    }

    while (i < tokens.length) {
      const t = tokens[i];
      if (/^[A-Za-z]$/.test(t)) {
        cmd = t;
        i++;
      }
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();

      if (C === "Z") {
        if (start) last = { ...start };
        close();
        lastC = null;
        continue;
      }
      if (C === "M") {
        close();
        let x = num();
        let y = num();
        if (rel) {
          x += last.x;
          y += last.y;
        }
        last = { x, y };
        start = { ...last };
        current = [{ ...last }];
        cmd = rel ? "l" : "L";
        lastC = null;
        continue;
      }
      if (C === "L") {
        let x = num();
        let y = num();
        if (rel) {
          x += last.x;
          y += last.y;
        }
        last = { x, y };
        current.push({ ...last });
        lastC = null;
        continue;
      }
      if (C === "H") {
        let x = num();
        if (rel) x += last.x;
        last = { x, y: last.y };
        current.push({ ...last });
        lastC = null;
        continue;
      }
      if (C === "V") {
        let y = num();
        if (rel) y += last.y;
        last = { x: last.x, y };
        current.push({ ...last });
        lastC = null;
        continue;
      }
      if (C === "C") {
        let x1 = num();
        let y1 = num();
        let x2 = num();
        let y2 = num();
        let x = num();
        let y = num();
        if (rel) {
          x1 += last.x;
          y1 += last.y;
          x2 += last.x;
          y2 += last.y;
          x += last.x;
          y += last.y;
        }
        const p1 = { x: x1, y: y1 };
        const p2 = { x: x2, y: y2 };
        const p3 = { x, y };
        current.push(...sampleCubic(last, p1, p2, p3, CURVE_STEPS));
        lastC = p2;
        last = p3;
        continue;
      }
      if (C === "S") {
        let x2 = num();
        let y2 = num();
        let x = num();
        let y = num();
        if (rel) {
          x2 += last.x;
          y2 += last.y;
          x += last.x;
          y += last.y;
        }
        const p1 = lastC
          ? { x: 2 * last.x - lastC.x, y: 2 * last.y - lastC.y }
          : { ...last };
        const p2 = { x: x2, y: y2 };
        const p3 = { x, y };
        current.push(...sampleCubic(last, p1, p2, p3, CURVE_STEPS));
        lastC = p2;
        last = p3;
        continue;
      }
      if (C === "Q") {
        let x1 = num();
        let y1 = num();
        let x = num();
        let y = num();
        if (rel) {
          x1 += last.x;
          y1 += last.y;
          x += last.x;
          y += last.y;
        }
        const p1 = { x: x1, y: y1 };
        const p2 = { x, y };
        current.push(...sampleQuad(last, p1, p2, CURVE_STEPS));
        lastC = p1;
        last = p2;
        continue;
      }
      if (C === "T") {
        let x = num();
        let y = num();
        if (rel) {
          x += last.x;
          y += last.y;
        }
        const p1 = lastC
          ? { x: 2 * last.x - lastC.x, y: 2 * last.y - lastC.y }
          : { ...last };
        const p2 = { x, y };
        current.push(...sampleQuad(last, p1, p2, CURVE_STEPS));
        lastC = p1;
        last = p2;
        continue;
      }
      if (C === "A") {
        num();
        num();
        num();
        num();
        num();
        let x = num();
        let y = num();
        if (rel) {
          x += last.x;
          y += last.y;
        }
        last = { x, y };
        current.push({ ...last });
        lastC = null;
        continue;
      }
      i++;
    }
    close();
    return polys;
  }

  function transformPolys(polys, fn) {
    return polys.map((poly) => poly.map(fn));
  }

  function toClip(polys) {
    return polys.map((poly) =>
      poly.map((p) => ({ X: clip(p.x), Y: clip(p.y) }))
    );
  }

  function fromClip(paths) {
    return paths.map((path) =>
      path.map((p) => ({ x: unclip(p.X), y: unclip(p.Y) }))
    );
  }

  function unionPaths(clipPaths) {
    const cpr = new ClipperLib.Clipper();
    cpr.AddPaths(clipPaths, ClipperLib.PolyType.ptSubject, true);
    const solution = new ClipperLib.Paths();
    // NonZero: overlapping tab/bridge/plate must stay solid.
    // EvenOdd punched a void wherever an even number of shapes overlapped
    // (looked like a stage-coloured gap / open ring at the hole).
    cpr.Execute(
      ClipperLib.ClipType.ctUnion,
      solution,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero
    );
    return solution;
  }

  function offsetPaths(clipPaths, deltaMm) {
    const co = new ClipperLib.ClipperOffset(2, 0.25 * CLIP);
    co.AddPaths(
      clipPaths,
      ClipperLib.JoinType.jtRound,
      ClipperLib.EndType.etClosedPolygon
    );
    const out = new ClipperLib.Paths();
    co.Execute(out, clip(deltaMm));
    return out;
  }

  function difference(subj, clipPaths) {
    const cpr = new ClipperLib.Clipper();
    cpr.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
    cpr.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
    const solution = new ClipperLib.Paths();
    cpr.Execute(
      ClipperLib.ClipType.ctDifference,
      solution,
      ClipperLib.PolyFillType.pftNonZero,
      ClipperLib.PolyFillType.pftNonZero
    );
    return solution;
  }

  function circlePoly(cx, cy, r, steps = 48) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return pts;
  }

  function rectPoly(x0, y0, x1, y1) {
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  }

  function bboxOf(polys) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const poly of polys) {
      for (const p of poly) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    if (!Number.isFinite(minX)) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  function polysToD(polys) {
    return polys
      .map((poly) => {
        if (!poly.length) return "";
        const parts = [`M ${poly[0].x.toFixed(3)} ${poly[0].y.toFixed(3)}`];
        for (let i = 1; i < poly.length; i++) {
          parts.push(`L ${poly[i].x.toFixed(3)} ${poly[i].y.toFixed(3)}`);
        }
        parts.push("Z");
        return parts.join(" ");
      })
      .join(" ");
  }

  function capHeight(font) {
    // Prefer real capital H metrics — some fonts (e.g. Overlock) ship a broken
    // OS/2 sCapHeight that is far too small and inflates length ~4×.
    try {
      const g = font.charToGlyph("H");
      if (g && typeof g.yMax === "number" && g.yMax > 0) return g.yMax;
    } catch (_) {
      /* ignore */
    }
    const os2 = font.tables && font.tables.os2;
    const asc = font.ascender || (font.unitsPerEm || 1000) * 0.8;
    if (os2 && os2.sCapHeight && os2.sCapHeight > asc * 0.35) {
      return os2.sCapHeight;
    }
    return asc * 0.72;
  }

  function fontSizeForHeight(font, letterHeightMm) {
    return (letterHeightMm * font.unitsPerEm) / capHeight(font);
  }

  function symbolPolys(id, cx, cy, letterHeightMm) {
    const packed = window.TagLabSymbols.toPathCommands(id, cx, cy, letterHeightMm);
    if (!packed || !packed.d) return [];
    const { d, transform } = packed;
    const raw = svgPathToPolys(d);
    const s = transform.scale;
    const box = transform.box;
    return transformPolys(raw, (p) => ({
      x: cx + (p.x - box / 2) * s,
      y: cy + (p.y - box / 2) * s,
    }));
  }

  function build(state, font) {
    const cfg = window.TagLabConfig;
    const letterH = cfg.SIZES[state.size].letterHeightMm;
    const fontSize = fontSizeForHeight(font, letterH);
    const gap = letterH * 0.18;
    const baselineY = letterH;

    const text = (state.text || "").replace(/\s+/g, " ").trim();
    const parts = [];
    let cursorX = 0;

    if (state.symbolBefore) {
      const w = letterH;
      parts.push(
        ...symbolPolys(state.symbolBefore, cursorX + w / 2, letterH / 2, letterH)
      );
      cursorX += w + gap;
    }

    if (text) {
      const advanceScale =
        typeof state.letterAdvanceScale === "number" && state.letterAdvanceScale > 0
          ? state.letterAdvanceScale
          : 1;

      if (advanceScale === 1) {
        const otPath = font.getPath(text, cursorX, baselineY, fontSize);
        parts.push(...opentypePathToPolys(otPath));
        const adv = font.getAdvanceWidth
          ? font.getAdvanceWidth(text, fontSize)
          : otPath.getBoundingBox().x2 - cursorX;
        cursorX += adv;
      } else {
        for (const ch of text) {
          if (ch === " ") {
            cursorX += fontSize * 0.33 * advanceScale;
            continue;
          }
          const otPath = font.getPath(ch, cursorX, baselineY, fontSize);
          parts.push(...opentypePathToPolys(otPath));
          const adv = font.getAdvanceWidth
            ? font.getAdvanceWidth(ch, fontSize)
            : Math.max(0, otPath.getBoundingBox().x2 - cursorX);
          cursorX += adv * advanceScale;
        }
      }
    }

    if (state.symbolAfter) {
      cursorX += text ? gap : 0;
      const w = letterH;
      parts.push(
        ...symbolPolys(state.symbolAfter, cursorX + w / 2, letterH / 2, letterH)
      );
    }

    if (!parts.length) {
      return {
        ok: false,
        paddingMm: Math.max(cfg.PADDING.minMm, letterH * state.paddingFactor),
        lengthMm: 0,
        heightMm: 0,
        plateD: "",
        textD: "",
        hole: null,
        bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
      };
    }

    const textClip = unionPaths(toClip(parts));
    const paddingMm = Math.max(
      cfg.PADDING.minMm,
      letterH * state.paddingFactor
    );
    const plateClip = offsetPaths(textClip, paddingMm);
    let platePolys = fromClip(plateClip);

    let textPolys;
    let holeMeta = null;

    // Preview mode: letter outline plate only — no keyring ear / hole.
    const showHole = state.showHole !== false;
    if (!showHole) {
      textPolys = fromClip(textClip);
    } else {
      const plateBox = bboxOf(platePolys);
      const holeR = cfg.HOLE_DIAMETER_MM / 2;
      const cy = (plateBox.minY + plateBox.maxY) / 2;
      const wallMm = Math.max(2.0, holeR * 1.0);
      const overlapMm = Math.max(3.5, cfg.TAB_RADIUS_MM * 0.75);
      const tabR = Math.max(cfg.TAB_RADIUS_MM, holeR + wallMm + 1.4);
      const bridgeHalfH = tabR * 0.95;
      const side = state.holeSide === "right" || state.holeSide === "end"
        ? "right"
        : "left";
      let holeCx;
      let bridge;
      if (side === "right") {
        holeCx = plateBox.maxX + holeR + wallMm;
        bridge = rectPoly(
          plateBox.maxX - overlapMm,
          cy - bridgeHalfH,
          holeCx + tabR * 0.2,
          cy + bridgeHalfH
        );
      } else {
        holeCx = plateBox.minX - holeR - wallMm;
        bridge = rectPoly(
          holeCx - tabR * 0.2,
          cy - bridgeHalfH,
          plateBox.minX + overlapMm,
          cy + bridgeHalfH
        );
      }
      const tab = circlePoly(holeCx, cy, tabR);
      const hole = circlePoly(holeCx, cy, holeR);

      const withTab = unionPaths(toClip([...platePolys, tab, bridge]));
      platePolys = fromClip(withTab);
      platePolys.push(hole);
      textPolys = fromClip(difference(textClip, toClip([hole])));
      holeMeta = { cx: holeCx, cy, r: holeR };
    }

    const fullBox = bboxOf(platePolys);
    const margin = 2;
    const shiftX = -fullBox.minX + margin;
    const shiftY = -fullBox.minY + margin;
    const shift = (p) => ({ x: p.x + shiftX, y: p.y + shiftY });

    const plateOut = transformPolys(platePolys, shift);
    const textOut = transformPolys(textPolys, shift);
    const outBox = bboxOf(plateOut);

    const svgW = outBox.maxX + margin;
    const svgH = outBox.maxY + margin;

    return {
      ok: true,
      paddingMm,
      lengthMm: outBox.width,
      heightMm: outBox.height,
      plateD: polysToD(plateOut),
      textD: polysToD(textOut),
      hole: holeMeta
        ? {
            cx: holeMeta.cx + shiftX,
            cy: holeMeta.cy + shiftY,
            r: holeMeta.r,
          }
        : null,
      bbox: outBox,
      margin,
      svgW,
      svgH,
    };
  }

  return { build, bboxOf, polysToD };
})();
