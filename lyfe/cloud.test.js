"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let requests = [];
let response = {
  ok: true,
  status: 200,
  async json() {
    return {
      result: { bubbles: ["Ready."], actions: [], assumption: "" },
      provider: "groq",
      model: "openai/gpt-oss-120b",
    };
  },
};

const session = {
  access_token: "signed-user-jwt",
  user: { id: "u1", email: "owner@example.com", user_metadata: { name: "Owner" } },
};

const auth = {
  onAuthStateChange() {},
  async getSession() { return { data: { session }, error: null }; },
  async refreshSession() { return { data: { session }, error: null }; },
};

global.window = {
  LYFE_SUPABASE: {
    url: "https://project.supabase.co",
    anonKey: "sb_publishable_test_key_that_is_long_enough",
    aeroGatewayEnabled: true,
  },
  supabase: { createClient: () => ({ auth }) },
  dispatchEvent() {},
};
global.fetch = async (url, options) => {
  requests.push({ url, options });
  return response;
};
global.CustomEvent = function CustomEvent() {};
global.location = { search: "", hash: "", origin: "https://sonnesystems.com", pathname: "/lyfe/" };
global.history = { replaceState() {} };

vm.runInThisContext(fs.readFileSync(path.join(__dirname, "cloud.js"), "utf8"), {
  filename: "cloud.js",
});

(async () => {
  const result = await window.LyfeCloud.invokeAero({ prompt: "Explain routing", date: "2026-08-21", kind: "general" });
  assert.equal(result.provider, "groq");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://project.supabase.co/functions/v1/aero-groq");
  assert.equal(requests[0].options.headers.authorization, "Bearer signed-user-jwt");
  assert.equal(requests[0].options.headers.apikey, window.LYFE_SUPABASE.anonKey);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    prompt: "Explain routing",
    date: "2026-08-21",
    kind: "general",
  });

  response = {
    ok: false,
    status: 429,
    async json() { return { error: "provider_rate_limited" }; },
  };
  await assert.rejects(
    () => window.LyfeCloud.invokeAero({ prompt: "Again" }),
    (error) => error.status === 429 && error.code === "provider_rate_limited",
  );

  console.log("Lyfe cloud gateway checks passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
