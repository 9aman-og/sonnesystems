(function () {
  "use strict";

  /* Browser-only SSE1 paper decryption. The passphrase never leaves this page. */
  var passwordInput = document.getElementById("paperPassword");
  var message = document.querySelector("[data-vault-message]");
  var toggle = document.querySelector("[data-toggle-password]");
  var paperButtons = Array.from(document.querySelectorAll("[data-paper]"));
  var encoder = new TextEncoder();

  function setMessage(text) { message.textContent = text; }
  function setBusy(button, busy) {
    paperButtons.forEach(function (item) { item.disabled = busy; });
    button.textContent = busy ? "Decrypting..." : "Decrypt paper";
  }

  async function decryptPaper(button) {
    var password = passwordInput.value;
    if (!password) {
      setMessage("Enter the access passphrase first.");
      passwordInput.focus();
      return;
    }

    setBusy(button, true);
    setMessage("Deriving the local decryption key...");
    try {
      var response = await fetch(button.dataset.paper, { cache: "no-store" });
      if (!response.ok) throw new Error("The encrypted file could not be loaded.");
      var raw = new Uint8Array(await response.arrayBuffer());
      var signature = String.fromCharCode(raw[0], raw[1], raw[2], raw[3]);
      if (signature !== "SSE1" || raw.length < 49) throw new Error("This file is not a valid Sonne archive.");

      var salt = raw.slice(4, 20);
      var iv = raw.slice(20, 32);
      var ciphertext = raw.slice(32);
      var material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
      var key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 310000, hash: "SHA-256" },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );
      var plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
      var url = URL.createObjectURL(new Blob([plain], { type: "application/pdf" }));
      var link = document.createElement("a");
      link.href = url;
      link.download = button.dataset.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      setMessage("Paper decrypted locally. The download is ready.");
    } catch (error) {
      setMessage(error.name === "OperationError" ? "That passphrase did not unlock this paper." : error.message);
    } finally {
      setBusy(button, false);
    }
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      toggle.textContent = showing ? "Show" : "Hide";
    });
  }
  paperButtons.forEach(function (button) { button.addEventListener("click", function () { decryptPaper(button); }); });
})();
