(function () {
  var root = document.documentElement;

  // Theme toggle (persists the choice; falls back to system preference)
  var themeBtn = document.getElementById("theme-toggle");
  themeBtn.addEventListener("click", function () {
    var current =
      root.getAttribute("data-theme") ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  });

  // Mobile menu
  var menuBtn = document.getElementById("menu-toggle");
  var links = document.getElementById("nav-links");
  function setMenu(open) {
    links.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  menuBtn.addEventListener("click", function () {
    setMenu(!links.classList.contains("is-open"));
  });
  links.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });

  // Header border on scroll
  var header = document.querySelector(".site-header");
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 8); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Reveal on scroll
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("is-visible");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // Highlight current section in nav
  var sections = document.querySelectorAll("main section[id]");
  var navLinks = links.querySelectorAll("a");
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          navLinks.forEach(function (a) {
            a.toggleAttribute("aria-current", a.getAttribute("href") === "#" + en.target.id);
          });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  document.getElementById("year").textContent = new Date().getFullYear();
})();
