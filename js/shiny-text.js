/* ShinyText — vanilla JS port of React Bits <ShinyText /> (JS-CSS variant).
   Usage: var st = ShinyText(el, { color: "#b5b5b5", shineColor: "#fff", speed: 2, trigger: "loop" });
          st.update({ color: "#000" });  st.destroy();                                          */
(function (global) {
  var EASINGS = {
    linear: function (t) { return t; },
    smooth: function (t) { return 0.5 - Math.cos(Math.PI * t) / 2; },
    snappy: function (t) { return t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2; }
  };
  var TRIGGERS = ["loop", "hover", "view"];
  var FALLOFF = [0, 0.2, 0.4, 0.6, 0.8, 1];
  var DEFAULTS = {
    color: "#b5b5b5", shineColor: "#ffffff", speed: 2, delay: 0, angle: 120, shineWidth: 40,
    softness: 0.8, bands: 1, glow: 0, direction: "left", easing: "smooth", trigger: "loop",
    yoyo: false, followPointer: false, pauseOnHover: false, disabled: false
  };

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  var paint = null;
  function parseColor(value) {
    if (!paint) paint = document.createElement("canvas").getContext("2d");
    if (!paint) return null;
    paint.fillStyle = "#000000";
    paint.fillStyle = value;
    var resolved = String(paint.fillStyle);
    if (resolved.charAt(0) === "#") {
      return [1, 3, 5].map(function (i) { return parseInt(resolved.slice(i, i + 2), 16); }).concat(1);
    }
    var parts = resolved.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return null;
    return [Number(parts[0]), Number(parts[1]), Number(parts[2]), parts.length > 3 ? Number(parts[3]) : 1];
  }

  function blend(from, to, amount) {
    function channel(a, b) {
      return Math.round(Math.pow(Math.pow(a / 255, 2.2) * (1 - amount) + Math.pow(b / 255, 2.2) * amount, 1 / 2.2) * 255);
    }
    var alpha = from[3] * (1 - amount) + to[3] * amount;
    if (alpha <= 0) return "rgba(0, 0, 0, 0)";
    function weigh(a, b) { return (a * from[3] * (1 - amount) + b * to[3] * amount) / alpha; }
    var same = from[3] === to[3];
    var r = same ? channel(from[0], to[0]) : Math.round(weigh(from[0], to[0]));
    var g = same ? channel(from[1], to[1]) : Math.round(weigh(from[1], to[1]));
    var b = same ? channel(from[2], to[2]) : Math.round(weigh(from[2], to[2]));
    return "rgba(" + r + ", " + g + ", " + b + ", " + Math.round(alpha * 1000) / 1000 + ")";
  }

  function normalize(o) {
    return {
      color: o.color, shineColor: o.shineColor,
      speed: Math.max(0.1, o.speed), delay: Math.max(0, o.delay), angle: o.angle,
      shineWidth: clamp(o.shineWidth, 2, 200), softness: clamp(o.softness, 0, 1),
      bands: clamp(Math.round(o.bands), 1, 3), glow: clamp(o.glow, 0, 1),
      sign: o.direction === "right" ? 1 : -1,
      ease: EASINGS[o.easing] || EASINGS.smooth,
      trigger: TRIGGERS.indexOf(o.trigger) > -1 ? o.trigger : "loop",
      yoyo: o.yoyo, followPointer: o.followPointer, pauseOnHover: o.pauseOnHover, disabled: o.disabled
    };
  }

  function ShinyText(root, options) {
    if (!root) return { update: function () {}, destroy: function () {} };
    var opts = Object.assign({}, DEFAULTS, options || {});
    var s = normalize(opts);
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    root.classList.add("shiny-text");
    root.style.backgroundImage = "linear-gradient(" + s.color + ", " + s.color + ")";
    var glowEl = null;
    function ensureGlow() {
      if (s.glow > 0 && !glowEl) {
        glowEl = document.createElement("span");
        glowEl.className = "shiny-text__glow";
        glowEl.setAttribute("aria-hidden", "true");
        glowEl.textContent = root.getAttribute("data-shiny-label") || root.textContent;
        root.appendChild(glowEl);
      } else if (s.glow <= 0 && glowEl) {
        glowEl.remove();
        glowEl = null;
      }
    }
    if (s.glow > 0) root.setAttribute("data-shiny-label", root.textContent);
    ensureGlow();

    var state = {
      pos: null, vel: 0, phase: "idle", from: 0, to: 0, start: 0, duration: 1, resume: 0,
      flip: false, inside: false, target: 0, visible: true, seen: false, colors: ""
    };
    var base = null, shine = null, clear = null;
    var raf = 0, timer = 0, last = 0, alive = true;

    function extent() { return s.shineWidth / 2 + (s.bands - 1) * s.shineWidth * 1.3 + 2; }
    function entry() { return s.sign > 0 ? -extent() : 100 + extent(); }
    function exit() { return s.sign > 0 ? 100 + extent() : -extent(); }
    function nearest() { return state.target < 50 ? -extent() : 100 + extent(); }

    function gradient(pos, fill) {
      var half = s.shineWidth / 2;
      var core = half * (1 - s.softness);
      var fade = half - core;
      var stops = [];
      for (var band = 0; band < s.bands; band++) {
        var center = pos - s.sign * band * s.shineWidth * 1.3;
        var strength = 1 - band * 0.28;
        [-1, 1].forEach(function (side) {
          FALLOFF.forEach(function (f) {
            stops.push([center + side * (core + fade * (1 - f)), f * f * (3 - 2 * f) * strength]);
          });
        });
      }
      stops.sort(function (a, b) { return a[0] - b[0]; });
      var list = stops.map(function (p) { return blend(fill, shine, p[1]) + " " + p[0].toFixed(2) + "%"; });
      return "linear-gradient(" + s.angle + "deg, " + blend(fill, shine, 0) + " 0%, " + list.join(", ") + ", " + blend(fill, shine, 0) + " 100%)";
    }

    function draw() {
      var key = s.color + "|" + s.shineColor;
      if (key !== state.colors) {
        state.colors = key;
        base = parseColor(s.color);
        shine = parseColor(s.shineColor);
        clear = shine ? [shine[0], shine[1], shine[2], 0] : null;
      }
      if (!base || !shine || state.pos === null || s.disabled) {
        root.style.backgroundImage = "linear-gradient(" + s.color + ", " + s.color + ")";
        if (glowEl) glowEl.style.backgroundImage = "none";
        return;
      }
      root.style.backgroundImage = gradient(state.pos, base);
      if (glowEl) {
        glowEl.style.backgroundImage = gradient(state.pos, clear);
        glowEl.style.opacity = String(s.glow);
      }
    }

    function sweep(from, to, now) {
      var span = Math.abs(exit() - entry()) || 1;
      state.phase = "sweep";
      state.from = from;
      state.to = to;
      state.start = now;
      state.duration = s.speed * 1000 * Math.max(0.15, Math.abs(to - from) / span);
    }

    function wake() {
      if (raf || !alive) return;
      clearTimeout(timer);
      timer = 0;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function tick(now) {
      raf = 0;
      if (!alive) return;
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (s.disabled) { state.pos = null; state.phase = "idle"; draw(); return; }
      var following = s.followPointer && state.inside;
      if (following) {
        if (state.pos === null) state.pos = nearest();
        var stiffness = 220;
        state.vel += ((state.target - state.pos) * stiffness - state.vel * 2 * Math.sqrt(stiffness)) * dt;
        state.pos += state.vel * dt;
        state.phase = "follow";
        draw();
        raf = requestAnimationFrame(tick);
        return;
      }
      if (state.phase === "follow") {
        state.vel = 0;
        sweep(state.pos != null ? state.pos : nearest(), nearest(), now);
      }
      if (state.phase === "sweep") {
        if (s.pauseOnHover && state.inside) {
          state.start += dt * 1000;
          raf = requestAnimationFrame(tick);
          return;
        }
        var t = clamp((now - state.start) / state.duration, 0, 1);
        state.pos = state.from + (state.to - state.from) * s.ease(t);
        draw();
        if (t < 1) { raf = requestAnimationFrame(tick); return; }
        if (s.trigger !== "loop" || reduce) { state.phase = "idle"; state.pos = null; draw(); return; }
        state.phase = "wait";
        state.resume = now + s.delay * 1000;
      }
      if (state.phase === "wait") {
        if (!state.visible) return;
        if (now < state.resume) { clearTimeout(timer); timer = setTimeout(wake, state.resume - now); return; }
        if (s.yoyo) {
          state.flip = !state.flip;
          sweep(state.flip ? exit() : entry(), state.flip ? entry() : exit(), now);
        } else {
          sweep(entry(), exit(), now);
        }
        raf = requestAnimationFrame(tick);
        return;
      }
      if (state.phase === "idle" && s.trigger === "loop" && !reduce && state.visible) {
        state.flip = false;
        sweep(entry(), exit(), now);
        raf = requestAnimationFrame(tick);
      }
    }

    function locate(event) {
      var rect = root.getBoundingClientRect();
      var radians = (s.angle * Math.PI) / 180;
      var dx = Math.sin(radians), dy = -Math.cos(radians);
      var length = Math.abs(rect.width * dx) + Math.abs(rect.height * dy) || 1;
      var along = (event.clientX - rect.left - rect.width / 2) * dx + (event.clientY - rect.top - rect.height / 2) * dy;
      return 50 + (along / length) * 100;
    }

    function onEnter(event) {
      state.inside = true;
      state.target = locate(event);
      if (s.disabled) return;
      if (s.followPointer) {
        if (state.pos === null) state.pos = nearest();
      } else if (s.trigger === "hover" && state.phase === "idle" && !reduce) {
        sweep(entry(), exit(), performance.now());
      }
      wake();
    }
    function onMove(event) { state.target = locate(event); if (s.followPointer) wake(); }
    function onLeave() { state.inside = false; wake(); }

    var observer = new IntersectionObserver(function (entries) {
      var visible = entries.some(function (i) { return i.isIntersecting; });
      state.visible = visible;
      if (!visible) return;
      if (s.trigger === "view" && !state.seen && !reduce && !s.disabled) {
        state.seen = true;
        sweep(entry(), exit(), performance.now());
      }
      wake();
    });
    observer.observe(root);
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);

    function sync() {
      if (s.disabled) { state.pos = null; state.phase = "idle"; }
      else if (s.trigger !== "loop" && state.phase === "wait") { state.phase = "idle"; state.pos = null; }
      ensureGlow();
      draw();
      wake();
    }
    draw();
    wake();

    return {
      update: function (next) { Object.assign(opts, next || {}); s = normalize(opts); sync(); },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        observer.disconnect();
        root.removeEventListener("pointerenter", onEnter);
        root.removeEventListener("pointermove", onMove);
        root.removeEventListener("pointerleave", onLeave);
        if (glowEl) glowEl.remove();
        root.classList.remove("shiny-text");
        root.style.backgroundImage = "";
      }
    };
  }

  global.ShinyText = ShinyText;
})(window);
