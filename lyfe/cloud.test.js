"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let requests = [];
let rpcCalls = [];
let events = [];
let rpcResponse = { data: { applied: true, rev: 5, data: { rev: 5, settings: { apiKey: "" } } }, error: null };
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

const client = {
  auth,
  async rpc(name, args) {
    rpcCalls.push({ name, args });
    return rpcResponse;
  },
};

global.window = {
  LYFE_SUPABASE: {
    url: "https://project.supabase.co",
    anonKey: "sb_publishable_test_key_that_is_long_enough",
    aeroGatewayEnabled: true,
    aeroExecutionEnabled: true,
  },
  supabase: { createClient: () => client },
  dispatchEvent(event) { events.push(event); },
};
global.fetch = async (url, options) => {
  requests.push({ url, options });
  return response;
};
global.CustomEvent = function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; };
global.location = { search: "", hash: "", origin: "https://sonnesystems.com", pathname: "/lyfe/" };
global.history = { replaceState() {} };

vm.runInThisContext(fs.readFileSync(path.join(__dirname, "cloud.js"), "utf8"), {
  filename: "cloud.js",
});

(async () => {
  assert.equal(await window.LyfeCloud.init(), "cloud");
  const result = await window.LyfeCloud.invokeAero({ prompt: "Explain routing", date: "2026-08-21", kind: "general" });
  assert.equal(result.provider, "groq");
  const gatewayRequest = requests.at(-1);
  assert.equal(gatewayRequest.url, "https://project.supabase.co/functions/v1/aero-groq");
  assert.equal(gatewayRequest.options.headers.authorization, "Bearer signed-user-jwt");
  assert.equal(gatewayRequest.options.headers.apikey, window.LYFE_SUPABASE.anonKey);
  assert.deepEqual(JSON.parse(gatewayRequest.options.body), {
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

  response = {
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        runId: "22222222-2222-4222-8222-222222222222",
        contractDigest: "a".repeat(64),
        approvalToken: "memory-only-approval-token-that-is-long-enough",
        review: [{ type: "add_task", subject: "Ship" }],
      };
    },
  };
  const prepared = await window.LyfeCloud.prepareAeroRun({
    requestKey: "request-0001",
    intent: "Ship",
    actions: [{ type: "add_task", title: "Ship" }],
  });
  assert.equal(prepared.runId, "22222222-2222-4222-8222-222222222222");
  assert.equal(requests.at(-1).url, "https://project.supabase.co/functions/v1/aero-execute");
  assert.deepEqual(JSON.parse(requests.at(-1).options.body), {
    op: "prepare",
    requestKey: "request-0001",
    intent: "Ship",
    actions: [{ type: "add_task", title: "Ship" }],
  });

  response = {
    ok: false,
    status: 409,
    async json() { return { error: "state_changed" }; },
  };
  await assert.rejects(
    () => window.LyfeCloud.commitAeroRun({
      runId: prepared.runId,
      contractDigest: prepared.contractDigest,
      approvalToken: prepared.approvalToken,
    }),
    (error) => error.status === 409 && error.code === "state_changed" && /Review/.test(error.message),
  );

  rpcResponse = {
    data: { applied: true, rev: 5, data: { rev: 5, settings: { apiKey: "" }, tasks: [] } },
    error: null,
  };
  const pushed = await window.LyfeCloud.push({ rev: 5, settings: { apiKey: "device-secret" }, tasks: [] }, 5);
  assert.equal(pushed.applied, true);
  assert.equal(rpcCalls.at(-1).name, "lyfe_compare_and_swap_state");
  assert.equal(rpcCalls.at(-1).args.p_expected_rev, 4);
  assert.equal(rpcCalls.at(-1).args.p_data.settings.apiKey, "");

  rpcResponse = {
    data: { applied: false, error: "revision_conflict", rev: 7, data: { rev: 7, tasks: [{ id: "remote" }] } },
    error: null,
  };
  assert.equal(await window.LyfeCloud.push({ rev: 6, tasks: [] }, 6), false);
  assert.equal(events.at(-1).type, "lyfe:cloudconflict");
  assert.equal(events.at(-1).detail.rev, 7);

  console.log("Lyfe cloud gateway, execution, and CAS checks passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
