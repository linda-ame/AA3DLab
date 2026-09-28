(() => {
  const COLORS = [
    {
      id: "blue",
      label: "Zils",
      hex: "#1565c0",
      photo: "images/products/ridze-blue.jpg",
      alt: "Zils 3D drukāts piekariņš ar uzrakstu RĪDZE",
    },
    {
      id: "light-grey",
      label: "Gaiši pelēks",
      hex: "#c8ccd1",
      photo: "images/products/ridze-sizes-colors.jpg",
      alt: "Gaiši pelēks 3D drukāts piekariņš",
    },
    {
      id: "crimson",
      label: "Karmīnsarkans",
      hex: "#a01830",
      shine: true,
      photo: "images/products/ridze-copper.jpg",
      alt: "Karmīnsarkans 3D drukāts piekariņš ar spīdumu",
    },
    {
      id: "yellow",
      label: "Dzeltens",
      hex: "#e6c200",
      photo: "images/products/ridze-cluster.jpg",
      alt: "Dzeltens 3D drukāts piekariņš",
    },
  ];

  let colorId = "blue";
  let sizeId = "M";
  let sizeLabel = "M · ≈ 2,2 cm";
  let hardwareId = "ring";

  const swatchRoot = document.getElementById("colorSwatches");
  const sizeRoot = document.getElementById("sizeSeg");
  const hardwareRoot = document.getElementById("hardwareSeg");
  const note = document.getElementById("selectionNote");
  const priceEl = document.getElementById("selectionPrice");
  const productImg = document.getElementById("productImg");
  const Pricing = window.TagLabPricing;

  const ORDER_SIZES =
    (window.TagLabConfig && window.TagLabConfig.ORDER_SIZES) || {
      S: { label: "S · ≈ 1,6 cm" },
      M: { label: "M · ≈ 2,2 cm" },
      L: { label: "L · ≈ 3 cm" },
    };

  function applyColor() {
    const color = COLORS.find((c) => c.id === colorId) || COLORS[0];
    if (productImg && color.photo) {
      productImg.src = color.photo;
      productImg.alt = color.alt;
    }
    updateNote();
  }

  function updateNote() {
    const color = COLORS.find((c) => c.id === colorId);
    const hw = Pricing ? Pricing.hardwareOf(hardwareId) : null;
    const hwLabel = hw ? hw.short || hw.label : "";
    if (note && color) {
      note.textContent = `${color.label} · ${sizeLabel}${hwLabel ? " · " + hwLabel : ""}`;
    }
    if (priceEl && Pricing) {
      const p = Pricing.priceReady({ sizeId, hardwareId });
      priceEl.textContent = Pricing.formatPrice(p.unitEur);
    }
  }

  function renderSwatches() {
    if (!swatchRoot) return;
    swatchRoot.innerHTML = "";
    COLORS.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "swatch" +
        (c.shine ? " swatch--shine" : "") +
        (c.id === colorId ? " is-on" : "");
      btn.style.setProperty("--swatch", c.hex);
      btn.style.background = c.hex;
      btn.dataset.color = c.id;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", c.id === colorId ? "true" : "false");
      btn.setAttribute("aria-label", c.label);
      btn.title = c.label;
      btn.addEventListener("click", () => {
        colorId = c.id;
        [...swatchRoot.children].forEach((el) => {
          const on = el.dataset.color === colorId;
          el.classList.toggle("is-on", on);
          el.setAttribute("aria-selected", on ? "true" : "false");
        });
        applyColor();
      });
      swatchRoot.appendChild(btn);
    });
  }

  function renderSizes() {
    if (!sizeRoot) return;
    sizeRoot.innerHTML = "";
    Object.keys(ORDER_SIZES).forEach((key) => {
      const s = ORDER_SIZES[key];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "size" + (key === sizeId ? " is-on" : "");
      btn.dataset.size = key;
      btn.dataset.label = s.label;
      btn.textContent = s.label;
      btn.addEventListener("click", () => {
        sizeId = key;
        sizeLabel = s.label;
        sizeRoot.querySelectorAll(".size").forEach((el) => {
          el.classList.toggle("is-on", el === btn);
        });
        updateNote();
      });
      sizeRoot.appendChild(btn);
    });
    if (ORDER_SIZES[sizeId]) sizeLabel = ORDER_SIZES[sizeId].label;
  }

  function renderHardware() {
    if (!hardwareRoot || !Pricing) return;
    hardwareRoot.innerHTML = "";
    Pricing.hardwareList().forEach((hw) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "size" + (hw.id === hardwareId ? " is-on" : "");
      btn.dataset.hardware = hw.id;
      const fee =
        hw.surchargeEur > 0
          ? ` (+${Pricing.formatPrice(hw.surchargeEur)})`
          : "";
      btn.textContent = (hw.short || hw.label) + fee;
      btn.addEventListener("click", () => {
        hardwareId = hw.id;
        hardwareRoot.querySelectorAll(".size").forEach((el) => {
          el.classList.toggle("is-on", el === btn);
        });
        updateNote();
      });
      hardwareRoot.appendChild(btn);
    });
  }

  const revealEls = document.querySelectorAll(".step");
  if (revealEls.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 6) * 0.06}s`;
      io.observe(el);
    });
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  function initCarousel(root) {
    const main = root.querySelector("[data-carousel-main]");
    const thumbs = [...root.querySelectorAll(".carousel-thumb")];
    const prev = root.querySelector("[data-carousel-prev]");
    const next = root.querySelector("[data-carousel-next]");
    const countEl = root.querySelector("[data-carousel-count]");
    if (!main || !thumbs.length) return;

    let index = Math.max(
      0,
      thumbs.findIndex((t) => t.classList.contains("is-on"))
    );

    function updateCount() {
      if (!countEl) return;
      countEl.textContent = index + 1 + " / " + thumbs.length;
    }

    function show(i) {
      index = ((i % thumbs.length) + thumbs.length) % thumbs.length;
      const thumb = thumbs[index];
      main.classList.add("is-fading");
      window.setTimeout(() => {
        main.src = thumb.dataset.src;
        main.alt = thumb.dataset.alt || "";
        main.classList.remove("is-fading");
      }, 140);

      thumbs.forEach((t, ti) => {
        const on = ti === index;
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });

      updateCount();

      thumb.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
        block: "nearest",
      });
    }

    thumbs.forEach((thumb, i) => {
      thumb.addEventListener("click", () => show(i));
    });
    if (prev) prev.addEventListener("click", () => show(index - 1));
    if (next) next.addEventListener("click", () => show(index + 1));

    root.tabIndex = 0;
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        show(index - 1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        show(index + 1);
      }
    });

    updateCount();
  }

  document.querySelectorAll("[data-carousel]").forEach(initCarousel);

  const addReadyBtn = document.getElementById("addReadyBtn");
  if (addReadyBtn && window.AA3DCart) {
    addReadyBtn.addEventListener("click", () => {
      const color = COLORS.find((c) => c.id === colorId) || COLORS[0];
      const hw = Pricing
        ? Pricing.hardwareOf(hardwareId)
        : { id: hardwareId, label: "Standarta riņķītis" };
      window.AA3DCart.addReady({
        colorId: color.id,
        colorLabel: color.label,
        sizeId,
        sizeLabel,
        hardwareId: hw.id,
        hardwareLabel: hw.label,
      });
      window.location.href = "pasutit.html";
    });
  }

  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    const status = document.getElementById("contactStatus");
    const nameIn = document.getElementById("contactName");
    const emailIn = document.getElementById("contactEmail");
    const messageIn = document.getElementById("contactMessage");
    const submitBtn = contactForm.querySelector('button[type="submit"]');

    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (nameIn) nameIn.value = nameIn.value.trim();
      if (emailIn) emailIn.value = emailIn.value.trim();
      if (messageIn) messageIn.value = messageIn.value.trim();

      if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        if (status) {
          status.textContent = "Lūdzu, aizpildi vārdu, e-pastu un ziņu.";
          status.classList.add("is-error");
        }
        return;
      }

      const name = nameIn.value;
      const email = emailIn.value;
      const message = messageIn.value;

      const client = window.AA3DSupabase;
      if (!client) {
        if (status) {
          status.textContent = "Saziņa īslaicīgi nav pieejama. Raksti uz armands@pd.lv";
          status.classList.add("is-error");
        }
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      if (status) {
        status.textContent = "Sūta…";
        status.classList.remove("is-error");
      }

      const { error } = await client.from("messages").insert({
        name,
        email,
        message,
        status: "new",
      });

      if (submitBtn) submitBtn.disabled = false;

      if (error) {
        console.error(error);
        if (status) {
          status.textContent =
            "Neizdevās nosūtīt. Raksti uz armands@pd.lv vai mēģini vēlreiz.";
          status.classList.add("is-error");
        }
        return;
      }

      contactForm.reset();
      if (status) {
        status.textContent = "Paldies! Ziņa saņemta — atbildēsim uz e-pastu.";
        status.classList.remove("is-error");
      }
    });
  }

  renderSwatches();
  renderSizes();
  renderHardware();
  applyColor();

  if (Pricing) {
    Pricing.onChange(() => {
      renderHardware();
      updateNote();
    });
    Pricing.loadFromSupabase().then((ok) => {
      if (ok) {
        renderHardware();
        updateNote();
      }
    });
  }
})();
