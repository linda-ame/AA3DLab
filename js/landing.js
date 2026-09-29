(() => {
  const COLORS = [
    {
      id: "blue",
      label: "Zils",
      hex: "#1565c0",
      photos: [
        {
          src: "images/products/ridze-blue.jpg",
          alt: "Zils 3D drukāts piekariņš ar uzrakstu RĪDZE",
        },
        {
          src: "images/products/ridze-blue-sizes.jpg",
          alt: "Zili RĪDZE piekariņi trīs izmēros",
        },
        {
          src: "images/products/ridze-four-colors.jpg",
          alt: "RĪDZE piekariņi četrās krāsās, zils starp tiem",
        },
      ],
    },
    {
      id: "light-grey",
      label: "Gaiši pelēks",
      hex: "#c8ccd1",
      photos: [
        {
          src: "images/products/ridze-grey.jpg",
          alt: "Gaiši pelēks 3D drukāts piekariņš ar uzrakstu RĪDZE",
        },
        {
          src: "images/products/ridze-grey-stack.jpg",
          alt: "Trīs gaiši pelēki RĪDZE piekariņi",
        },
        {
          src: "images/products/ridze-four-colors.jpg",
          alt: "RĪDZE piekariņi četrās krāsās, pelēks starp tiem",
        },
      ],
    },
    {
      id: "crimson",
      label: "Karmīnsarkans",
      hex: "#a01830",
      shine: true,
      photos: [
        {
          src: "images/products/ridze-copper.jpg",
          alt: "Karmīnsarkans 3D drukāts piekariņš ar spīdumu",
        },
        {
          src: "images/products/ridze-crimson-stack.jpg",
          alt: "Karmīnsarkani RĪDZE piekariņi ar spīdumu",
        },
        {
          src: "images/products/ridze-four-colors.jpg",
          alt: "RĪDZE piekariņi četrās krāsās, karmīnsarkans starp tiem",
        },
      ],
    },
    {
      id: "yellow",
      label: "Dzeltens",
      hex: "#e6c200",
      photos: [
        {
          src: "images/products/ridze-yellow.jpg",
          alt: "Dzeltens 3D drukāts piekariņš ar uzrakstu RĪDZE",
        },
        {
          src: "images/products/ridze-yellow-sizes.jpg",
          alt: "Dzelteni RĪDZE piekariņi trīs izmēros",
        },
        {
          src: "images/products/ridze-four-colors.jpg",
          alt: "RĪDZE piekariņi četrās krāsās, dzeltens starp tiem",
        },
      ],
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
  const productCarouselRoot = document.querySelector("[data-product-carousel]");
  const Pricing = window.TagLabPricing;
  let productCarouselApi = null;

  const ORDER_SIZES =
    (window.TagLabConfig && window.TagLabConfig.ORDER_SIZES) || {
      S: { label: "S · ≈ 1,6 cm" },
      M: { label: "M · ≈ 2,2 cm" },
      L: { label: "L · ≈ 3 cm" },
    };

  function colorPhotos(color) {
    if (!color) return [];
    if (Array.isArray(color.photos) && color.photos.length) return color.photos;
    if (color.photo) return [{ src: color.photo, alt: color.alt || "" }];
    return [];
  }

  function applyColor() {
    const color = COLORS.find((c) => c.id === colorId) || COLORS[0];
    if (productCarouselApi) {
      productCarouselApi.setSlides(colorPhotos(color));
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

  function initCarousel(root, options) {
    const opts = options || {};
    const main = root.querySelector("[data-carousel-main]");
    const thumbsRoot = root.querySelector("[data-carousel-thumbs]");
    const prev = root.querySelector("[data-carousel-prev]");
    const next = root.querySelector("[data-carousel-next]");
    const countEl = root.querySelector("[data-carousel-count]");
    if (!main) return null;

    let thumbs = [...root.querySelectorAll(".carousel-thumb")];
    let index = Math.max(
      0,
      thumbs.findIndex((t) => t.classList.contains("is-on"))
    );
    if (index < 0) index = 0;

    function updateCount() {
      if (!countEl) return;
      const n = Math.max(thumbs.length, 1);
      countEl.textContent = index + 1 + " / " + n;
    }

    function show(i) {
      if (!thumbs.length) return;
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

    function bindThumbs() {
      thumbs.forEach((thumb, i) => {
        thumb.addEventListener("click", () => show(i));
      });
    }

    function setSlides(slides) {
      const list = Array.isArray(slides) ? slides.filter((s) => s && s.src) : [];
      if (!thumbsRoot || !list.length) return;
      thumbsRoot.innerHTML = "";
      list.forEach((slide, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "carousel-thumb" + (i === 0 ? " is-on" : "");
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
        btn.dataset.src = slide.src;
        btn.dataset.alt = slide.alt || "";
        const img = document.createElement("img");
        img.src = slide.src;
        img.alt = "";
        img.width = 160;
        img.height = 120;
        img.loading = "lazy";
        btn.appendChild(img);
        thumbsRoot.appendChild(btn);
      });
      thumbs = [...thumbsRoot.querySelectorAll(".carousel-thumb")];
      bindThumbs();
      index = 0;
      main.src = list[0].src;
      main.alt = list[0].alt || "";
      main.classList.remove("is-fading");
      updateCount();
    }

    bindThumbs();
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

    if (opts.slides) setSlides(opts.slides);
    else updateCount();

    return { show, setSlides };
  }

  document.querySelectorAll("[data-carousel]").forEach((root) => {
    initCarousel(root);
  });

  if (productCarouselRoot) {
    productCarouselApi = initCarousel(productCarouselRoot);
  }

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
