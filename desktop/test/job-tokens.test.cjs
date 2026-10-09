const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(
    path.join(__dirname, "../src/helpers", file),
    "utf8"
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (name) => dependencies[name],
      setTimeout,
      clearTimeout,
      AbortController,
      ...globals,
    }
  );
  return exports;
}

test("relay ignores stale jobs and other windows, then consumes the matching response", () => {
  const { WorkerTokens } = load("workerTokens.ts");
  const writes = [],
    requests = [];
  const relay = new WorkerTokens(
    "job",
    7,
    (msg) => writes.push(msg),
    (msg) => requests.push(msg)
  );
  relay.request("r");
  relay.respond(8, { jobId: "job", requestId: "r", access_token: "wrong" });
  relay.respond(7, { jobId: "old", requestId: "r", access_token: "wrong" });
  assert.equal(writes.length, 0);
  relay.respond(7, {
    jobId: "job",
    requestId: "r",
    access_token: "fresh",
    expires_at: "2099-01-01",
  });
  relay.respond(7, { jobId: "job", requestId: "r", access_token: "duplicate" });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].access_token, "fresh");
  assert.equal(requests[0].jobId, "job");
  relay.close();
});

test("relay times out and cancellation suppresses late responses", async () => {
  const { WorkerTokens } = load("workerTokens.ts");
  const writes = [];
  const relay = new WorkerTokens(
    "job",
    7,
    (msg) => writes.push(msg),
    () => {},
    10
  );
  relay.request("timeout");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(writes[0].error, /timed out/);
  relay.request("cancelled");
  relay.close();
  relay.respond(7, {
    jobId: "job",
    requestId: "cancelled",
    access_token: "late",
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(writes.length, 1);
});

function renderer(session, fetchToken) {
  let callback;
  const responses = [];
  const api = {
    onYouTubeTokenRequest(fn) {
      callback = fn;
      return () => {};
    },
    async respondYouTubeToken(response) {
      responses.push(response);
    },
  };
  const { listenForJobTokens } = load(
    "jobTokens.ts",
    {
      "./supabase": {
        supabase: {
          auth: {
            getSession: async () => ({ data: { session }, error: null }),
          },
        },
      },
      "../api/youtube": { createOrganizationYouTubeUploadSession: fetchToken },
    },
    { window: { electronAPI: api } }
  );
  const close = listenForJobTokens("job", {
    type: "organization",
    organization_id: "original-org",
    user_id: "user",
  });
  return {
    request: (jobId = "job") => callback({ jobId, requestId: "r" }),
    responses,
    close,
  };
}

test("renderer uses fresh app session and the original workspace for every renewal", async () => {
  const calls = [];
  const client = renderer(
    { user: { id: "user" }, access_token: "fresh-session" },
    async (...args) => {
      calls.push(args);
      return { access_token: "google-token", expires_at: "2099-01-01" };
    }
  );
  await client.request("other-job");
  await client.request();
  await client.request();
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "original-org");
  assert.equal(calls[0][1], "fresh-session");
  assert.equal(client.responses[0].expires_at, "2099-01-01");
  client.close();
});

test("signed-out or changed accounts cannot obtain tokens for the job", async () => {
  for (const session of [
    null,
    { user: { id: "different" }, access_token: "wrong" },
  ]) {
    const client = renderer(session, () => {
      throw new Error("must not fetch");
    });
    await client.request();
    assert.match(client.responses[0].error, /account that started/);
    client.close();
  }
});

test("cancellation aborts authorization and ignores its eventual response", async () => {
  let resolve, signal;
  const client = renderer(
    { user: { id: "user" }, access_token: "session" },
    (_org, _token, inputSignal) => {
      signal = inputSignal;
      return new Promise((done) => {
        resolve = done;
      });
    }
  );
  const pending = client.request();
  await new Promise((done) => setImmediate(done));
  client.close();
  assert.equal(signal.aborted, true);
  resolve({ access_token: "late", expires_at: "2099-01-01" });
  await pending;
  assert.equal(client.responses.length, 0);
});

function jobRunner() {
  let progressListener,
    resolve,
    reject,
    tokensClosed = 0,
    progressClosed = 0;
  const state = [];
  const pending = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const api = {
    onJobProgress(fn) {
      progressListener = fn;
      return () => {
        progressClosed++;
      };
    },
    startJob: () => pending,
    cancelJob: async () => {
      reject(new Error("worker terminated"));
    },
  };
  const { useJobRunner } = load(
    "../hooks/useJobRunner.ts",
    {
      react: {
        useState(initial) {
          const index = state.length;
          state.push(initial);
          return [
            initial,
            (value) => {
              state[index] = value;
            },
          ];
        },
        useRef: (initial) => ({ current: initial }),
        useEffect: () => {},
      },
      "../helpers/jobTokens": {
        listenForJobTokens: () => () => {
          tokensClosed++;
        },
      },
      "../helpers/notifications": { desktopNotification: () => {} },
      "@/api/organizations": {},
      "../helpers/supabase": {},
    },
    {
      window: { electronAPI: api },
      crypto: { randomUUID: () => "job" },
      console,
    }
  );
  return {
    runner: useJobRunner(),
    state,
    resolve,
    reject,
    progress: (message) => progressListener(message),
    get tokensClosed() {
      return tokensClosed;
    },
    get progressClosed() {
      return progressClosed;
    },
  };
}

const jobArgs = {
  youtubeAuth: { type: "local" },
  organizationId: null,
  videos: ["clip.mp4"],
  loadRenders: async () => {},
  title: "test",
};

test("recoverable warnings keep the job and renewal listeners running", async () => {
  const client = jobRunner();
  const pending = client.runner.startJob(jobArgs);
  client.progress({
    stage: "warning",
    message: "Upload interrupted. Retrying...",
  });
  assert.equal(client.state[1], true);
  assert.equal(client.tokensClosed, 0);
  assert.equal(client.progressClosed, 0);
  client.resolve({ success: true });
  await pending;
  assert.equal(client.state[1], false);
  assert.equal(client.tokensClosed, 1);
  assert.equal(client.progressClosed, 1);
});

test("cancellation remains visible instead of being overwritten by worker exit", async () => {
  const client = jobRunner();
  const pending = client.runner.startJob(jobArgs);
  await client.runner.cancelJob(async () => {});
  await pending;
  assert.equal(client.state[0].message, "Job cancelled.");
  assert.equal(client.state[1], false);
  assert.equal(client.progressClosed, 1);
});
