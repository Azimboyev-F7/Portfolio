/* ScrollExpand — vanilla JS port of React Bits <ScrollExpand /> (JS-CSS variant).
   The markup lives in the page (see [data-scroll-expand] in index.html); this script drives it.
   Usage: var se = ScrollExpand(el, { mediaZoom: 1.35, ... });  se.update({ ... });  se.destroy();  */
(function (global) {
  var DEFAULTS = {
    startWidth: 42, startHeight: 58, startRadius: 24, endRadius: 0, mediaZoom: 1.35,
    scrollDistance: 1.2, holdDistance: 0.35, smoothing: 0.1, overlayScrim: 0.45, scrimStart: 0,
    useWindowScroll: true, enabled: true
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function ScrollExpand(root, options) {
    if (!root) return { update: function () {}, destroy: function () {} };
    var cfg = Object.assign({}, DEFAULTS, options || {});
    var track = root.querySelector(".scroll-expand__track");
    var stage = root.querySelector(".scroll-expand__stage");
    var frame = root.querySelector(".scroll-expand__frame");
    var media = root.querySelector(".scroll-expand__media");
    var titleEl = root.querySelector(".scroll-expand__title");
    var overlay = root.querySelector(".scroll-expand__overlay");
    var scrim = root.querySelector(".scroll-expand__scrim");
    var hint = root.querySelector(".scroll-expand__hint");
    if (!track || !stage || !frame || !media) return { update: function () {}, destroy: function () {} };

    var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var raf = 0, current = 0, target = 0, stageH = 0, running = false;

    function applyProgress(p) {
      var e = smoothstep(0, 1, p);
      var w = cfg.startWidth + (100 - cfg.startWidth) * e;
      var h = cfg.startHeight + (100 - cfg.startHeight) * e;
      var ix = Math.max(0, (100 - w) / 2);
      var iy = Math.max(0, (100 - h) / 2);
      var r = cfg.startRadius + (cfg.endRadius - cfg.startRadius) * e;
      frame.style.clipPath = "inset(" + iy + "% " + ix + "% " + iy + "% " + ix + "% round " + r + "px)";
      media.style.transform = "scale(" + (cfg.mediaZoom + (1 - cfg.mediaZoom) * e) + ")";
      if (scrim) scrim.style.opacity = String(cfg.scrimStart + (cfg.overlayScrim - cfg.scrimStart) * e);
      if (titleEl) {
        var out = smoothstep(0.4, 0.88, p);
        titleEl.style.opacity = String(1 - out);
        titleEl.style.transform = "translate3d(0," + (-28 * out) + "px,0) scale(" + (1 + 0.06 * out) + ")";
      }
      if (hint) {
        var gone = smoothstep(0, 0.12, p);
        hint.style.opacity = String(1 - gone);
        hint.style.transform = "translate3d(0," + 8 * gone + "px,0)";
      }
      if (overlay) {
        var inn = smoothstep(0.68, 1, p);
        overlay.style.opacity = String(inn);
        overlay.style.transform = "translate3d(0," + 18 * (1 - inn) + "px,0)";
      }
    }

    function measure() {
      stageH = cfg.useWindowScroll ? window.innerHeight : root.clientHeight;
      if (stageH <= 0) return;
      stage.style.height = stageH + "px";
      track.style.height = stageH * (1 + Math.max(0, cfg.scrollDistance) + Math.max(0, cfg.holdDistance)) + "px";
      var w = root.clientWidth || stageH;
      stage.style.setProperty("--se-title-size", clamp(w * 0.075, 20, 84) + "px");
    }

    function readProgress() {
      if (!cfg.enabled) return 1;
      var span = stageH * Math.max(0.01, cfg.scrollDistance);
      if (cfg.useWindowScroll) return clamp(-track.getBoundingClientRect().top / span, 0, 1);
      return clamp(root.scrollTop / span, 0, 1);
    }

    function tick() {
      var k = cfg.smoothing <= 0 ? 1 : 1 - Math.exp(-1 / (60 * cfg.smoothing));
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.0004) { current = target; running = false; }
      applyProgress(current);
      raf = running ? requestAnimationFrame(tick) : 0;
    }

    function kick() {
      if (running) return;
      running = true;
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function onScroll() {
      target = readProgress();
      if (cfg.smoothing <= 0 || reduceMotion) { current = target; applyProgress(current); return; }
      kick();
    }

    function onResize() {
      measure();
      target = readProgress();
      current = target;
      applyProgress(current);
    }

    measure();
    target = readProgress();
    current = target;
    applyProgress(current);

    var scroller = cfg.useWindowScroll ? window : root;
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    var ro = new ResizeObserver(onResize);
    ro.observe(root);

    return {
      update: function (next) { Object.assign(cfg, next || {}); onResize(); },
      destroy: function () {
        if (raf) cancelAnimationFrame(raf);
        scroller.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        ro.disconnect();
      }
    };
  }

  global.ScrollExpand = ScrollExpand;
})(window);
