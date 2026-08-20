/* =========================================================
   DBT MULTI SHOP V2 - SHARED UI ENGINE
   Theme / Sound / Toast / Favorites / Recently Viewed
   ========================================================= */

(function () {
  "use strict";

  const KEYS = {
    theme: "dbt_theme",
    sound: "dbt_sound",
    favorites: "dbt_favorites_v1",
    recent: "dbt_recent_v1"
  };

  const safeJSON = (raw, fallback) => {
    try { return JSON.parse(raw); }
    catch (_) { return fallback; }
  };

  const storage = {
    get(key, fallback = null) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
      } catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); }
      catch (_) {}
    }
  };

  /* -------------------------
     THEME
  ------------------------- */

  const theme = {
    get() {
      const saved = storage.get(KEYS.theme);
      if (saved === "dark" || saved === "light") return saved;

      return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    },

    apply(value) {
      const next = value === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      storage.set(KEYS.theme, next);

      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", next === "dark" ? "#0d1117" : "#111827");

      const btn = document.getElementById("dbtThemeToggle");
      if (btn) {
        btn.textContent = next === "dark" ? "☀️" : "🌙";
        btn.setAttribute(
          "aria-label",
          next === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"
        );
        btn.title = next === "dark" ? "โหมดสว่าง" : "โหมดมืด";
      }

      window.dispatchEvent(new CustomEvent("dbt:theme", { detail: { theme: next } }));
    },

    toggle() {
      this.apply(this.get() === "dark" ? "light" : "dark");
    }
  };

  /* -------------------------
     SOUND
  ------------------------- */

  const sound = {
    enabled() {
      return storage.get(KEYS.sound, "on") !== "off";
    },

    set(enabled) {
      storage.set(KEYS.sound, enabled ? "on" : "off");
      this.syncButton();
    },

    toggle() {
      this.set(!this.enabled());
      toast(this.enabled() ? "เปิดเสียงแล้ว 🔊" : "ปิดเสียงแล้ว 🔇");
      if (this.enabled()) this.play("tap");
    },

    syncButton() {
      const btn = document.getElementById("dbtSoundToggle");
      if (!btn) return;

      btn.textContent = this.enabled() ? "🔊" : "🔇";
      btn.setAttribute(
        "aria-label",
        this.enabled() ? "ปิดเสียงเอฟเฟกต์" : "เปิดเสียงเอฟเฟกต์"
      );
      btn.title = this.enabled() ? "ปิดเสียง" : "เปิดเสียง";
    },

    play(type = "tap") {
      if (!this.enabled()) return;

      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const config = {
          tap: [520, .045, .035],
          favorite: [660, .07, .04],
          success: [760, .12, .045],
          remove: [320, .05, .03]
        }[type] || [520, .045, .035];

        osc.type = "sine";
        osc.frequency.value = config[0];

        gain.gain.setValueAtTime(config[2], ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + config[1]);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + config[1]);
        osc.onended = () => ctx.close();
      } catch (_) {}
    }
  };

  /* -------------------------
     TOAST
  ------------------------- */

  let toastTimer = null;

  function ensureToast() {
    let el = document.getElementById("dbtGlobalToast");

    if (!el) {
      el = document.createElement("div");
      el.id = "dbtGlobalToast";
      el.className = "dbt-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }

    return el;
  }

  function toast(message, type = "") {
    const el = ensureToast();

    clearTimeout(toastTimer);
    el.textContent = String(message || "");
    el.className = `dbt-toast ${type}`.trim();

    requestAnimationFrame(() => el.classList.add("show"));

    toastTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 1900);
  }

  /* -------------------------
     FAVORITES
     item = {type:"shop"|"product", id, name, image, ...}
  ------------------------- */

  const favorites = {
    all() {
      return safeJSON(storage.get(KEYS.favorites, "[]"), []);
    },

    save(items) {
      storage.set(KEYS.favorites, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent("dbt:favorites", { detail: { items } }));
    },

    has(type, id) {
      return this.all().some(
        item => item.type === String(type) && String(item.id) === String(id)
      );
    },

    toggle(item) {
      if (!item || !item.type || item.id === undefined || item.id === null) return false;

      const items = this.all();
      const index = items.findIndex(
        x => x.type === String(item.type) && String(x.id) === String(item.id)
      );

      let active;

      if (index >= 0) {
        items.splice(index, 1);
        active = false;
        sound.play("remove");
      } else {
        items.unshift({
          ...item,
          type: String(item.type),
          id: String(item.id),
          saved_at: new Date().toISOString()
        });
        active = true;
        sound.play("favorite");
      }

      this.save(items.slice(0, 100));
      toast(active ? `เพิ่ม ${item.name || "รายการ"} ในรายการโปรด ❤️` : `นำ ${item.name || "รายการ"} ออกจากรายการโปรด`);

      return active;
    },

    byType(type) {
      return this.all().filter(item => item.type === String(type));
    }
  };

  /* -------------------------
     RECENTLY VIEWED
  ------------------------- */

  const recent = {
    all() {
      return safeJSON(storage.get(KEYS.recent, "[]"), []);
    },

    add(item) {
      if (!item || !item.type || item.id === undefined || item.id === null) return;

      let items = this.all().filter(
        x => !(x.type === String(item.type) && String(x.id) === String(item.id))
      );

      items.unshift({
        ...item,
        type: String(item.type),
        id: String(item.id),
        viewed_at: new Date().toISOString()
      });

      items = items.slice(0, 20);
      storage.set(KEYS.recent, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent("dbt:recent", { detail: { items } }));
    },

    byType(type) {
      return this.all().filter(item => item.type === String(type));
    },

    clear() {
      storage.set(KEYS.recent, "[]");
      window.dispatchEvent(new CustomEvent("dbt:recent", { detail: { items: [] } }));
    }
  };

  /* -------------------------
     ACCESSIBLE FLOATING CONTROLS
  ------------------------- */

  function injectTools() {
    if (document.getElementById("dbtUiTools")) return;

    const wrap = document.createElement("div");
    wrap.className = "dbt-ui-tools";
    wrap.id = "dbtUiTools";
    wrap.innerHTML = `
      <button type="button" class="dbt-ui-tool" id="dbtThemeToggle" aria-label="เปลี่ยนธีม">🌙</button>
      <button type="button" class="dbt-ui-tool" id="dbtSoundToggle" aria-label="เปิดหรือปิดเสียง">🔊</button>
    `;

    document.body.appendChild(wrap);

    document.getElementById("dbtThemeToggle").addEventListener("click", () => {
      theme.toggle();
      sound.play("tap");
    });

    document.getElementById("dbtSoundToggle").addEventListener("click", () => {
      sound.toggle();
    });

    theme.apply(theme.get());
    sound.syncButton();
  }

  function init() {
    theme.apply(theme.get());

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", injectTools, { once: true });
    } else {
      injectTools();
    }
  }

  window.DBTUI = {
    init,
    theme,
    sound,
    toast,
    favorites,
    recent,
    storage
  };

  init();
})();
