const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// A deterministic hook runner lets these regressions control request completion
// order without network access or adding a DOM/testing-library dependency.
function createRunner(file, exportName, dependencies = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let dirty = false;
  let disposed = false;
  let writesAfterUnmount = 0;
  let args;
  let result;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (value) => {
          if (disposed) {
            writesAfterUnmount++;
            return;
          }
          slots[index] =
            typeof value === "function" ? value(slots[index]) : value;
          dirty = true;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (
        !previous ||
        deps.some((value, i) => !Object.is(value, previous.deps[i]))
      ) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const exports = {};
  const source = fs.readFileSync(
    path.join(__dirname, "../src/hooks", file),
    "utf8"
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    Error,
    window: dependencies.window,
    require: (name) => (name === "react" ? react : dependencies[name]),
  });
  function render(...nextArgs) {
    if (nextArgs.length) args = nextArgs;
    do {
      dirty = false;
      cursor = 0;
      effects = [];
      result = exports[exportName](...args);
      effects.forEach((effect) => effect());
    } while (dirty);
    return result;
  }
  return {
    render,
    unmount() {
      slots.forEach((slot) => slot?.cleanup?.());
      disposed = true;
    },
    get writesAfterUnmount() {
      return writesAfterUnmount;
    },
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));
const playlistRunner = () => createRunner("usePlaylists.ts", "usePlaylists");
const playlistArgs = (sourceKey, request, enabled = true) => ({
  sourceKey,
  enabled,
  fetchPlaylists: () => request.promise,
});

test("late Personal playlist errors cannot overwrite an organization's state", async () => {
  const runner = playlistRunner();
  const personal = deferred(),
    organization = deferred();
  runner.render(playlistArgs("personal", personal));
  runner.render(playlistArgs("organization", organization));
  personal.reject(new Error("Invalid or expired access token"));
  await settle();
  let state = runner.render();
  assert.equal(state.playlistError, null);
  assert.equal(state.isLoadingPlaylists, true);
  organization.resolve([{ id: "org-playlist", title: "Organization" }]);
  await settle();
  state = runner.render();
  assert.equal(state.playlists[0].id, "org-playlist");
  assert.equal(state.isLoadingPlaylists, false);
});

test("switching clears existing errors, options and selected playlists", async () => {
  const runner = playlistRunner();
  const first = deferred(),
    second = deferred();
  runner.render(playlistArgs("a", first));
  first.resolve([{ id: "a", title: "A" }]);
  await settle();
  runner.render().setSelectedPlaylistIds(["a"]);
  assert.equal(runner.render().selectedPlaylistIds.length, 1);
  let state = runner.render(playlistArgs("b", second));
  assert.equal(state.playlists.length, 0);
  assert.equal(state.selectedPlaylistIds.length, 0);
  second.reject(new Error("Current workspace error"));
  await settle();
  assert.match(runner.render().playlistError, /Current workspace error/);
  state = runner.render(playlistArgs("c", deferred()));
  assert.equal(state.playlistError, null);
});

test("a superseded refresh cannot overwrite a newer refresh", async () => {
  const runner = playlistRunner();
  const old = deferred(),
    newest = deferred();
  let request = old;
  const args = {
    sourceKey: "org",
    enabled: true,
    fetchPlaylists: () => request.promise,
  };
  runner.render(args);
  request = newest;
  void runner.render().loadPlaylists();
  newest.resolve([{ id: "newest", title: "Newest" }]);
  await settle();
  old.reject(new Error("Obsolete failure"));
  await settle();
  const state = runner.render();
  assert.equal(state.playlists[0].id, "newest");
  assert.equal(state.playlistError, null);
});

test("disabled and unmounted playlist hooks ignore pending responses", async () => {
  const runner = playlistRunner();
  const request = deferred();
  runner.render(playlistArgs("a", request));
  runner.render(playlistArgs("a", request, false));
  runner.unmount();
  request.reject(new Error("Late failure"));
  await settle();
  assert.equal(runner.writesAfterUnmount, 0);
});

test("channel responses are scoped to the selected workspace", async () => {
  const personal = deferred(),
    organization = deferred();
  const runner = createRunner(
    "useYoutubeConnection.tsx",
    "useYouTubeConnection",
    {
      window: { electronAPI: { getYouTubeChannel: () => personal.promise } },
      "@/api/youtube": {
        getOrganizationYouTubeConnection: () => organization.promise,
      },
    }
  );
  const org = { session: { user: { id: "user" }, access_token: "token" } };
  runner.render("local", org, { connected: true });
  let state = runner.render("organization", org, { connected: true });
  assert.equal(state.connection.connected, false);
  organization.resolve({
    connected: true,
    channel_id: "org-channel",
    channel_name: "Organization",
  });
  await settle();
  personal.reject(new Error("Old channel lookup failed"));
  await settle();
  state = runner.render();
  assert.equal(state.connection.channelId, "org-channel");
  assert.equal(state.error, null);
});

test("clearing a connection prevents pending requests from reconnecting it", async () => {
  const request = deferred();
  const runner = createRunner(
    "useYoutubeConnection.tsx",
    "useYouTubeConnection",
    {
      "@/api/youtube": {
        getOrganizationYouTubeConnection: () => request.promise,
      },
    }
  );
  runner
    .render(
      "organization",
      { session: { user: { id: "user" }, access_token: "token" } },
      { connected: false }
    )
    .clear();
  request.resolve({ connected: true, channel_id: "obsolete" });
  await settle();
  assert.equal(runner.render().connection.connected, false);
});
