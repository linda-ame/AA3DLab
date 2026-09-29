(() => {
  const sb = () => window.AA3DSupabase;

  const loginPanel = document.getElementById("loginPanel");
  const dashPanel = document.getElementById("dashPanel");
  const loginForm = document.getElementById("loginForm");
  const loginStatus = document.getElementById("loginStatus");
  const dashStatus = document.getElementById("dashStatus");
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const adminWho = document.getElementById("adminWho");
  const ordersList = document.getElementById("ordersList");
  const messagesList = document.getElementById("messagesList");
  const ordersEmpty = document.getElementById("ordersEmpty");
  const messagesEmpty = document.getElementById("messagesEmpty");
  const pricingForm = document.getElementById("pricingForm");
  const pricingStatus = document.getElementById("pricingStatus");
  const pricingSaveBtn = document.getElementById("pricingSaveBtn");
  const notifyWrap = document.getElementById("notifyWrap");
  const notifyBtn = document.getElementById("notifyBtn");
  const notifyPanel = document.getElementById("notifyPanel");
  const notifyDot = document.getElementById("notifyDot");
  const notifyEnableBtn = document.getElementById("notifyEnableBtn");
  const notifyOrders = document.getElementById("notifyOrders");
  const notifyMessages = document.getElementById("notifyMessages");
  const notifyPermHint = document.getElementById("notifyPermHint");
  const notifyStatus = document.getElementById("notifyStatus");

  let orders = [];
  let messages = [];
  let openId = { messages: null, orders: null };
  let filter = { messages: "all", orders: "all" };
  let pollTimer = null;
  let realtimeChannel = null;
  let loadBusy = false;
  let currentUserId = null;
  let myMessageReads = new Set();
  let myOrderViews = new Set();
  let pricingLoaded = false;
  let knownOrderIds = null;
  let knownMessageIds = null;
  let pendingNotifyCount = 0;
  let pushSubscribed = false;

  const NOTIFY_KEY = "aa3dlab-admin-notify";

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function getExistingPushSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    const reg = await ensureServiceWorker();
    return reg ? reg.pushManager.getSubscription() : null;
  }

  async function savePushSubscription(sub) {
    const client = sb();
    if (!client || !currentUserId || !sub) return false;
    const json = sub.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys && json.keys.p256dh;
    const auth = json.keys && json.keys.auth;
    if (!endpoint || !p256dh || !auth) return false;
    const { error } = await client.from("push_subscriptions").upsert(
      {
        user_id: currentUserId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent.slice(0, 240),
      },
      { onConflict: "endpoint" }
    );
    if (error) {
      console.error(error);
      setNotifyStatus(
        "Neizdevās saglabāt push: " + (error.message || "kļūda") +
          " (palaid push-subscriptions.sql?)",
        true
      );
      return false;
    }
    return true;
  }

  async function removePushSubscription(sub) {
    const client = sb();
    if (client && sub) {
      await client
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", sub.endpoint);
    }
    if (sub) await sub.unsubscribe();
  }

  async function enableWebPush() {
    if (!("Notification" in window) || !("PushManager" in window)) {
      throw new Error("Šis pārlūks neatbalsta Web Push.");
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      throw new Error(
        perm === "denied"
          ? "Atļauja liegta pārlūkā."
          : "Atļauja nav dota."
      );
    }
    const vapid =
      window.AA3DPushConfig && window.AA3DPushConfig.vapidPublicKey;
    if (!vapid) throw new Error("Trūkst VAPID public key.");

    const reg = await ensureServiceWorker();
    if (!reg) throw new Error("Service worker nav pieejams.");

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    }
    const ok = await savePushSubscription(sub);
    if (!ok) throw new Error("Neizdevās saglabāt abonementu.");
    pushSubscribed = true;
    return sub;
  }

  async function refreshPushState() {
    try {
      const sub = await getExistingPushSubscription();
      pushSubscribed = Boolean(sub);
      if (sub && currentUserId) await savePushSubscription(sub);
    } catch (err) {
      console.warn(err);
      pushSubscribed = false;
    }
    syncNotifyUi();
  }

  function loadNotifyPrefs() {
    try {
      const raw = localStorage.getItem(NOTIFY_KEY);
      if (!raw) return { orders: true, messages: true };
      const parsed = JSON.parse(raw);
      return {
        orders: parsed.orders !== false,
        messages: parsed.messages !== false,
      };
    } catch {
      return { orders: true, messages: true };
    }
  }

  function saveNotifyPrefs(prefs) {
    localStorage.setItem(NOTIFY_KEY, JSON.stringify(prefs));
  }

  function getNotifyPrefs() {
    return {
      orders: notifyOrders ? notifyOrders.checked : true,
      messages: notifyMessages ? notifyMessages.checked : true,
    };
  }

  function setNotifyStatus(msg, isError) {
    if (!notifyStatus) return;
    notifyStatus.textContent = msg || "";
    notifyStatus.classList.toggle("is-error", Boolean(isError));
  }

  function syncNotifyUi() {
    const prefs = loadNotifyPrefs();
    if (notifyOrders) notifyOrders.checked = prefs.orders;
    if (notifyMessages) notifyMessages.checked = prefs.messages;

    const supported =
      typeof Notification !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    const perm = typeof Notification !== "undefined" ? Notification.permission : "denied";

    if (notifyEnableBtn) {
      const fullyOn = supported && perm === "granted" && pushSubscribed;
      notifyEnableBtn.hidden = fullyOn;
      notifyEnableBtn.disabled = !supported || perm === "denied";
      if (perm === "denied") {
        notifyEnableBtn.textContent = "Bloķēts pārlūkā";
      } else if (pushSubscribed && perm === "granted") {
        notifyEnableBtn.textContent = "Paziņojumi ieslēgti";
      } else {
        notifyEnableBtn.textContent = "Ieslēgt paziņojumus";
      }
    }

    if (notifyPermHint) {
      if (!supported) {
        notifyPermHint.textContent =
          "Šis pārlūks neatbalsta Web Push. iPhone: pievieno Admin sākuma ekrānam (Safari → Share → Add to Home Screen) un ieslēdz paziņojumus no ikonas.";
      } else if (perm === "granted" && pushSubscribed) {
        notifyPermHint.textContent =
          "Paziņojumi ieslēgti arī ar aizvērtu cilni / no home screen. Izvēlies, par ko vēlies saņemt ziņu.";
      } else if (perm === "denied") {
        notifyPermHint.textContent =
          "Pārlūks ir nobloķējis paziņojumus. Atļauj tos vietnes iestatījumos (vai home screen app iestatījumos).";
      } else {
        notifyPermHint.textContent =
          "Ieslēdz paziņojumus, lai saņemtu ziņu par jauniem pasūtījumiem un ziņām arī tad, kad admin ir aizvērts vai pievienots telefona sākuma ekrānam (Safari → Share → Add to Home Screen).";
      }
    }

    if (notifyDot) notifyDot.hidden = pendingNotifyCount <= 0;
  }

  function openNotifyPanel(open) {
    if (!notifyPanel || !notifyBtn) return;
    notifyPanel.hidden = !open;
    notifyBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      pendingNotifyCount = 0;
      if (notifyDot) notifyDot.hidden = true;
      syncNotifyUi();
    }
  }

  function canNotifyBrowser() {
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  }

  function fireBrowserNotify(title, body, tag) {
    if (!canNotifyBrowser()) return;
    try {
      const n = new Notification(title, {
        body,
        tag: tag || undefined,
        renotify: Boolean(tag),
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (err) {
      console.warn(err);
    }
  }

  function notifyNewOrders(rows) {
    const prefs = getNotifyPrefs();
    if (!prefs.orders || !rows.length) return;
    pendingNotifyCount += rows.length;
    if (notifyDot) notifyDot.hidden = false;
    // Ja Web Push aktīvs, serveris arī sūta — klientā rādam vienmēr, lai būtu uzreiz;
    // vienāds tag aizstāj dublikātu.
    if (rows.length === 1) {
      const o = rows[0];
      const who = o.name || "Jauns klients";
      const nr = o.order_number ? `#${o.order_number}` : "pasūtījums";
      fireBrowserNotify("Jauns pasūtījums", `${nr} · ${who}`, "order-" + o.id);
    } else {
      fireBrowserNotify(
        "Jauni pasūtījumi",
        `${rows.length} jauni pasūtījumi`,
        "orders-batch"
      );
    }
  }

  function notifyNewMessages(rows) {
    const prefs = getNotifyPrefs();
    if (!prefs.messages || !rows.length) return;
    pendingNotifyCount += rows.length;
    if (notifyDot) notifyDot.hidden = false;
    if (rows.length === 1) {
      const m = rows[0];
      const who = m.name || "Jauna ziņa";
      fireBrowserNotify("Jauna ziņa", who, "message-" + m.id);
    } else {
      fireBrowserNotify(
        "Jaunas ziņas",
        `${rows.length} jaunas ziņas`,
        "messages-batch"
      );
    }
  }

  function detectAndNotify(nextOrders, nextMessages) {
    if (knownOrderIds === null || knownMessageIds === null) {
      knownOrderIds = new Set(nextOrders.map((r) => r.id));
      knownMessageIds = new Set(nextMessages.map((r) => r.id));
      return;
    }
    const newOrders = nextOrders.filter((r) => !knownOrderIds.has(r.id));
    const newMessages = nextMessages.filter((r) => !knownMessageIds.has(r.id));
    newOrders.forEach((r) => knownOrderIds.add(r.id));
    newMessages.forEach((r) => knownMessageIds.add(r.id));
    if (newOrders.length) notifyNewOrders(newOrders);
    if (newMessages.length) notifyNewMessages(newMessages);
  }

  function isTypingInDash() {
    const el = document.activeElement;
    if (!el || !dashPanel || dashPanel.hidden) return false;
    if (!dashPanel.contains(el)) return false;
    const tag = el.tagName;
    return tag === "TEXTAREA" || tag === "INPUT";
  }

  function setLoginStatus(msg, isError) {
    if (!loginStatus) return;
    loginStatus.textContent = msg || "";
    loginStatus.classList.toggle("is-error", Boolean(isError));
  }

  function setDashStatus(msg, isError) {
    if (!dashStatus) return;
    dashStatus.textContent = msg || "";
    dashStatus.classList.toggle("is-error", Boolean(isError));
  }

  function setPricingStatus(msg, isError) {
    if (!pricingStatus) return;
    pricingStatus.textContent = msg || "";
    pricingStatus.classList.toggle("is-error", Boolean(isError));
  }

  function fillPricingForm(snap) {
    if (!pricingForm || !snap) return;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = String(val);
    };
    set("priceReadyS", snap.readyBaseEur.S);
    set("priceReadyM", snap.readyBaseEur.M);
    set("priceReadyL", snap.readyBaseEur.L);
    set("priceCustomS", snap.customBaseEur.S);
    set("priceCustomM", snap.customBaseEur.M);
    set("priceCustomL", snap.customBaseEur.L);
    set("priceCarabiner", snap.carabinerSurchargeEur);
    set("priceFreeChars", snap.freeChars);
    set("priceLongText", snap.longTextSurchargeEur);
  }

  function readPricingForm() {
    const num = (id) => Number(document.getElementById(id)?.value);
    const int = (id) => Math.round(Number(document.getElementById(id)?.value));
    return {
      readyBaseEur: {
        S: num("priceReadyS"),
        M: num("priceReadyM"),
        L: num("priceReadyL"),
      },
      customBaseEur: {
        S: num("priceCustomS"),
        M: num("priceCustomM"),
        L: num("priceCustomL"),
      },
      carabinerSurchargeEur: num("priceCarabiner"),
      freeChars: int("priceFreeChars"),
      longTextSurchargeEur: num("priceLongText"),
    };
  }

  function pricingValid(snap) {
    const check = (n) => Number.isFinite(n) && n >= 0;
    return (
      check(snap.readyBaseEur.S) &&
      check(snap.readyBaseEur.M) &&
      check(snap.readyBaseEur.L) &&
      check(snap.customBaseEur.S) &&
      check(snap.customBaseEur.M) &&
      check(snap.customBaseEur.L) &&
      check(snap.carabinerSurchargeEur) &&
      check(snap.longTextSurchargeEur) &&
      Number.isFinite(snap.freeChars) &&
      snap.freeChars >= 0
    );
  }

  async function loadPricing({ quiet = false } = {}) {
    const Pricing = window.TagLabPricing;
    const client = sb();
    if (!Pricing) return;
    if (!quiet) setPricingStatus("Ielādē cenas…");
    const ok = client ? await Pricing.loadFromSupabase(client) : false;
    fillPricingForm(Pricing.snapshot());
    pricingLoaded = true;
    if (!quiet) {
      setPricingStatus(
        ok ? "" : "Rāda noklusējuma cenas (DB vēl nav iestatīta — palaid schema.sql)."
      );
    }
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString("lv-LV", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso || "";
    }
  }

  function formatEur(n) {
    if (n == null || !Number.isFinite(Number(n))) return "";
    return Number(n).toFixed(2).replace(".", ",").replace(/,00$/, "") + " €";
  }

  function itemLine(it) {
    if (!it) return "—";
    const hw = it.hardwareLabel
      ? ` · ${it.hardwareLabel}`
      : it.hardwareId === "carabiner"
        ? " · Riņķītis + karabīne"
        : "";
    const price =
      it.unitPriceEur != null
        ? ` · ${formatEur(it.unitPriceEur)}`
        : it.lineTotalEur != null
          ? ` · ${formatEur(it.lineTotalEur)}`
          : "";
    if (it.type === "ready") {
      return `Gatavais · ${it.colorLabel || it.colorId} · ${it.sizeId}${hw}${price} × ${it.qty || 1}`;
    }
    return `Individuāls · “${it.text || "—"}” · ${it.fontLabel || ""} · ${it.colorLabel || ""} · ${it.sizeLabel || it.sizeId || ""}${it.lengthLabel ? " · " + it.lengthLabel : ""}${hw}${price} × ${it.qty || 1}`;
  }

  function showLoggedOut() {
    if (loginPanel) loginPanel.hidden = false;
    if (dashPanel) dashPanel.hidden = true;
    if (logoutBtn) logoutBtn.hidden = true;
    if (notifyWrap) notifyWrap.hidden = true;
    openNotifyPanel(false);
    knownOrderIds = null;
    knownMessageIds = null;
    pendingNotifyCount = 0;
  }

  function showLoggedIn(user) {
    if (loginPanel) loginPanel.hidden = true;
    if (dashPanel) dashPanel.hidden = false;
    if (logoutBtn) logoutBtn.hidden = false;
    if (notifyWrap) notifyWrap.hidden = false;
    if (adminWho) adminWho.textContent = user?.email || "";
    syncNotifyUi();
    refreshPushState();
  }

  function filterMessages(rows) {
    switch (filter.messages) {
      case "unread":
        return rows.filter((r) => !r.is_read && !r.is_replied);
      case "read":
        return rows.filter((r) => r.is_read && !r.is_replied);
      case "replied":
        return rows.filter((r) => r.is_replied);
      default:
        return rows;
    }
  }

  function filterOrders(rows) {
    switch (filter.orders) {
      case "new":
        return rows.filter(
          (r) => !r.is_viewed && !r.is_made && !r.is_delivered
        );
      case "viewed":
        return rows.filter((r) => r.is_viewed && !r.is_made && !r.is_delivered);
      case "made":
        return rows.filter(
          (r) => r.is_made && !r.is_notified && !r.is_delivered
        );
      case "notified":
        return rows.filter((r) => r.is_notified && !r.is_delivered);
      case "delivered":
        return rows.filter((r) => r.is_delivered);
      default:
        return rows;
    }
  }

  function updateFilterCounts() {
    const msgCounts = {
      unread: messages.filter((r) => !r.is_read && !r.is_replied).length,
      read: messages.filter((r) => r.is_read && !r.is_replied).length,
      replied: messages.filter((r) => r.is_replied).length,
      all: messages.length,
    };
    Object.entries(msgCounts).forEach(([key, n]) => {
      const el = document.querySelector(
        `#messagesFilters [data-filter-count="${key}"]`
      );
      if (el) el.textContent = String(n);
    });
    const unreadTab = document.querySelector('[data-count="messages-unread"]');
    if (unreadTab) unreadTab.textContent = String(msgCounts.unread);

    const orderCounts = {
      new: orders.filter(
        (r) => !r.is_viewed && !r.is_made && !r.is_delivered
      ).length,
      viewed: orders.filter((r) => r.is_viewed && !r.is_made && !r.is_delivered)
        .length,
      made: orders.filter(
        (r) => r.is_made && !r.is_notified && !r.is_delivered
      ).length,
      notified: orders.filter((r) => r.is_notified && !r.is_delivered).length,
      delivered: orders.filter((r) => r.is_delivered).length,
      all: orders.length,
    };
    Object.entries(orderCounts).forEach(([key, n]) => {
      const el = document.querySelector(
        `#ordersFilters [data-filter-count="${key}"]`
      );
      if (el) el.textContent = String(n);
    });
    const newTab = document.querySelector('[data-count="orders-new"]');
    if (newTab) newTab.textContent = String(orderCounts.new);
  }

  function syncFilterButtons(pane, kind) {
    document.querySelectorAll(`#${pane} .admin-filter`).forEach((btn) => {
      btn.classList.toggle(
        "is-active",
        btn.getAttribute("data-filter") === filter[kind]
      );
    });
  }

  function messageBadges(row) {
    if (row.is_replied) return `<span class="admin-badge is-ok">Atbildēta</span>`;
    if (row.is_read) return `<span class="admin-badge">Lasīta</span>`;
    return `<span class="admin-badge is-hot">Nelasīta</span>`;
  }

  function orderBadges(row) {
    const bits = [];
    if (!row.is_viewed && !row.is_made && !row.is_delivered) {
      bits.push(`<span class="admin-badge is-hot">Jauns</span>`);
    }
    if (row.is_made)
      bits.push(`<span class="admin-badge is-ok">Izgatavots</span>`);
    if (row.is_notified)
      bits.push(`<span class="admin-badge is-ok">Informēts</span>`);
    if (row.is_delivered)
      bits.push(`<span class="admin-badge is-ok">Atdots</span>`);
    return bits.join("");
  }

  function renderMessages() {
    updateFilterCounts();
    syncFilterButtons("messagesFilters", "messages");
    const rows = filterMessages(messages);
    messagesEmpty.hidden = rows.length > 0;
    messagesList.innerHTML = "";

    rows.forEach((row) => {
      const open = openId.messages === row.id;
      const card = document.createElement("article");
      card.className =
        "admin-card" +
        (!row.is_read && !row.is_replied ? " is-unread" : "") +
        (open ? " is-open" : "");
      card.dataset.id = row.id;

      const preview = (row.message || "").trim();
      card.innerHTML = `
        <button type="button" class="admin-card-summary" data-open-message="${row.id}">
          <h3></h3>
          <div class="admin-badges">${messageBadges(row)}</div>
          <p class="admin-meta"></p>
          <p class="admin-preview"></p>
        </button>
        <div class="admin-detail" ${open ? "" : "hidden"}>
          <dl class="admin-dl">
            <div><dt>Vārds</dt><dd data-f="name"></dd></div>
            <div><dt>E-pasts</dt><dd data-f="email"></dd></div>
            <div><dt>Laiks</dt><dd data-f="time"></dd></div>
          </dl>
          <p class="admin-note-block" data-f="message"></p>
          <div class="admin-checks">
            <label class="admin-check">
              <input type="checkbox" data-msg-replied="${row.id}" ${
                row.is_replied ? "checked" : ""
              } />
              Atbildēta
            </label>
          </div>
        </div>
      `;
      card.querySelector("h3").textContent = row.name || "—";
      card.querySelector(".admin-meta").textContent = [
        fmtDate(row.created_at),
        row.email,
      ]
        .filter(Boolean)
        .join(" · ");
      card.querySelector(".admin-preview").textContent = preview;
      card.querySelector('[data-f="name"]').textContent = row.name || "—";
      card.querySelector('[data-f="email"]').textContent = row.email || "—";
      card.querySelector('[data-f="time"]').textContent = fmtDate(row.created_at);
      card.querySelector('[data-f="message"]').textContent = row.message || "";
      messagesList.appendChild(card);
    });
  }

  function renderOrders() {
    updateFilterCounts();
    syncFilterButtons("ordersFilters", "orders");
    const rows = filterOrders(orders);
    ordersEmpty.hidden = rows.length > 0;
    ordersList.innerHTML = "";

    rows.forEach((row) => {
      const open = openId.orders === row.id;
      const items = Array.isArray(row.items) ? row.items : [];
      const pay =
        row.payment_method === "transfer"
          ? "Pārskaitījums"
          : row.payment_method === "paid"
            ? "Samaksāts"
            : "Skaidrā / skola";

      const card = document.createElement("article");
      card.className =
        "admin-card" +
        (!row.is_viewed && !row.is_made && !row.is_delivered ? " is-new" : "") +
        (open ? " is-open" : "");
      card.dataset.id = row.id;

      const preview =
        items.map(itemLine).join("; ") || (row.note || "").trim() || "—";

      card.innerHTML = `
        <button type="button" class="admin-card-summary" data-open-order="${row.id}">
          <h3></h3>
          <div class="admin-badges">${orderBadges(row)}</div>
          <p class="admin-meta"></p>
          <p class="admin-preview"></p>
        </button>
        <div class="admin-detail" ${open ? "" : "hidden"}>
          <dl class="admin-dl">
            <div><dt>Nr.</dt><dd data-f="number"></dd></div>
            <div><dt>Vārds</dt><dd data-f="name"></dd></div>
            <div><dt>Tālrunis</dt><dd data-f="phone"></dd></div>
            <div><dt>E-pasts</dt><dd data-f="email"></dd></div>
            <div><dt>Klase</dt><dd data-f="class"></dd></div>
            <div><dt>Apmaksa</dt><dd data-f="pay"></dd></div>
            <div><dt>Laiks</dt><dd data-f="time"></dd></div>
          </dl>
          <div>
            <p class="admin-meta" style="margin-bottom:0.35rem">Pozīcijas</p>
            <ul class="admin-items" data-f="items"></ul>
          </div>
          <div data-f="note-wrap" hidden>
            <p class="admin-meta" style="margin-bottom:0.35rem">Klienta piezīme</p>
            <p class="admin-note-block" data-f="note"></p>
          </div>
          <div class="admin-checks">
            <label class="admin-check">
              <input type="checkbox" data-ord-made="${row.id}" ${
                row.is_made ? "checked" : ""
              } />
              Izgatavots
            </label>
            <label class="admin-check">
              <input type="checkbox" data-ord-notified="${row.id}" ${
                row.is_notified ? "checked" : ""
              } />
              Informēts (sarunā saņemšanu)
            </label>
            <label class="admin-check">
              <input type="checkbox" data-ord-delivered="${row.id}" ${
                row.is_delivered ? "checked" : ""
              } />
              Atdots
            </label>
          </div>
          <div data-f="admin-note-wrap" hidden>
            <p class="admin-meta" style="margin-bottom:0.35rem">Mani komentāri</p>
            <div class="admin-note-block admin-note-block--mine" data-f="admin-note"></div>
          </div>
          <div class="admin-admin-note">
            <label for="adminNote-${row.id}">Pievienot komentāru</label>
            <textarea
              id="adminNote-${row.id}"
              data-admin-note="${row.id}"
              placeholder="Pieraksti šeit…"
            ></textarea>
            <div class="order-actions">
              <button type="button" class="btn btn-small" data-save-note="${row.id}">
                Saglabāt komentāru
              </button>
            </div>
          </div>
        </div>
      `;
      card.querySelector("h3").textContent = row.order_number
        ? `#${row.order_number} · ${row.name || "—"}`
        : row.name || "—";
      card.querySelector(".admin-meta").textContent = [
        fmtDate(row.created_at),
        row.phone,
        items.length ? `${items.length} poz.` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      card.querySelector(".admin-preview").textContent = preview;
      card.querySelector('[data-f="number"]').textContent = row.order_number
        ? String(row.order_number)
        : "—";
      card.querySelector('[data-f="name"]').textContent = row.name || "—";
      card.querySelector('[data-f="phone"]').textContent = row.phone || "—";
      card.querySelector('[data-f="email"]').textContent = row.email || "—";
      card.querySelector('[data-f="class"]').textContent =
        row.school_class || "—";
      card.querySelector('[data-f="pay"]').textContent = pay;
      card.querySelector('[data-f="time"]').textContent = fmtDate(row.created_at);
      const ul = card.querySelector('[data-f="items"]');
      items.forEach((it) => {
        const li = document.createElement("li");
        li.className = "admin-item";
        const text = document.createElement("p");
        text.className = "admin-item-text";
        text.textContent = itemLine(it);
        li.appendChild(text);
        if (it.type === "custom" && (it.previewPng || it.previewSvg)) {
          const wrap = document.createElement("div");
          wrap.className = "admin-item-preview";
          wrap.setAttribute("aria-label", "Dizaina vizualizācija");
          if (it.previewPng) {
            const img = document.createElement("img");
            img.src = it.previewPng;
            img.alt = "Dizaina vizualizācija";
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
          li.appendChild(wrap);
        }
        ul.appendChild(li);
      });
      const orderSum = items.reduce((sum, it) => {
        if (it.lineTotalEur != null && Number.isFinite(Number(it.lineTotalEur))) {
          return sum + Number(it.lineTotalEur);
        }
        if (it.unitPriceEur != null && Number.isFinite(Number(it.unitPriceEur))) {
          return sum + Number(it.unitPriceEur) * (Number(it.qty) || 1);
        }
        return sum;
      }, 0);
      if (orderSum > 0) {
        const totalLi = document.createElement("li");
        totalLi.className = "admin-item admin-item-total";
        totalLi.textContent = "Kopā: " + formatEur(orderSum);
        ul.appendChild(totalLi);
      }
      if (row.note) {
        const wrap = card.querySelector('[data-f="note-wrap"]');
        wrap.hidden = false;
        card.querySelector('[data-f="note"]').textContent = row.note;
      }
      if (row.admin_note) {
        const wrap = card.querySelector('[data-f="admin-note-wrap"]');
        wrap.hidden = false;
        card.querySelector('[data-f="admin-note"]').textContent = row.admin_note;
      }
      ordersList.appendChild(card);
    });
  }

  function renderAll() {
    renderMessages();
    renderOrders();
  }

  async function patch(table, id, patchObj) {
    const client = sb();
    if (!client) return false;
    const { error } = await client.from(table).update(patchObj).eq("id", id);
    if (error) {
      setDashStatus("Neizdevās saglabāt: " + error.message, true);
      return false;
    }
    setDashStatus("Saglabāts.");
    return true;
  }

  async function markMessageRead(id) {
    const client = sb();
    if (!client || !currentUserId || myMessageReads.has(id)) return true;
    const { error } = await client.from("message_reads").upsert(
      { message_id: id, user_id: currentUserId },
      { onConflict: "message_id,user_id" }
    );
    if (error) {
      setDashStatus("Neizdevās saglabāt: " + error.message, true);
      return false;
    }
    myMessageReads.add(id);
    const row = messages.find((m) => m.id === id);
    if (row) row.is_read = true;
    return true;
  }

  async function markOrderViewed(id) {
    const client = sb();
    if (!client || !currentUserId || myOrderViews.has(id)) return true;
    const { error } = await client.from("order_views").upsert(
      { order_id: id, user_id: currentUserId },
      { onConflict: "order_id,user_id" }
    );
    if (error) {
      setDashStatus("Neizdevās saglabāt: " + error.message, true);
      return false;
    }
    myOrderViews.add(id);
    const row = orders.find((o) => o.id === id);
    if (row) row.is_viewed = true;
    return true;
  }

  async function openMessage(id) {
    openId.messages = openId.messages === id ? null : id;
    if (openId.messages === id) await markMessageRead(id);
    renderMessages();
  }

  async function openOrder(id) {
    openId.orders = openId.orders === id ? null : id;
    if (openId.orders === id) await markOrderViewed(id);
    renderOrders();
  }

  async function loadData({ quiet = false } = {}) {
    const client = sb();
    if (!client) {
      setDashStatus("Supabase nav konfigurēts.", true);
      return;
    }
    if (loadBusy) return;
    loadBusy = true;
    if (!quiet) setDashStatus("Ielādē…");
    try {
      if (!currentUserId) {
        const { data: sessionData } = await client.auth.getSession();
        currentUserId = sessionData.session?.user?.id || null;
      }

      const [ordersRes, messagesRes, readsRes, viewsRes] = await Promise.all([
        client
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false }),
        client
          .from("messages")
          .select("*")
          .order("created_at", { ascending: false }),
        currentUserId
          ? client
              .from("message_reads")
              .select("message_id")
              .eq("user_id", currentUserId)
          : Promise.resolve({ data: [], error: null }),
        currentUserId
          ? client
              .from("order_views")
              .select("order_id")
              .eq("user_id", currentUserId)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (ordersRes.error || messagesRes.error) {
        const err = ordersRes.error || messagesRes.error;
        setDashStatus("Neizdevās ielādēt: " + (err.message || "kļūda"), true);
        return;
      }
      if (readsRes.error || viewsRes.error) {
        const err = readsRes.error || viewsRes.error;
        setDashStatus(
          "Neizdevās ielādēt lasīšanas statusu (palaid schema.sql?): " +
            (err.message || "kļūda"),
          true
        );
        return;
      }

      myMessageReads = new Set(
        (readsRes.data || []).map((r) => r.message_id)
      );
      myOrderViews = new Set((viewsRes.data || []).map((r) => r.order_id));

      orders = (ordersRes.data || []).map((r) => ({
        ...r,
        is_viewed: myOrderViews.has(r.id),
        is_made: Boolean(r.is_made),
        is_notified: Boolean(r.is_notified),
        is_delivered: Boolean(r.is_delivered),
      }));
      messages = (messagesRes.data || []).map((r) => ({
        ...r,
        is_read: myMessageReads.has(r.id),
        is_replied: Boolean(r.is_replied),
      }));
      detectAndNotify(orders, messages);
      if (isTypingInDash()) {
        updateFilterCounts();
        if (!quiet) setDashStatus("");
        return;
      }
      renderAll();
      if (!pricingLoaded) await loadPricing({ quiet: true });
      if (!quiet) setDashStatus("");
    } finally {
      loadBusy = false;
    }
  }

  function stopWatch() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    const client = sb();
    if (realtimeChannel && client) {
      client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  }

  function startWatch() {
    stopWatch();
    const client = sb();
    if (!client) return;

    realtimeChannel = client
      .channel("admin-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          loadData({ quiet: true }).then(() => {
            if (!isTypingInDash()) setDashStatus("Atjaunināts.");
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadData({ quiet: true }).then(() => {
            if (!isTypingInDash()) setDashStatus("Atjaunināts.");
          });
        }
      )
      .subscribe();

    pollTimer = setInterval(() => loadData({ quiet: true }), 20000);
  }

  async function bootSession() {
    const client = sb();
    if (!client) {
      setLoginStatus(
        "Supabase nav konfigurēts — pārbaudi js/supabase-config.js.",
        true
      );
      return;
    }
    const { data } = await client.auth.getSession();
    if (data.session?.user) {
      currentUserId = data.session.user.id;
      showLoggedIn(data.session.user);
      await loadData();
      startWatch();
    } else {
      currentUserId = null;
      showLoggedOut();
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const client = sb();
    if (!client) {
      setLoginStatus("Supabase nav konfigurēts.", true);
      return;
    }
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginSubmit");
    if (btn) btn.disabled = true;
    setLoginStatus("Pieslēdzas…");
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (btn) btn.disabled = false;
    if (error) {
      setLoginStatus(error.message || "Neizdevās ielogoties.", true);
      return;
    }
    setLoginStatus("");
    currentUserId = data.user?.id || null;
    showLoggedIn(data.user);
    await loadData();
    startWatch();
  });

  logoutBtn.addEventListener("click", async () => {
    stopWatch();
    const client = sb();
    if (client) await client.auth.signOut();
    currentUserId = null;
    myMessageReads = new Set();
    myOrderViews = new Set();
    showLoggedOut();
    setLoginStatus("Izlogots.");
  });

  refreshBtn.addEventListener("click", () => loadData());

  if (notifyBtn) {
    notifyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openNotifyPanel(notifyPanel?.hidden !== false);
    });
  }

  if (notifyEnableBtn) {
    notifyEnableBtn.addEventListener("click", async () => {
      notifyEnableBtn.disabled = true;
      setNotifyStatus("Ieslēdz…");
      try {
        await enableWebPush();
        syncNotifyUi();
        setNotifyStatus("Paziņojumi ieslēgti (arī ar aizvērtu admin).");
        fireBrowserNotify(
          "AA3DLab Admin",
          "Paziņojumi darbojas.",
          "aa3dlab-notify-test"
        );
      } catch (err) {
        syncNotifyUi();
        setNotifyStatus(err.message || "Neizdevās ieslēgt.", true);
      } finally {
        notifyEnableBtn.disabled = false;
        syncNotifyUi();
      }
    });
  }

  function onNotifyPrefChange() {
    saveNotifyPrefs(getNotifyPrefs());
    setNotifyStatus("Saglabāts.");
  }
  if (notifyOrders) notifyOrders.addEventListener("change", onNotifyPrefChange);
  if (notifyMessages) notifyMessages.addEventListener("change", onNotifyPrefChange);

  document.addEventListener("click", (e) => {
    if (!notifyWrap || notifyWrap.hidden || !notifyPanel || notifyPanel.hidden) {
      return;
    }
    if (!notifyWrap.contains(e.target)) openNotifyPanel(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") openNotifyPanel(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && dashPanel && !dashPanel.hidden) {
      loadData({ quiet: true });
    }
  });

  syncNotifyUi();

  document.querySelectorAll(".admin-tab[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.getAttribute("data-tab");
      document.querySelectorAll(".admin-tab[data-tab]").forEach((t) => {
        const on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      document.querySelectorAll(".admin-pane").forEach((pane) => {
        pane.hidden = pane.getAttribute("data-pane") !== id;
      });
      if (id === "pricing") loadPricing();
    });
  });

  if (pricingForm) {
    pricingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const Pricing = window.TagLabPricing;
      const client = sb();
      if (!Pricing || !client) {
        setPricingStatus("Supabase nav konfigurēts.", true);
        return;
      }
      const snap = readPricingForm();
      if (!pricingValid(snap)) {
        setPricingStatus("Ievadi derīgas cenas (≥ 0).", true);
        return;
      }
      if (pricingSaveBtn) pricingSaveBtn.disabled = true;
      setPricingStatus("Saglabā…");
      const res = await Pricing.saveToSupabase(client, snap);
      if (pricingSaveBtn) pricingSaveBtn.disabled = false;
      if (!res.ok) {
        setPricingStatus(
          "Neizdevās saglabāt: " +
            (res.error || "kļūda") +
            " (pārbaudi, vai palaists schema.sql ar site_settings).",
          true
        );
        return;
      }
      fillPricingForm(Pricing.snapshot());
      setPricingStatus("Cenas saglabātas.");
    });
  }

  document.getElementById("messagesFilters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    filter.messages = btn.getAttribute("data-filter");
    openId.messages = null;
    renderMessages();
  });

  document.getElementById("ordersFilters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    filter.orders = btn.getAttribute("data-filter");
    openId.orders = null;
    renderOrders();
  });

  messagesList.addEventListener("click", async (e) => {
    const openBtn = e.target.closest("[data-open-message]");
    if (openBtn) {
      await openMessage(openBtn.getAttribute("data-open-message"));
    }
  });

  messagesList.addEventListener("change", async (e) => {
    const box = e.target.closest("[data-msg-replied]");
    if (!box) return;
    const id = box.getAttribute("data-msg-replied");
    const row = messages.find((m) => m.id === id);
    if (!row) return;
    const is_replied = box.checked;
    const ok = await patch("messages", id, {
      is_replied,
      status: is_replied ? "done" : "read",
    });
    if (!ok) {
      box.checked = !is_replied;
      return;
    }
    row.is_replied = is_replied;
    row.status = is_replied ? "done" : "read";
    if (is_replied) await markMessageRead(id);
    renderMessages();
  });

  ordersList.addEventListener("click", async (e) => {
    const openBtn = e.target.closest("[data-open-order]");
    if (openBtn) {
      await openOrder(openBtn.getAttribute("data-open-order"));
      return;
    }
    const saveBtn = e.target.closest("[data-save-note]");
    if (saveBtn) {
      const id = saveBtn.getAttribute("data-save-note");
      const row = orders.find((o) => o.id === id);
      const ta = ordersList.querySelector(`[data-admin-note="${id}"]`);
      if (!row || !ta) return;
      const addition = ta.value.trim();
      if (!addition) {
        setDashStatus("Ieraksti komentāru pirms saglabāšanas.", true);
        return;
      }
      const stamp = fmtDate(new Date().toISOString());
      const chunk = `— ${stamp}\n${addition}`;
      const admin_note = row.admin_note
        ? `${row.admin_note}\n\n${chunk}`
        : chunk;
      saveBtn.disabled = true;
      const ok = await patch("orders", id, { admin_note });
      saveBtn.disabled = false;
      if (!ok) return;
      row.admin_note = admin_note;
      ta.value = "";
      renderOrders();
    }
  });

  ordersList.addEventListener("change", async (e) => {
    const made = e.target.closest("[data-ord-made]");
    const notified = e.target.closest("[data-ord-notified]");
    const delivered = e.target.closest("[data-ord-delivered]");
    const box = made || notified || delivered;
    if (!box) return;
    const id =
      box.getAttribute("data-ord-made") ||
      box.getAttribute("data-ord-notified") ||
      box.getAttribute("data-ord-delivered");
    const row = orders.find((o) => o.id === id);
    if (!row) return;

    const patchObj = {};
    if (made) {
      patchObj.is_made = made.checked;
      if (!made.checked) {
        patchObj.is_notified = false;
        patchObj.is_delivered = false;
      }
    }
    if (notified) {
      patchObj.is_notified = notified.checked;
      if (notified.checked) patchObj.is_made = true;
      if (!notified.checked) patchObj.is_delivered = false;
    }
    if (delivered) {
      patchObj.is_delivered = delivered.checked;
      if (delivered.checked) {
        patchObj.is_made = true;
        patchObj.is_notified = true;
      }
    }
    if (patchObj.is_delivered) patchObj.status = "done";
    else if (patchObj.is_notified || patchObj.is_made || row.is_made)
      patchObj.status = "in_progress";

    const ok = await patch("orders", id, patchObj);
    if (!ok) {
      box.checked = !box.checked;
      return;
    }
    Object.assign(row, patchObj);
    if (made?.checked || notified?.checked || delivered?.checked) {
      await markOrderViewed(id);
    }
    if (notified && notified.checked) row.is_made = true;
    if (delivered && delivered.checked) {
      row.is_made = true;
      row.is_notified = true;
    }
    if (made && !made.checked) {
      row.is_notified = false;
      row.is_delivered = false;
    }
    if (notified && !notified.checked) row.is_delivered = false;
    renderOrders();
  });

  bootSession();
})();
