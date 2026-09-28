window.AA3DCart = (() => {
  const KEY = "aa3dlab-order-v1";

  function empty() {
    return {
      items: [],
      contact: {
        name: "",
        email: "",
        phone: "",
        schoolClass: "",
        payment: "cash",
        note: "",
      },
    };
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return empty();
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.items)) return empty();
      return {
        items: data.items,
        contact: {
          name: (data.contact && data.contact.name) || "",
          email: (data.contact && data.contact.email) || "",
          phone: (data.contact && data.contact.phone) || "",
          schoolClass: (data.contact && data.contact.schoolClass) || "",
          payment:
            data.contact && data.contact.payment === "transfer"
              ? "transfer"
              : "cash",
          note: (data.contact && data.contact.note) || "",
        },
      };
    } catch {
      return empty();
    }
  }

  function save(data) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      console.error("Cart save failed", err);
      // Retry without heavy SVG if storage is full — keep PNG if smaller, else drop both
      const slim = {
        ...data,
        items: (data.items || []).map((it) => {
          if (it.type !== "custom") return it;
          const next = { ...it };
          if (next.previewPng && next.previewPng.length > 180000) {
            delete next.previewSvg;
          } else if (next.previewSvg && next.previewSvg.length > 120000) {
            delete next.previewSvg;
          }
          return next;
        }),
      };
      sessionStorage.setItem(KEY, JSON.stringify(slim));
    }
    syncBadges();
  }

  function uid() {
    return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function count() {
    return load().items.reduce((n, it) => n + (Number(it.qty) || 1), 0);
  }

  function lineCount() {
    return load().items.length;
  }

  function addReady({ colorId, colorLabel, sizeId, sizeLabel }) {
    const data = load();
    const existing = data.items.find(
      (it) =>
        it.type === "ready" &&
        it.colorId === colorId &&
        it.sizeId === sizeId
    );
    if (existing) {
      existing.qty = (Number(existing.qty) || 1) + 1;
      if (sizeLabel) existing.sizeLabel = sizeLabel;
    } else {
      data.items.push({
        id: uid(),
        type: "ready",
        qty: 1,
        colorId,
        colorLabel,
        sizeId,
        sizeLabel: sizeLabel || sizeId,
      });
    }
    save(data);
    return data;
  }

  function addCustom(item) {
    const data = load();
    data.items.push({
      id: uid(),
      type: "custom",
      qty: 1,
      text: item.text || "",
      fontId: item.fontId || "",
      fontLabel: item.fontLabel || "",
      colorId: item.colorId || "",
      colorLabel: item.colorLabel || "",
      colorHex: item.colorHex || "",
      sizeId: item.sizeId || "",
      sizeLabel: item.sizeLabel || "",
      holeSide: item.holeSide || "start",
      holeLabel: item.holeLabel || "",
      lengthMm: item.lengthMm || null,
      lengthLabel: item.lengthLabel || "",
      previewSvg: item.previewSvg || "",
      previewPng: item.previewPng || "",
    });
    save(data);
    return data;
  }

  function updateQty(id, qty) {
    const data = load();
    const item = data.items.find((it) => it.id === id);
    if (!item) return data;
    const n = Math.max(1, Math.min(99, Number(qty) || 1));
    item.qty = n;
    save(data);
    return data;
  }

  function remove(id) {
    const data = load();
    data.items = data.items.filter((it) => it.id !== id);
    save(data);
    return data;
  }

  function setContact(contact) {
    const data = load();
    data.contact = {
      name: contact.name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      schoolClass: contact.schoolClass || "",
      payment: contact.payment === "transfer" ? "transfer" : "cash",
      note: contact.note || "",
    };
    save(data);
    return data;
  }

  function clear() {
    sessionStorage.removeItem(KEY);
    syncBadges();
  }

  function itemSummary(it) {
    if (it.type === "ready") {
      return `Gatavais · ${it.colorLabel} · burta augstums ${it.sizeLabel || it.sizeId}`;
    }
    return `Individuāls · “${it.text || "—"}” · ${it.fontLabel} · ${it.colorLabel} · ${it.sizeLabel || it.sizeId || ""}${it.lengthLabel ? " · " + it.lengthLabel : ""}`;
  }

  function orderText() {
    const data = load();
    const lines = ["Sveiki! Vēlos pasūtīt piekariņus.", "", "=== Pasūtījums ==="];
    data.items.forEach((it, i) => {
      lines.push("");
      lines.push(`${i + 1}. ${itemSummary(it)} × ${it.qty}`);
      if (it.type === "custom") {
        lines.push(`   Stiprinājums: ${it.holeLabel || it.holeSide}`);
        if (it.sizeLabel || it.sizeId) {
          lines.push(`   Izmērs: ${it.sizeLabel || it.sizeId}`);
        }
        if (it.lengthLabel) {
          lines.push(`   Aptuvenais garums: ${it.lengthLabel}`);
        }
        if (it.colorHex) lines.push(`   Krāsas kods: ${it.colorHex}`);
      }
    });
    lines.push("");
    lines.push("=== Kontakti ===");
    if (data.contact.name) lines.push(`Vārds, uzvārds: ${data.contact.name}`);
    if (data.contact.phone) lines.push(`Tālrunis: ${data.contact.phone}`);
    if (data.contact.email) lines.push(`E-pasts: ${data.contact.email}`);
    if (data.contact.schoolClass) {
      lines.push(`Klase (Pamatskola Rīdze): ${data.contact.schoolClass}`);
    }
    lines.push(
      `Maksājums: ${
        data.contact.payment === "transfer"
          ? "pārskaitījums"
          : "skaidrā pie saņemšanas"
      }`
    );
    if (data.contact.note) lines.push(`Piezīme: ${data.contact.note}`);
    return lines.join("\n");
  }

  function syncBadges() {
    const n = count();
    document.querySelectorAll("[data-cart-badge]").forEach((el) => {
      const label = el.querySelector("[data-cart-label]");
      const num = el.querySelector("[data-cart-num]");
      if (num) num.textContent = String(n);
      el.hidden = n === 0;
      el.setAttribute("aria-hidden", n === 0 ? "true" : "false");
      if (label) {
        label.textContent = n === 0 ? "Pasūtījums" : `Pasūtījums (${n})`;
      }
      el.classList.toggle("has-items", n > 0);
    });
    document.querySelectorAll("[data-cart-empty-cta]").forEach((el) => {
      el.hidden = n > 0;
      el.setAttribute("aria-hidden", n > 0 ? "true" : "false");
    });
    document.querySelectorAll("[data-cart-link]").forEach((el) => {
      if (n > 0) {
        el.setAttribute("href", "pasutit.html");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncBadges);
  } else {
    syncBadges();
  }
  window.addEventListener("pageshow", syncBadges);

  return {
    load,
    save,
    count,
    lineCount,
    addReady,
    addCustom,
    updateQty,
    remove,
    setContact,
    clear,
    itemSummary,
    orderText,
    syncBadges,
  };
})();
