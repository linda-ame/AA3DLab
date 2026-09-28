(() => {
  const Cart = window.AA3DCart;

  const listEl = document.getElementById("orderLines");
  const emptyEl = document.getElementById("orderEmpty");
  const formEl = document.getElementById("orderForm");
  const submitBtn = document.getElementById("submitOrder");
  const statusEl = document.getElementById("orderStatus");

  const nameIn = document.getElementById("contactName");
  const emailIn = document.getElementById("contactEmail");
  const phoneIn = document.getElementById("contactPhone");
  const schoolClassIn = document.getElementById("contactSchoolClass");
  const noteIn = document.getElementById("contactNote");
  const payCash = document.getElementById("payCash");
  const payTransfer = document.getElementById("payTransfer");
  const payHint = document.getElementById("payTransferHint");

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function itemsForDb(items) {
    return items.map((it) => {
      if (it.type === "ready") {
        return {
          type: "ready",
          qty: Number(it.qty) || 1,
          colorId: it.colorId,
          colorLabel: it.colorLabel,
          sizeId: it.sizeId,
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
        // Prefer PNG for DB/admin (reliable display); keep SVG only as fallback
        previewPng: it.previewPng || "",
        previewSvg: it.previewPng ? "" : it.previewSvg || "",
      };
    });
  }

  function render() {
    const data = Cart.load();
    const items = data.items;

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
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (formEl) formEl.hidden = false;

    listEl.innerHTML = "";
    items.forEach((it) => {
      const article = document.createElement("article");
      article.className = "order-line";
      article.dataset.id = it.id;

      const title =
        it.type === "ready" ? "Gatavais modelis" : "Individuālais dizains";
      const detail =
        it.type === "ready"
          ? `${it.colorLabel} · ${it.sizeId}`
          : `“${it.text || "—"}” · ${it.fontLabel} · ${it.colorLabel} · ${it.sizeLabel || it.sizeId || ""}${it.lengthLabel ? " · garums " + it.lengthLabel : ""} · stiprinājums ${it.holeLabel || ""}`;

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
      side.innerHTML = `
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

  listEl.addEventListener("input", (e) => {
    const input = e.target.closest("[data-qty]");
    if (!input) return;
    Cart.updateQty(input.getAttribute("data-qty"), input.value);
    Cart.syncBadges();
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

    const { error } = await sb.from("orders").insert({
      name: data.contact.name,
      email: data.contact.email || null,
      phone: data.contact.phone,
      school_class: data.contact.schoolClass || null,
      payment_method: data.contact.payment || "cash",
      note: data.contact.note || null,
      items: dbItems,
      status: "new",
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

    Cart.clear();
    render();
    setStatus("Paldies! Pasūtījums saņemts. Sazināsimies pa tālruni.");
  });

  const clearBtn = document.getElementById("clearOrder");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      Cart.clear();
      render();
      setStatus("Pasūtījums notīrīts.");
    });
  }

  render();
})();
