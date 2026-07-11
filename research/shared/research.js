(function () {
  "use strict";

  var STORAGE_KEY = "lang";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var motionPaused = reduceMotion;

  function getDictionary(lang) {
    var all = window.PAGE_I18N || {};
    return all[lang] || all.hu || all.en || {};
  }

  function applyValue(el, value, html) {
    if (typeof value !== "string") return;
    if (html) el.innerHTML = value;
    else el.textContent = value;
  }

  function setLanguage(lang) {
    if (lang !== "hu" && lang !== "en") lang = "hu";
    var dict = getDictionary(lang);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      applyValue(el, dict[el.getAttribute("data-i18n")], false);
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      applyValue(el, dict[el.getAttribute("data-i18n-html")], true);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var value = dict[el.getAttribute("data-i18n-aria")];
      if (typeof value === "string") el.setAttribute("aria-label", value);
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var value = dict[el.getAttribute("data-i18n-title")];
      if (typeof value === "string") el.setAttribute("title", value);
    });

    document.querySelectorAll("[data-lang]").forEach(function (button) {
      var active = button.getAttribute("data-lang") === lang;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    document.documentElement.lang = lang;
    if (typeof dict.title === "string") document.title = dict.title;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (error) {}
    document.dispatchEvent(new CustomEvent("research:language", { detail: { lang: lang, dict: dict } }));
  }

  function preferredLanguage() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "hu" || stored === "en") return stored;
    } catch (error) {}
    var nav = String(navigator.language || "").toLowerCase();
    return nav.indexOf("en") === 0 ? "en" : "hu";
  }

  function initLanguage() {
    document.querySelectorAll("[data-lang]").forEach(function (button) {
      button.addEventListener("click", function () {
        setLanguage(button.getAttribute("data-lang"));
      });
    });
    setLanguage(preferredLanguage());
  }

  function initTabs() {
    document.querySelectorAll("[data-tab-target]").forEach(function (button) {
      button.addEventListener("click", function () {
        var target = button.getAttribute("data-tab-target");
        var scope = button.closest("[data-tabs]") || document;
        scope.querySelectorAll("[data-tab-target]").forEach(function (candidate) {
          var active = candidate === button;
          candidate.classList.toggle("active", active);
          candidate.setAttribute("aria-selected", active ? "true" : "false");
          candidate.setAttribute("tabindex", active ? "0" : "-1");
        });
        scope.querySelectorAll("[data-tab-panel]").forEach(function (panel) {
          var active = panel.getAttribute("data-tab-panel") === target;
          panel.hidden = !active;
        });
        document.dispatchEvent(new CustomEvent("research:tab", { detail: { target: target } }));
      });
      button.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        var scope = button.closest("[data-tabs]") || document;
        var buttons = Array.prototype.slice.call(scope.querySelectorAll("[data-tab-target]"));
        var index = buttons.indexOf(button);
        var next = event.key === "ArrowRight" ? index + 1 : index - 1;
        if (next < 0) next = buttons.length - 1;
        if (next >= buttons.length) next = 0;
        buttons[next].focus();
        buttons[next].click();
      });
    });
  }

  function initReveal() {
    var elements = document.querySelectorAll("[data-reveal]");
    if (!elements.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      elements.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: "0px 0px -7% 0px" });
    elements.forEach(function (el) { observer.observe(el); });
  }

  function initProgress() {
    var progress = document.querySelector(".scroll-progress");
    if (!progress) {
      progress = document.createElement("div");
      progress.className = "scroll-progress";
      progress.setAttribute("aria-hidden", "true");
      document.body.appendChild(progress);
    }
    var update = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progress.style.width = (value * 100).toFixed(2) + "%";
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
  }

  function setMotion(paused) {
    motionPaused = !!paused;
    document.body.classList.toggle("motion-paused", motionPaused);
    document.querySelectorAll("[data-motion-toggle]").forEach(function (button) {
      button.setAttribute("aria-pressed", motionPaused ? "true" : "false");
      var key = motionPaused ? "motion_play" : "motion_pause";
      var dict = getDictionary(document.documentElement.lang || "hu");
      if (typeof dict[key] === "string") button.textContent = dict[key];
    });
    document.dispatchEvent(new CustomEvent("research:motion", { detail: { paused: motionPaused } }));
  }

  function initMotionToggle() {
    document.querySelectorAll("[data-motion-toggle]").forEach(function (button) {
      button.addEventListener("click", function () { setMotion(!motionPaused); });
    });
    setMotion(motionPaused);
    document.addEventListener("research:language", function () { setMotion(motionPaused); });
  }

  function initAmbientCanvas() {
    var canvas = document.querySelector("canvas.ambient-canvas");
    if (!canvas || !canvas.getContext || reduceMotion) return;
    var context = canvas.getContext("2d");
    var particles = [];
    var width = 0;
    var height = 0;
    var ratio = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      var count = Math.max(24, Math.min(68, Math.floor(width / 24)));
      particles = [];
      for (var i = 0; i < count; i += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: .5 + Math.random() * 1.25,
          vx: (Math.random() - .5) * .08,
          vy: -.025 - Math.random() * .075,
          alpha: .08 + Math.random() * .25
        });
      }
    }

    function frame() {
      context.clearRect(0, 0, width, height);
      if (!motionPaused) {
        particles.forEach(function (particle) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.y < -5) particle.y = height + 5;
          if (particle.x < -5) particle.x = width + 5;
          if (particle.x > width + 5) particle.x = -5;
        });
      }
      particles.forEach(function (particle) {
        context.beginPath();
        context.fillStyle = "rgba(111,255,175," + particle.alpha + ")";
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        context.fill();
      });
      window.requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    frame();
  }

  function init() {
    initLanguage();
    initTabs();
    initReveal();
    initProgress();
    initMotionToggle();
    initAmbientCanvas();
  }

  window.ResearchSite = {
    setLanguage: setLanguage,
    setMotion: setMotion
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
