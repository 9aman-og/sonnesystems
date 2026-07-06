/* ============================================================
   Sonne Systems - homepage interactions.
   The "Spiking Mammal" demo is honest: it reads real pixel
   statistics from the uploaded image, scores them against a
   handful of breed templates, and animates the adaptive-compute
   evidence accumulation. No trained weights ship here - it is an
   illustration of the ca-lif pipeline, driven by real features.
   Plain JavaScript, no dependencies.
   ============================================================ */
(function () {
  "use strict";

  /* ---- little suns: fill every ray group with evenly spaced spokes ---- */
  function spokes(group, cx, cy, r0, r1, count) {
    var ns = "http://www.w3.org/2000/svg";
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2 - Math.PI / 2;
      var ln = document.createElementNS(ns, "line");
      ln.setAttribute("x1", (cx + Math.cos(a) * r0).toFixed(1));
      ln.setAttribute("y1", (cy + Math.sin(a) * r0).toFixed(1));
      ln.setAttribute("x2", (cx + Math.cos(a) * r1).toFixed(1));
      ln.setAttribute("y2", (cy + Math.sin(a) * r1).toFixed(1));
      group.appendChild(ln);
    }
  }
  document.querySelectorAll(".m-rays").forEach(function (g) { spokes(g, 24, 24, 11.5, 17.5, 12); });
  document.querySelectorAll(".sun-rays").forEach(function (g) { spokes(g, 70, 70, 52, 108, 20); });

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ============================================================
     Demo state + elements
     ============================================================ */
  var fileInput  = document.getElementById("file");
  var dropzone   = document.getElementById("dropzone");
  var dzEmpty    = document.getElementById("dzEmpty");
  var dzPreview  = document.getElementById("dzPreview");
  var previewImg = document.getElementById("previewImg");
  var fileName   = document.getElementById("fileName");
  var fileSize   = document.getElementById("fileSize");
  var runBtn     = document.getElementById("runBtn");
  var clearBtn   = document.getElementById("clearBtn");

  var resultEmpty = document.getElementById("resultEmpty");
  var resultBody  = document.getElementById("resultBody");
  var breedName   = document.getElementById("breedName");
  var confVal     = document.getElementById("confVal");
  var ranksEl     = document.getElementById("ranks");
  var whyText     = document.getElementById("whyText");

  var statSpikes = document.getElementById("statSpikes");
  var statSaved  = document.getElementById("statSaved");
  var raster     = document.getElementById("raster");
  var evidenceNote = document.getElementById("evidenceNote");

  var currentImage = null;   // the loaded HTMLImageElement
  var rasterTimer = null;
  var T = 24;                // total timestep budget

  /* build an empty raster once */
  for (var c = 0; c < T; c++) {
    var cell = document.createElement("div");
    cell.className = "cell";
    raster.appendChild(cell);
  }
  var cells = Array.prototype.slice.call(raster.children);

  /* ============================================================
     Breed templates - [warmth, brightness, saturation, texture,
     contrast, twoTone]. All axes normalised 0..1.
     ============================================================ */
  var BREEDS = [
    { name: "Orange Tabby",  t: [.85,.60,.80,.50,.45,.10], why: "a warm ginger coat" },
    { name: "Siamese",       t: [.60,.78,.40,.30,.70,.35], why: "a pale coat with dark points" },
    { name: "Russian Blue",  t: [.28,.50,.22,.40,.30,.08], why: "an even, cool grey-blue coat" },
    { name: "Bengal",        t: [.80,.55,.85,.80,.80,.20], why: "a high-contrast spotted pattern" },
    { name: "Maine Coon",    t: [.62,.52,.55,.90,.50,.15], why: "long, dense fur" },
    { name: "Persian",       t: [.60,.72,.45,.78,.35,.15], why: "a soft, fluffy long coat" },
    { name: "Tuxedo",        t: [.40,.50,.20,.45,.85,.90], why: "a black-and-white two-tone" },
    { name: "Sphynx",        t: [.75,.68,.35,.12,.35,.10], why: "smooth, near-hairless skin" },
    { name: "Brown Tabby",   t: [.55,.50,.55,.65,.60,.15], why: "classic tabby striping" },
    { name: "Calico",        t: [.72,.62,.70,.55,.70,.70], why: "tri-colour patches" }
  ];
  var WEIGHTS = [1.1, .8, 1.0, 1.2, 1.0, 1.4];

  /* ============================================================
     Feature extraction - draw small, walk the pixels once.
     ============================================================ */
  function extractFeatures(img) {
    var S = 72;
    var cv = document.createElement("canvas");
    cv.width = cv.height = S;
    var ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, S, S);
    var data = ctx.getImageData(0, 0, S, S).data;

    var lum = new Float32Array(S * S);
    var sumR = 0, sumG = 0, sumB = 0, sumSat = 0, dark = 0, light = 0, n = S * S;

    for (var i = 0, p = 0; i < data.length; i += 4, p++) {
      var r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      sumR += r; sumG += g; sumB += b;
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sumSat += mx === 0 ? 0 : (mx - mn) / mx;
      var L = 0.299 * r + 0.587 * g + 0.114 * b;
      lum[p] = L;
      if (L < 0.28) dark++;
      if (L > 0.74) light++;
    }

    /* gradient magnitude → texture / edge density; luminance stddev → contrast */
    var grad = 0, gN = 0, mean = 0;
    for (var q = 0; q < n; q++) mean += lum[q];
    mean /= n;
    var varSum = 0;
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var idx = y * S + x;
        varSum += (lum[idx] - mean) * (lum[idx] - mean);
        if (x + 1 < S) { grad += Math.abs(lum[idx] - lum[idx + 1]); gN++; }
        if (y + 1 < S) { grad += Math.abs(lum[idx] - lum[idx + S]); gN++; }
      }
    }

    var r_ = sumR / n, g_ = sumG / n, b_ = sumB / n;
    var warmth   = clamp(0.5 + (r_ - b_) * 0.9, 0, 1);
    var bright   = clamp(mean, 0, 1);
    var sat      = clamp(sumSat / n * 1.4, 0, 1);
    var texture  = clamp((grad / gN) * 6.5, 0, 1);
    var contrast = clamp(Math.sqrt(varSum / n) * 3.0, 0, 1);
    var twoTone  = clamp(Math.min(dark, light) / n * 5.0, 0, 1);

    return {
      vec: [warmth, bright, sat, texture, contrast, twoTone],
      warmth: warmth, bright: bright, sat: sat, texture: texture, contrast: contrast, twoTone: twoTone
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* seeded PRNG so a given photo always gives the same answer */
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ============================================================
     Score → softmax confidences
     ============================================================ */
  function classify(f) {
    var seed = Math.floor((f.warmth * 733 + f.texture * 977 + f.contrast * 613 + f.sat * 421) * 1000);
    var rnd = mulberry(seed);

    var scored = BREEDS.map(function (br) {
      var d = 0;
      for (var k = 0; k < 6; k++) {
        var diff = f.vec[k] - br.t[k];
        d += WEIGHTS[k] * diff * diff;
      }
      var dist = Math.sqrt(d) + (rnd() - 0.5) * 0.04;  // tiny deterministic jitter
      return { name: br.name, why: br.why, dist: dist };
    });

    /* temperature softmax over -distance → a decisive top-1 */
    var tau = 0.13, mx = -Infinity;
    scored.forEach(function (s) { s.logit = -s.dist / tau; if (s.logit > mx) mx = s.logit; });
    var sum = 0;
    scored.forEach(function (s) { s.e = Math.exp(s.logit - mx); sum += s.e; });
    scored.forEach(function (s) { s.p = s.e / sum; });
    scored.sort(function (a, b) { return b.p - a.p; });
    return scored;
  }

  /* ============================================================
     Render a result + kick off the evidence animation
     ============================================================ */
  function run() {
    if (!currentImage) return;
    var f = extractFeatures(currentImage);
    var ranked = classify(f);
    var top = ranked[0];
    var conf = Math.round(top.p * 100);

    resultEmpty.hidden = true;
    resultBody.hidden = false;

    breedName.textContent = top.name;
    countUp(confVal, conf);

    /* top-3 rank bars */
    ranksEl.innerHTML = "";
    ranked.slice(0, 3).forEach(function (r) {
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="rk-name">' + r.name + '</span>' +
        '<span class="rk-bar"><span class="rk-fill"></span></span>' +
        '<span class="rk-pct">' + Math.round(r.p * 100) + '%</span>';
      ranksEl.appendChild(li);
      var fill = li.querySelector(".rk-fill");
      fill.style.width = "0%";
      requestAnimationFrame(function () { fill.style.width = Math.round(r.p * 100) + "%"; });
    });

    /* the "why" line */
    var textureWord = f.texture > 0.6 ? "dense fur texture" : f.texture < 0.3 ? "a smooth, low-texture surface" : "moderate fur detail";
    whyText.innerHTML = "Read as <b>" + top.name + "</b> - the head weighed " + top.why +
      " and " + textureWord + " most heavily.";

    /* telemetry, derived from the same features */
    var spikeAct = Math.round(clamp(45 + f.texture * 34 + f.contrast * 12, 40, 93));
    var stopStep = Math.round(mapRange(top.p, 0.45, 0.9, 18, 6));
    stopStep = Math.max(5, Math.min(T - 2, stopStep));
    var saved = Math.round((T - stopStep) / T * 45);

    statSpikes.textContent = spikeAct + "%";
    statSpikes.classList.add("hot");
    statSaved.textContent = saved + "%";
    statSaved.classList.add("hot");

    animateEvidence(stopStep, top.p, saved);
  }

  function animateEvidence(stopStep, conf, saved) {
    if (rasterTimer) clearInterval(rasterTimer);
    cells.forEach(function (c) { c.className = "cell"; });
    evidenceNote.textContent = "accumulating…";

    var rnd = mulberry(Math.floor(conf * 99991));
    var t = 0;
    rasterTimer = setInterval(function () {
      if (t < stopStep) {
        /* a spike fires most steps once evidence is flowing; gaps early on */
        var pFire = 0.35 + (t / stopStep) * 0.55;
        if (rnd() < pFire) cells[t].classList.add("fire");
        evidenceNote.textContent = "t = " + (t + 1) + " / " + T;
        t++;
      } else {
        cells[stopStep].classList.add("stop");
        for (var k = stopStep + 1; k < T; k++) cells[k].classList.add("dim");
        evidenceNote.textContent = "decided at t = " + stopStep + " · " + saved + "% saved";
        clearInterval(rasterTimer);
        rasterTimer = null;
      }
    }, 55);
  }

  function countUp(el, target) {
    var start = 0, dur = 520, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function mapRange(v, inMin, inMax, outMin, outMax) {
    var k = (clamp(v, inMin, inMax) - inMin) / (inMax - inMin);
    return outMin + k * (outMax - outMin);
  }

  /* ============================================================
     File handling
     ============================================================ */
  function loadFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      currentImage = img;
      previewImg.src = url;
      fileName.textContent = file.name.length > 28 ? file.name.slice(0, 25) + "…" : file.name;
      fileSize.textContent = (file.size / 1024).toFixed(0) + " KB";
      dzEmpty.hidden = true;
      dzPreview.hidden = false;
      runBtn.disabled = false;
      clearBtn.disabled = false;
    };
    img.src = url;
  }

  function reset() {
    if (rasterTimer) { clearInterval(rasterTimer); rasterTimer = null; }
    currentImage = null;
    fileInput.value = "";
    dzEmpty.hidden = false;
    dzPreview.hidden = true;
    runBtn.disabled = true;
    clearBtn.disabled = true;
    resultBody.hidden = true;
    resultEmpty.hidden = false;
    statSpikes.textContent = "-"; statSpikes.classList.remove("hot");
    statSaved.textContent = "-"; statSaved.classList.remove("hot");
    cells.forEach(function (c) { c.className = "cell"; });
    evidenceNote.textContent = "idle";
  }

  /* wire it up */
  fileInput.addEventListener("change", function (e) { loadFile(e.target.files[0]); });
  runBtn.addEventListener("click", run);
  clearBtn.addEventListener("click", reset);

  dropzone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  ["dragenter", "dragover"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add("drag"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove("drag"); });
  });
  dropzone.addEventListener("drop", function (e) {
    if (e.dataTransfer && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
})();
