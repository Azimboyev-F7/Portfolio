/* AnimatedContent — vanilla JS port of React Bits <AnimatedContent /> (JS-CSS variant). Needs GSAP + ScrollTrigger.
   Usage: var ac = AnimatedContent(el, { distance: 100, stagger: 0.08, ... });  ac.destroy();
          AnimatedContent.init("[data-animated]", defaults);   // reads data-ac-* attributes per element  */
(function (global) {
  var WIPES = {
    up: "linear-gradient(to top, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))",
    down: "linear-gradient(to bottom, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))",
    left: "linear-gradient(to left, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))",
    right: "linear-gradient(to right, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))",
    center: "radial-gradient(farthest-corner at 50% 50%, #000 calc(var(--ac-wipe) * 140% - 40%), transparent calc(var(--ac-wipe) * 140%))"
  };
  var DEFAULTS = {
    container: null, distance: 100, direction: "vertical", reverse: false, duration: 0.8, ease: "power3.out",
    initialOpacity: 0, animateOpacity: true, scale: 1, blur: 0, rotate: 0, tilt: 0, wipe: "none",
    threshold: 0.1, delay: 0, stagger: 0, staggerFrom: "start", trigger: "scroll", once: true, scrub: false,
    disappearAfter: 0, disappearDuration: 0.5, disappearEase: "power3.in",
    onStart: null, onComplete: null, onDisappearanceComplete: null
  };
  var RUNNING = "ac-running";

  function AnimatedContent(el, options) {
    var gsap = global.gsap, ScrollTrigger = global.ScrollTrigger;
    if (!el || !gsap || !ScrollTrigger) {
      if (el) el.style.visibility = "visible";
      return { destroy: function () {} };
    }
    gsap.registerPlugin(ScrollTrigger);
    var o = Object.assign({}, DEFAULTS, options || {});
    var scroller = o.container || document.getElementById("snap-main-container") || null;
    if (typeof scroller === "string") scroller = document.querySelector(scroller);
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    var ctx = gsap.context(function () {
      var targets = o.stagger > 0 && el.children.length ? Array.prototype.slice.call(el.children) : [el];
      var horizontal = o.direction === "horizontal";
      var axis = horizontal ? "x" : "y";
      var sign = o.reverse ? -1 : 1;
      var mask = WIPES[o.wipe];

      gsap.set(el, { visibility: "visible" });
      if (reduce) { if (o.onComplete) o.onComplete(); return; }

      var from = { scale: o.scale, opacity: o.animateOpacity ? o.initialOpacity : 1 };
      var to = { scale: 1, opacity: 1, duration: o.duration, ease: o.ease };
      from[axis] = o.distance * sign;
      to[axis] = 0;

      if (o.blur > 0) { from.filter = "blur(" + o.blur + "px)"; to.filter = "blur(0px)"; }
      if (o.rotate) { from.rotation = o.rotate * sign; to.rotation = 0; }
      if (o.tilt) {
        var tiltAxis = horizontal ? "rotationY" : "rotationX";
        from[tiltAxis] = horizontal ? -o.tilt * sign : o.tilt * sign;
        to[tiltAxis] = 0;
        from.transformPerspective = 900;
        to.transformPerspective = 900;
      }
      if (mask) {
        gsap.set(targets, { maskImage: mask, webkitMaskImage: mask });
        from["--ac-wipe"] = 0;
        to["--ac-wipe"] = 1;
      }
      if (o.stagger > 0) to.stagger = { each: o.stagger, from: o.staggerFrom };

      function settle() {
        targets.forEach(function (t) { t.classList.remove(RUNNING); });
        if (o.scrub) return;
        gsap.set(targets, { clearProps: mask ? "filter,transform,maskImage,webkitMaskImage" : "filter,transform" });
      }

      function disappear() {
        if (o.disappearAfter <= 0) return;
        var out = {
          scale: 0.8, opacity: o.animateOpacity ? o.initialOpacity : 0,
          delay: o.disappearAfter, duration: o.disappearDuration, ease: o.disappearEase,
          onComplete: function () { if (o.onDisappearanceComplete) o.onDisappearanceComplete(); }
        };
        out[axis] = -o.distance * sign;
        if (o.blur > 0) out.filter = "blur(" + o.blur + "px)";
        if (o.stagger > 0) out.stagger = { each: o.stagger, from: o.staggerFrom };
        gsap.to(targets, out);
      }

      var tl = gsap.timeline({
        paused: true,
        onStart: function () {
          targets.forEach(function (t) { t.classList.add(RUNNING); });
          if (o.onStart) o.onStart();
        },
        onComplete: function () {
          if (o.onComplete) o.onComplete();
          settle();
          if (o.once && !o.scrub) disappear();
        }
      });
      tl.fromTo(targets, from, to, o.scrub ? 0 : Math.max(o.delay, 0));

      if (o.trigger === "mount") { tl.play(); return; }

      var start = "top " + (1 - o.threshold) * 100 + "%";
      if (o.scrub) {
        ScrollTrigger.create({
          trigger: el, scroller: scroller, start: start,
          end: "top " + Math.max((1 - o.threshold) * 100 - 45, 5) + "%",
          scrub: o.scrub === true ? true : Math.max(Number(o.scrub) || 0, 0.01),
          animation: tl
        });
        return;
      }
      ScrollTrigger.create({
        trigger: el, scroller: scroller, start: start, once: o.once,
        onEnter: function () { tl.play(); },
        onLeaveBack: o.once ? undefined : function () {
          if (mask) gsap.set(targets, { maskImage: mask, webkitMaskImage: mask });
          tl.reverse();
        }
      });
    }, el);

    return { destroy: function () { ctx.revert(); } };
  }

  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }

  // Apply to every element matching `selector`; per-element overrides come from data-ac-* attributes.
  AnimatedContent.init = function (selector, defaults) {
    return Array.prototype.map.call(document.querySelectorAll(selector), function (el) {
      var d = el.dataset, opts = Object.assign({}, defaults || {});
      if (d.acDistance != null) opts.distance = num(d.acDistance, opts.distance);
      if (d.acDirection) opts.direction = d.acDirection;
      if (d.acDuration != null) opts.duration = num(d.acDuration, opts.duration);
      if (d.acStagger != null) opts.stagger = num(d.acStagger, opts.stagger);
      if (d.acDelay != null) opts.delay = num(d.acDelay, opts.delay);
      if (d.acBlur != null) opts.blur = num(d.acBlur, opts.blur);
      if (d.acScale != null) opts.scale = num(d.acScale, opts.scale);
      if (d.acThreshold != null) opts.threshold = num(d.acThreshold, opts.threshold);
      if (d.acEase) opts.ease = d.acEase;
      return AnimatedContent(el, opts);
    });
  };

  global.AnimatedContent = AnimatedContent;
})(window);
