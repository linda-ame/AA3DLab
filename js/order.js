(() => {
  const Cart = window.AA3DCart;
  const Pricing = window.TagLabPricing;

  const listEl = document.getElementById("orderLines");
  const emptyEl = document.getElementById("orderEmpty");
  const formEl = document.getElementById("orderForm");
  const totalEl = document.getElementById("orderTotal");
  const submitBtn = document.getElementById("submitOrder");
  const statusEl = document.getElementById("orderStatus");
  const successEl = document.getElementById("orderSuccess");
  const successSummaryEl = document.getElementById("orderSuccessSummary");
  const successNumberEl = document.getElementById("orderSuccessNumber");
  const headEl = document.getElementById("orderHead");

  const nameIn = document.getElementById("contactName");
  const emailIn = document.getElementById("contactEmail");
  const phoneIn = document.getElementById("contactPhone");
  const schoolClassIn = document.getElementById("contactSchoolClass");
  const noteIn = document.getElementById("contactNote");
  const payCash = document.getElementById("payCash");
  const payTransfer = document.getElementById("payTransfer");
  const payHint = document.getElementById("payTransferHint");

  let successShown = false;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function lineDetail(it, priced) {
    const hwLabel =
      it.hardwareLabel || (priced && priced.hardwareLabel) || "";
    if (it.type === "ready") {
      return `${it.colorLabel} · ${it.sizeId}${hwLabel ? " · " + hwLabel : ""}`;
    }
    return `“${it.text || "—"}” · ${it.fontLabel} · ${it.colorLabel} · ${it.sizeLabel || it.sizeId || ""}${it.lengthLabel ? " · garums " + it.lengthLabel : ""} · stiprinājums ${it.holeLabel || ""}${hwLabel ? " · " + hwLabel : ""}`;
  }

  function itemsForDb(items) {
    return items.map((it) => {
      const priced = Pricing ? Pricing.priceItem(it) : null;
      if (it.type === "ready") {
        return {
          type: "ready",
          qty: Number(it.qty) || 1,
          colorId: it.colorId,
          colorLabel: it.colorLabel,
          sizeId: it.sizeId,
          sizeLabel: it.sizeLabel || it.sizeId,
          hardwareId: it.hardwareId || "ring",
          hardwareLabel: it.hardwareLabel || (priced && priced.hardwareLabel) || "",
          unitPriceEur: priced ? priced.unitEur : it.unitPriceEur ?? null,
          lineTotalEur: priced
            ? Pricing.lineTotal(it)
            : it.unitPriceEur != null
              ? +(it.unitPriceEur * (Number(it.qty) || 1)).toFixed(2)
              : null,
        };
      }
      return {
        type: "custom",
        qty: Number(it.qty) || 1,
        text: it.text,
        fontId: it.fontId,
        fontLabel: it.fontLabel,
        colorId: it.colorId,
        colorLabel: it.colorLabel,
        colorHex: it.colorHex,
        sizeId: it.sizeId,
        sizeLabel: it.sizeLabel,
        lengthMm: it.lengthMm || null,
        lengthLabel: it.lengthLabel || "",
        holeSide: it.holeSide,
        holeLabel: it.holeLabel,
        hardwareId: it.hardwareId || "ring",
        hardwareLabel: it.hardwareLabel || (priced && priced.hardwareLabel) || "",
        charCount: priced ? priced.charCount : it.charCount ?? null,
        unitPriceEur: priced ? priced.unitEur : it.unitPriceEur ?? null,
        lineTotalEur: priced
          ? Pricing.lineTotal(it)
          : it.unitPriceEur != null
            ? +(it.unitPriceEur * (Number(it.qty) || 1)).toFixed(2)
            : null,
        // Prefer PNG for DB/admin (reliable display); keep SVG only as fallback
        previewPng: it.previewPng || "",
        previewSvg: it.previewPng ? "" : it.previewSvg || "",
      };
    });
  }

  function showSuccess(snapshot, orderNumber) {
    successShown = true;
    if (headEl) headEl.hidden = true;
    if (emptyEl) emptyEl.hidden = true;
    if (formEl) formEl.hidden = true;
    if (successEl) successEl.hidden = false;

    if (successNumberEl) {
      if (orderNumber != null && orderNumber !== "") {
        successNumberEl.hidden = false;
        successNumberEl.textContent = "Pasūtījuma nr. " + orderNumber;
      } else {
        successNumberEl.hidden = true;
        successNumberEl.textContent = "";
      }
    }

    if (successSummaryEl) {
      const items = snapshot.items || [];
      const contact = snapshot.contact || {};
      successSummaryEl.replaceChildren();

      const heading = document.createElement("h3");
      heading.textContent = "Pasūtījuma kopsavilkums";
      successSummaryEl.appendChild(heading);

      const ul = document.createElement("ul");
      ul.className = "order-success-lines";
      items.forEach((it) => {
        const priced = Pricing ? Pricing.priceItem(it) : null;
        const title =
          it.type === "ready" ? "Gatavais modelis" : "Individuālais dizains";
        const qty = Number(it.qty) || 1;
        const li = document.createElement("li");
        const left = document.createElement("span");
        const strong = document.createElement("strong");
        strong.textContent = title;
        left.appendChild(strong);
        left.appendChild(document.createElement("br"));
        const muted = document.createElement("span");
        muted.className = "muted";
        muted.textContent = `${lineDetail(it, priced)} · ${qty} gab.`;
        left.appendChild(muted);
        li.appendChild(left);
        if (priced && Pricing) {
          const right = document.createElement("span");
          right.textContent = Pricing.formatPrice(Pricing.lineTotal(it));
          li.appendChild(right);
        }
        ul.appendChild(li);
      });
      successSummaryEl.appendChild(ul);

      if (Pricing && items.length) {
        const total = document.createElement("p");
        total.className = "order-success-total";
        total.textContent =
          "Kopā: " + Pricing.formatPrice(Pricing.cartTotal(items));
        successSummaryEl.appendChild(total);
      }

      const contactEl = document.createElement("p");
      contactEl.className = "order-success-contact";
      const payLabel =
        contact.payment === "transfer"
          ? "Pārskaitījums"
          : "Skaidrā pie saņemšanas";
      const bits = [contact.name, contact.phone].filter(Boolean).join(" · ");
      contactEl.appendChild(document.createTextNode(bits));
      if (contact.email) {
        contactEl.appendChild(document.createElement("br"));
        contactEl.appendChild(document.createTextNode(contact.email));
      }
      contactEl.appendChild(document.createElement("br"));
      contactEl.appendChild(document.createTextNode("Maksājums: " + payLabel));
      successSummaryEl.appendChild(contactEl);
    }

    if (successEl) {
      successEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function render() {
    if (successShown) return;

    const data = Cart.load();
    const items = data.items;

    if (successEl) successEl.hidden = true;
    if (headEl) headEl.hidden = false;

    if (nameIn) nameIn.value = data.contact.name;
    if (emailIn) emailIn.value = data.contact.email;
    if (phoneIn) phoneIn.value = data.contact.phone;
    if (schoolClassIn) schoolClassIn.value = data.contact.schoolClass;
    if (noteIn) noteIn.value = data.contact.note;
    const pay = data.contact.payment === "transfer" ? "transfer" : "cash";
    if (payCash) payCash.checked = pay === "cash";
    if (payTransfer) payTransfer.checked = pay === "transfer";
    syncPayHint();

    if (!items.length) {
      if (emptyEl) emptyEl.hidden = false;
      if (listEl) listEl.innerHTML = "";
      if (formEl) formEl.hidden = true;
      if (totalEl) {
        totalEl.hidden = true;
        totalEl.textContent = "";
      }
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (formEl) formEl.hidden = false;

    listEl.innerHTML = "";
    items.forEach((it) => {
      const article = document.createElement("article");
      article.className = "order-line";
      article.dataset.id = it.id;

      const priced = Pricing ? Pricing.priceItem(it) : null;
      const title =
        it.type === "ready" ? "Gatavais modelis" : "Individuālais dizains";
      const detail = lineDetail(it, priced);

      const main = document.createElement("div");
      main.className = "order-line-main";
      main.innerHTML = `<h3></h3><p></p>`;
      main.querySelector("h3").textContent = title;
      main.querySelector("p").textContent = detail;

      if (it.type === "custom" && (it.previewPng || it.previewSvg)) {
        const wrap = document.createElement("div");
        wrap.className = "order-line-preview";
        wrap.setAttribute("aria-hidden", "true");
        if (it.previewPng) {
          const img = document.createElement("img");
          img.src = it.previewPng;
          img.alt = "";
          wrap.appendChild(img);
        } else {
          wrap.innerHTML = it.previewSvg;
          const svg = wrap.querySelector("svg");
          if (svg) {
            svg.removeAttribute("id");
            svg.querySelectorAll("[id]").forEach((el) =>
              el.removeAttribute("id")
            );
          }
        }
        main.appendChild(wrap);
      }

      const side = document.createElement("div");
      side.className = "order-line-side";
      const unit =
        priced && Pricing
          ? Pricing.formatPrice(priced.unitEur)
          : it.unitPriceEur != null
            ? String(it.unitPriceEur).replace(".", ",") + " €"
            : "";
      const line =
        priced && Pricing
          ? Pricing.formatPrice(Pricing.lineTotal(it))
          : "";
      side.innerHTML = `
        ${unit ? `<p class="order-line-price">${unit}${line && Number(it.qty) > 1 ? " · rinda " + line : ""}</p>` : ""}
        <label class="qty-label">
          <span>Daudzums</span>
          <input type="number" min="1" max="99" value="${Number(it.qty) || 1}" data-qty="${it.id}" />
        </label>
        <button type="button" class="order-remove" data-remove="${it.id}">Noņemt</button>
      `;

      article.appendChild(main);
      article.appendChild(side);
      listEl.appendChild(article);
    });

    if (totalEl && Pricing) {
      totalEl.hidden = false;
      totalEl.textContent =
        "Kopā: " + Pricing.formatPrice(Pricing.cartTotal(items));
    }
  }

  function selectedPayment() {
    if (payTransfer && payTransfer.checked) return "transfer";
    return "cash";
  }

  function syncPayHint() {
    if (!payHint) return;
    payHint.hidden = selectedPayment() !== "transfer";
  }

  function persistContact() {
    Cart.setContact({
      name: nameIn.value.trim(),
      email: emailIn.value.trim(),
      phone: phoneIn.value.trim(),
      schoolClass: schoolClassIn ? schoolClassIn.value.trim() : "",
      payment: selectedPayment(),
      note: noteIn.value.trim(),
    });
  }

  function refreshTotals() {
    if (!Pricing || !totalEl) return;
    const items = Cart.load().items;
    if (!items.length) {
      totalEl.hidden = true;
      totalEl.textContent = "";
      return;
    }
    totalEl.hidden = false;
    totalEl.textContent =
      "Kopā: " + Pricing.formatPrice(Pricing.cartTotal(items));
    listEl.querySelectorAll(".order-line").forEach((article) => {
      const id = article.dataset.id;
      const it = items.find((x) => x.id === id);
      const priceEl = article.querySelector(".order-line-price");
      if (!it || !priceEl) return;
      const priced = Pricing.priceItem(it);
      if (!priced) return;
      const unit = Pricing.formatPrice(priced.unitEur);
      const line = Pricing.formatPrice(Pricing.lineTotal(it));
      priceEl.textContent =
        unit + (Number(it.qty) > 1 ? " · rinda " + line : "");
    });
  }

  listEl.addEventListener("input", (e) => {
    const input = e.target.closest("[data-qty]");
    if (!input) return;
    Cart.updateQty(input.getAttribute("data-qty"), input.value);
    Cart.syncBadges();
    refreshTotals();
  });

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    Cart.remove(btn.getAttribute("data-remove"));
    render();
  });

  ["input", "change"].forEach((ev) => {
    [nameIn, emailIn, phoneIn, schoolClassIn, noteIn].forEach((el) => {
      if (el) el.addEventListener(ev, persistContact);
    });
  });

  [payCash, payTransfer].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", () => {
      syncPayHint();
      persistContact();
    });
  });

  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (nameIn) nameIn.value = nameIn.value.trim();
    if (phoneIn) phoneIn.value = phoneIn.value.trim();
    if (emailIn) emailIn.value = emailIn.value.trim();

    persistContact();
    const data = Cart.load();
    if (!data.items.length) {
      setStatus("Pasūtījums ir tukšs.", true);
      return;
    }
    if (!formEl.checkValidity() || !data.contact.name || !data.contact.phone) {
      formEl.reportValidity();
      setStatus("Ievadi vārdu, uzvārdu un tālruni.", true);
      return;
    }

    const sb = window.AA3DSupabase;
    if (!sb) {
      setStatus(
        "Supabase nav konfigurēts — ielīmē anon atslēgu js/supabase-config.js.",
        true
      );
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sūta…";
    }
    setStatus("Nosūta pasūtījumu…");

    const dbItems = itemsForDb(data.items);
    const missingPreview = dbItems.some(
      (it) => it.type === "custom" && !it.previewPng && !it.previewSvg
    );
    if (missingPreview) {
      console.warn("Custom item without preview image");
    }

    const snapshot = {
      items: data.items.slice(),
      contact: { ...data.contact },
    };

    const { data: placed, error } = await sb.rpc("place_order", {
      p_name: data.contact.name,
      p_email: data.contact.email || "",
      p_phone: data.contact.phone,
      p_school_class: data.contact.schoolClass || "",
      p_payment_method: data.contact.payment || "cash",
      p_note: data.contact.note || "",
      p_items: dbItems,
    });

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "PASŪTĪT";
    }

    if (error) {
      console.error(error);
      setStatus("Neizdevās nosūtīt: " + (error.message || "kļūda"), true);
      return;
    }

    const orderNumber =
      placed && typeof placed === "object" ? placed.order_number : null;

    Cart.clear();
    showSuccess(snapshot, orderNumber);
  });

  const clearBtn = document.getElementById("clearOrder");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      Cart.clear();
      render();
      setStatus("Pasūtījums notīrīts.");
    });
  }

  (async () => {
    if (Pricing) {
      await Pricing.loadFromSupabase();
      Pricing.onChange(() => render());
    }
    render();
  })();
})();
