window.TagLabPricing = (() => {
  const cfg = window.TagLabConfig || {};
  const HARDWARE = cfg.HARDWARE || {
    ring: { id: "ring", label: "Standarta riņķītis", short: "Riņķītis", surchargeEur: 0 },
    carabiner: {
      id: "carabiner",
      label: "Riņķītis + karabīne",
      short: "Riņķītis + karabīne",
      surchargeEur: 0.5,
    },
  };
  const PRICING = Object.assign(
    {
      readyBaseEur: { S: 1.5, M: 2.0, L: 2.5 },
      customBaseEur: { S: 2.0, M: 2.5, L: 3.5 },
      freeChars: 10,
      longTextSurchargeEur: 0.5,
    },
    cfg.PRICING || {}
  );

  const listeners = [];

  function hardwareOf(id) {
    return HARDWARE[id] || HARDWARE.ring;
  }

  function hardwareList() {
    return Object.keys(HARDWARE).map((k) => HARDWARE[k]);
  }

  /** Unicode-aware length (ā = 1 simbols). */
  function charCount(text) {
    return Array.from(String(text || "").trim()).length;
  }

  function baseEur(kind, sizeId) {
    const table =
      kind === "custom" ? PRICING.customBaseEur : PRICING.readyBaseEur;
    if (table && typeof table[sizeId] === "number") return table[sizeId];
    return table && typeof table.M === "number" ? table.M : 0;
  }

  function formatPrice(priceEur) {
    if (priceEur == null || !Number.isFinite(priceEur)) return "—";
    return (
      priceEur.toFixed(2).replace(".", ",").replace(/,00$/, "") + " €"
    );
  }

  function priceReady({ sizeId, hardwareId } = {}) {
    const base = baseEur("ready", sizeId || "M");
    const hw = hardwareOf(hardwareId);
    const hardwareEur = Number(hw.surchargeEur) || 0;
    return {
      ok: true,
      kind: "ready",
      sizeId: sizeId || "M",
      hardwareId: hw.id,
      hardwareLabel: hw.label,
      baseEur: base,
      hardwareEur,
      longTextEur: 0,
      charCount: 0,
      unitEur: +(base + hardwareEur).toFixed(2),
    };
  }

  function priceCustom({ sizeId, hardwareId, text } = {}) {
    const base = baseEur("custom", sizeId || "M");
    const hw = hardwareOf(hardwareId);
    const hardwareEur = Number(hw.surchargeEur) || 0;
    const chars = charCount(text);
    const free = Number(PRICING.freeChars) || 10;
    const longFee = Number(PRICING.longTextSurchargeEur) || 0;
    const longTextEur = chars > free ? longFee : 0;
    return {
      ok: true,
      kind: "custom",
      sizeId: sizeId || "M",
      hardwareId: hw.id,
      hardwareLabel: hw.label,
      baseEur: base,
      hardwareEur,
      longTextEur,
      charCount: chars,
      freeChars: free,
      unitEur: +(base + hardwareEur + longTextEur).toFixed(2),
    };
  }

  function priceItem(it) {
    if (!it) return null;
    if (it.type === "ready") {
      return priceReady({ sizeId: it.sizeId, hardwareId: it.hardwareId });
    }
    return priceCustom({
      sizeId: it.sizeId,
      hardwareId: it.hardwareId,
      text: it.text,
    });
  }

  function lineTotal(it) {
    const p = priceItem(it);
    if (!p) return 0;
    const qty = Math.max(1, Number(it.qty) || 1);
    return +(p.unitEur * qty).toFixed(2);
  }

  function cartTotal(items) {
    return +((items || []).reduce((sum, it) => sum + lineTotal(it), 0)).toFixed(
      2
    );
  }

  function snapshot() {
    return {
      readyBaseEur: {
        S: Number(PRICING.readyBaseEur?.S) || 0,
        M: Number(PRICING.readyBaseEur?.M) || 0,
        L: Number(PRICING.readyBaseEur?.L) || 0,
      },
      customBaseEur: {
        S: Number(PRICING.customBaseEur?.S) || 0,
        M: Number(PRICING.customBaseEur?.M) || 0,
        L: Number(PRICING.customBaseEur?.L) || 0,
      },
      freeChars: Number(PRICING.freeChars) || 10,
      longTextSurchargeEur: Number(PRICING.longTextSurchargeEur) || 0,
      carabinerSurchargeEur: Number(HARDWARE.carabiner?.surchargeEur) || 0,
    };
  }

  function applySettings(raw) {
    if (!raw || typeof raw !== "object") return false;
    const sizes = ["S", "M", "L"];
    if (raw.readyBaseEur && typeof raw.readyBaseEur === "object") {
      PRICING.readyBaseEur = PRICING.readyBaseEur || {};
      sizes.forEach((s) => {
        const n = Number(raw.readyBaseEur[s]);
        if (Number.isFinite(n) && n >= 0) PRICING.readyBaseEur[s] = n;
      });
    }
    if (raw.customBaseEur && typeof raw.customBaseEur === "object") {
      PRICING.customBaseEur = PRICING.customBaseEur || {};
      sizes.forEach((s) => {
        const n = Number(raw.customBaseEur[s]);
        if (Number.isFinite(n) && n >= 0) PRICING.customBaseEur[s] = n;
      });
    }
    if (raw.freeChars != null) {
      const n = Math.round(Number(raw.freeChars));
      if (Number.isFinite(n) && n >= 0) PRICING.freeChars = n;
    }
    if (raw.longTextSurchargeEur != null) {
      const n = Number(raw.longTextSurchargeEur);
      if (Number.isFinite(n) && n >= 0) PRICING.longTextSurchargeEur = n;
    }
    if (raw.carabinerSurchargeEur != null && HARDWARE.carabiner) {
      const n = Number(raw.carabinerSurchargeEur);
      if (Number.isFinite(n) && n >= 0) HARDWARE.carabiner.surchargeEur = n;
    }
    if (cfg.HARDWARE?.carabiner && HARDWARE.carabiner) {
      cfg.HARDWARE.carabiner.surchargeEur = HARDWARE.carabiner.surchargeEur;
    }
    if (cfg.PRICING) {
      cfg.PRICING.readyBaseEur = { ...PRICING.readyBaseEur };
      cfg.PRICING.customBaseEur = { ...PRICING.customBaseEur };
      cfg.PRICING.freeChars = PRICING.freeChars;
      cfg.PRICING.longTextSurchargeEur = PRICING.longTextSurchargeEur;
    }
    listeners.slice().forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn("TagLabPricing listener", err);
      }
    });
    return true;
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  async function loadFromSupabase(client) {
    const c = client || window.AA3DSupabase;
    if (!c) return false;
    const { data, error } = await c
      .from("site_settings")
      .select("value")
      .eq("key", "pricing")
      .maybeSingle();
    if (error || !data?.value) return false;
    return applySettings(data.value);
  }

  async function saveToSupabase(client, settings) {
    const c = client || window.AA3DSupabase;
    if (!c) return { ok: false, error: "Nav Supabase" };
    const value = settings || snapshot();
    const { error } = await c.from("site_settings").upsert(
      {
        key: "pricing",
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) return { ok: false, error: error.message || "Kļūda" };
    applySettings(value);
    return { ok: true };
  }

  return {
    HARDWARE,
    PRICING,
    hardwareOf,
    hardwareList,
    charCount,
    formatPrice,
    priceReady,
    priceCustom,
    priceItem,
    lineTotal,
    cartTotal,
    snapshot,
    applySettings,
    onChange,
    loadFromSupabase,
    saveToSupabase,
  };
})();
