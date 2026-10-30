/* LogoLoop — vanilla JS port of React Bits <LogoLoop /> (JS-CSS variant, "line" layout).
   Supported: speed, direction (left|right|up|down), logoHeight, gap, hoverSpeed / pauseOnHover, fadeOut,
   fadeOutWidth, scaleOnHover, muted, labels (none|side|below|hover), per-logo hoverColor.
   Not ported: drag, orbit layout, bend, magnify, focus, step.
   Usage: var ll = LogoLoop(el, { logos: [{ html: "<svg…>", title: "Flutter", href: "…", hoverColor: "#02569B" }], speed: 60 });  ll.destroy(); */
(function (global) {
  var SMOOTH_TAU = 0.25;
  var DEFAULTS = {
    logos: [], speed: 120, direction: "left", logoHeight: 28, gap: 32, pauseOnHover: false, hoverSpeed: undefined,
    fadeOut: true, fadeOutWidth: 0.12, scaleOnHover: false, muted: 0, labels: "none", ariaLabel: "Logos"
  };

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function smootherstep(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  function fadeMask(size, vertical) {
    var span = clamp(size, 0, 0.5) * 100, stops = [], i;
    if (span <= 0) return "";
    for (i = 0; i <= 12; i++) stops.push("rgba(0,0,0," + smootherstep(i / 12).toFixed(4) + ") " + ((span * i) / 12).toFixed(3) + "%");
    for (i = 12; i >= 0; i--) stops.push("rgba(0,0,0," + smootherstep(i / 12).toFixed(4) + ") " + (100 - (span * i) / 12).toFixed(3) + "%");
    return "linear-gradient(" + (vertical ? "to bottom" : "to right") + ", " + stops.join(", ") + ")";
  }

  function LogoLoop(root, options) {
    if (!root) return { update: function () {}, destroy: function () {} };
    var o = Object.assign({}, DEFAULTS, options || {});
    var vertical = o.direction === "up" || o.direction === "down";
    var sign = o.direction === "right" || o.direction === "down" ? 1 : -1;
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var hoverSpeed = o.hoverSpeed !== undefined ? o.hoverSpeed : o.pauseOnHover ? 0 : undefined;

    root.className = "logoloop" + (vertical ? " logoloop--vertical" : "") + (o.scaleOnHover ? " logoloop--scale-hover" : "");
    root.style.setProperty("--logoloop-gap", o.gap + "px");
    root.style.setProperty("--logoloop-logoHeight", o.logoHeight + "px");
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", o.ariaLabel);
    if (o.labels !== "none") root.setAttribute("data-labels", o.labels);
    if (o.muted > 0) { root.setAttribute("data-muted", ""); root.style.setProperty("--logoloop-dim", String(1 - clamp(o.muted, 0, 1) * 0.6)); }
    var mask = o.fadeOut ? fadeMask(o.fadeOutWidth, vertical) : "";
    if (mask) { root.style.webkitMaskImage = mask; root.style.maskImage = mask; }

    var track = document.createElement("div");
    track.className = "logoloop__track";
    root.textContent = "";
    root.appendChild(track);

    function buildList(hidden) {
      var ul = document.createElement("ul");
      ul.className = "logoloop__list";
      ul.setAttribute("role", "list");
      if (hidden) ul.setAttribute("aria-hidden", "true");
      o.logos.forEach(function (logo) {
        var li = document.createElement("li");
        li.className = "logoloop__item";
        li.setAttribute("role", "listitem");
        if (logo.hoverColor) { li.setAttribute("data-color", ""); li.style.setProperty("--logoloop-item-color", logo.hoverColor); }
        var c = document.createElement(logo.href ? "a" : "span");
        c.className = "logoloop__content";
        if (logo.href) { c.href = logo.href; c.target = "_blank"; c.rel = "noopener noreferrer"; if (hidden) c.tabIndex = -1; }
        var label = logo.title || logo.alt || "";
        if (label && !hidden) c.setAttribute("aria-label", label);
        var node = document.createElement("span");
        node.className = "logoloop__node";
        node.setAttribute("aria-hidden", "true");
        if (logo.html) node.innerHTML = logo.html;
        else if (logo.src) { var img = document.createElement("img"); img.src = logo.src; img.alt = ""; img.loading = "lazy"; img.draggable = false; node.appendChild(img); }
        c.appendChild(node);
        if (label && (o.labels === "side" || o.labels === "below")) {
          var t = document.createElement("span"); t.className = "logoloop__label"; t.textContent = label; c.appendChild(t);
        }
        li.appendChild(c);
        if (label && o.labels === "hover") {
          var tip = document.createElement("span"); tip.className = "logoloop__tip"; tip.setAttribute("aria-hidden", "true"); tip.textContent = label; li.appendChild(tip);
        }
        ul.appendChild(li);
      });
      return ul;
    }

    var offset = 0, velocity = 0, period = 0, hovered = false, visible = true, raf = 0, last = 0;

    function apply() {
      var p = -offset;
      track.style.transform = vertical ? "translate3d(0," + p + "px,0)" : "translate3d(" + p + "px,0,0)";
    }

    function layout() {
      track.textContent = "";
      track.appendChild(buildList(false));
      var rect = track.firstChild.getBoundingClientRect();
      period = (vertical ? rect.height : rect.width) + (vertical ? 0 : 0);
      var view = vertical ? root.clientHeight || window.innerHeight : root.clientWidth;
      var copies = period > 0 ? Math.ceil(view / period) + 1 : 1;
      for (var i = 0; i < copies; i++) track.appendChild(buildList(true));
      offset = period > 0 ? ((offset % period) + period) % period : 0;
      apply();
    }

    function tick(now) {
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      var target = reduce ? 0 : (hovered && hoverSpeed !== undefined ? hoverSpeed : o.speed) * -sign;
      velocity += (target - velocity) * (1 - Math.exp(-dt / SMOOTH_TAU));
      if (period > 0) { offset += velocity * dt; offset = ((offset % period) + period) % period; apply(); }
      raf = visible ? requestAnimationFrame(tick) : 0;
    }
    function start() { if (!raf && visible && !reduce) { last = performance.now(); raf = requestAnimationFrame(tick); } }

    root.addEventListener("mouseenter", function () { hovered = true; });
    root.addEventListener("mouseleave", function () { hovered = false; });
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) start(); }) : null;
    if (io) io.observe(root);
    var ro = new ResizeObserver(layout);
    ro.observe(root);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    layout();
    start();

    return {
      update: function (next) { Object.assign(o, next || {}); layout(); },
      destroy: function () { if (raf) cancelAnimationFrame(raf); if (io) io.disconnect(); ro.disconnect(); }
    };
  }

  global.LogoLoop = LogoLoop;
})(window);
