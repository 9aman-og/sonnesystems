(function () {
  "use strict";

  /*
    TEMPORAL SIGNAL DEMO
    Transparent browser-side measurements, intentionally not presented as a model.
  */

  var canvas = document.getElementById("demoCanvas");
  if (!canvas) return;

  var context = canvas.getContext("2d", { willReadFrequently: true });
  var input = document.getElementById("imageInput");
  var dropzone = document.querySelector("[data-dropzone]");
  var demoView = document.querySelector("[data-demo-view]");
  var status = document.querySelector("[data-demo-status]");
  var runButton = document.querySelector("[data-run]");
  var sampleButton = document.querySelector("[data-sample]");
  var resetButton = document.querySelector("[data-reset]");
  var result = document.querySelector("[data-result]");
  var resultLabel = document.querySelector("[data-result-label]");
  var imageReady = false;
  var running = false;
  var timelineTimer = null;
  var targetEvidence = { structure: 0, texture: 0, contrast: 0 };

  function setStatus(text, live) {
    status.textContent = text;
    status.classList.toggle("is-live", Boolean(live));
  }

  function setEvidence(name, value) {
    var safe = Math.max(0, Math.min(100, Math.round(value)));
    var fill = document.querySelector('[data-evidence="' + name + '"]');
    var output = document.querySelector('[data-output="' + name + '"]');
    if (fill) fill.style.setProperty("--value", safe + "%");
    if (output) output.textContent = safe + "%";
  }

  function clearEvidence() {
    ["structure", "texture", "contrast"].forEach(function (name) { setEvidence(name, 0); });
  }

  function drawContained(image) {
    var width = canvas.width;
    var height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#050505";
    context.fillRect(0, 0, width, height);
    var scale = Math.min(width / image.width, height / image.height);
    var drawWidth = image.width * scale;
    var drawHeight = image.height * scale;
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    analysePixels();
  }

  function analysePixels() {
    var sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 96;
    sampleCanvas.height = 72;
    var sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
    sampleContext.drawImage(canvas, 0, 0, 96, 72);
    var pixels = sampleContext.getImageData(0, 0, 96, 72).data;
    var values = [];
    var min = 255;
    var max = 0;
    var sum = 0;

    for (var i = 0; i < pixels.length; i += 4) {
      var luminance = pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
      values.push(luminance);
      min = Math.min(min, luminance);
      max = Math.max(max, luminance);
      sum += luminance;
    }

    var mean = sum / values.length;
    var variance = 0;
    var edges = 0;
    for (var y = 1; y < 71; y += 1) {
      for (var x = 1; x < 95; x += 1) {
        var index = y * 96 + x;
        variance += Math.pow(values[index] - mean, 2);
        edges += Math.abs(values[index] - values[index - 1]) + Math.abs(values[index] - values[index - 96]);
      }
    }

    variance /= values.length;
    edges /= (94 * 70 * 2);
    targetEvidence.structure = Math.min(96, 20 + edges * 2.25);
    targetEvidence.texture = Math.min(94, 16 + Math.sqrt(variance) * 2.05);
    targetEvidence.contrast = Math.min(98, 12 + (max - min) * 0.34);
  }

  function acceptImage(image) {
    drawContained(image);
    imageReady = true;
    running = false;
    dropzone.classList.add("has-image");
    runButton.disabled = false;
    resetButton.hidden = false;
    sampleButton.hidden = true;
    resultLabel.textContent = "System state";
    result.textContent = "Signal ready";
    setStatus("Signal loaded", false);
    clearEvidence();
  }

  function loadFile(file) {
    if (!file || !file.type.match(/^image\/(png|jpeg|webp)$/)) {
      setStatus("Choose PNG, JPEG or WebP", false);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () { acceptImage(image); };
      image.onerror = function () { setStatus("Image could not be read", false); };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function makeSample() {
    var sample = document.createElement("canvas");
    sample.width = 800;
    sample.height = 600;
    var sampleContext = sample.getContext("2d");
    var gradient = sampleContext.createRadialGradient(520, 250, 20, 400, 300, 520);
    gradient.addColorStop(0, "#ffb39f");
    gradient.addColorStop(0.28, "#7b3429");
    gradient.addColorStop(1, "#050505");
    sampleContext.fillStyle = gradient;
    sampleContext.fillRect(0, 0, 800, 600);
    sampleContext.strokeStyle = "rgba(255, 238, 230, 0.72)";
    sampleContext.lineWidth = 2;
    for (var i = 0; i < 18; i += 1) {
      sampleContext.beginPath();
      sampleContext.arc(470, 300, 32 + i * 14, i * 0.27, Math.PI * (1.1 + i * 0.04));
      sampleContext.stroke();
    }
    for (var j = 0; j < 90; j += 1) {
      var angle = j * 2.399;
      var radius = 18 + j * 2.5;
      var x = 470 + Math.cos(angle) * radius;
      var y = 300 + Math.sin(angle) * radius * 0.62;
      sampleContext.fillStyle = j % 4 === 0 ? "#fff2ec" : "#ff8266";
      sampleContext.fillRect(x, y, j % 4 === 0 ? 3 : 1.5, j % 4 === 0 ? 3 : 1.5);
    }
    var image = new Image();
    image.onload = function () { acceptImage(image); };
    image.src = sample.toDataURL("image/png");
  }

  function runTimeline() {
    if (!imageReady || running) return;
    running = true;
    runButton.disabled = true;
    demoView.classList.add("is-running");
    setStatus("Integrating events", true);
    resultLabel.textContent = "Current step";
    result.textContent = "Detecting change";
    clearEvidence();

    var step = 0;
    var steps = 12;
    timelineTimer = window.setInterval(function () {
      step += 1;
      var progress = step / steps;
      var eased = 1 - Math.pow(1 - progress, 2.4);
      setEvidence("structure", targetEvidence.structure * eased);
      setEvidence("texture", targetEvidence.texture * Math.max(0, (progress - 0.08) / 0.92));
      setEvidence("contrast", targetEvidence.contrast * Math.max(0, (progress - 0.16) / 0.84));

      if (step === 4) result.textContent = "Encoding events";
      if (step === 8) result.textContent = "Testing stability";
      if (step < steps) return;

      window.clearInterval(timelineTimer);
      running = false;
      demoView.classList.remove("is-running");
      setStatus("Stable at step " + steps, false);
      resultLabel.textContent = "Exit condition";
      result.textContent = "Evidence stabilised";
      runButton.disabled = false;
      runButton.querySelector("span").textContent = "Run again";
    }, 130);
  }

  function reset() {
    window.clearInterval(timelineTimer);
    imageReady = false;
    running = false;
    context.fillStyle = "#050505";
    context.fillRect(0, 0, canvas.width, canvas.height);
    dropzone.classList.remove("has-image", "is-dragging");
    demoView.classList.remove("is-running");
    runButton.disabled = true;
    runButton.querySelector("span").textContent = "Run timeline";
    resetButton.hidden = true;
    sampleButton.hidden = false;
    input.value = "";
    clearEvidence();
    setStatus("Awaiting signal", false);
    resultLabel.textContent = "System state";
    result.textContent = "Load a signal";
  }

  input.addEventListener("change", function (event) { loadFile(event.target.files[0]); });
  runButton.addEventListener("click", runTimeline);
  sampleButton.addEventListener("click", makeSample);
  resetButton.addEventListener("click", reset);
  dropzone.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
  ["dragenter", "dragover"].forEach(function (name) {
    dropzone.addEventListener(name, function (event) { event.preventDefault(); dropzone.classList.add("is-dragging"); });
  });
  ["dragleave", "drop"].forEach(function (name) {
    dropzone.addEventListener(name, function (event) { event.preventDefault(); dropzone.classList.remove("is-dragging"); });
  });
  dropzone.addEventListener("drop", function (event) { loadFile(event.dataTransfer.files[0]); });
  reset();
})();
