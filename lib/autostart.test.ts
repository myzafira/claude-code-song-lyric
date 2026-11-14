import { test } from "node:test";
import assert from "node:assert/strict";
import { hasStarted, nextAutostartStep, YT_STATE } from "./autostart.ts";

test("a clip that is playing or buffering is left alone", () => {
  assert.equal(nextAutostartStep(YT_STATE.PLAYING, 0), "none");
  assert.equal(nextAutostartStep(YT_STATE.BUFFERING, 0), "none");
});

test("a clip the singer paused is not restarted", () => {
  assert.equal(hasStarted(YT_STATE.PAUSED), true);
  assert.equal(nextAutostartStep(YT_STATE.PAUSED, 0), "none");
});

test("an unstarted or cued clip gets play pressed after the delay", () => {
  assert.equal(nextAutostartStep(YT_STATE.UNSTARTED, 0), "play");
  assert.equal(nextAutostartStep(YT_STATE.CUED, 0), "play");
  assert.equal(nextAutostartStep(undefined, 0), "play");
});

test("if play was blocked, fall back to muted play once, then give up", () => {
  assert.equal(nextAutostartStep(YT_STATE.UNSTARTED, 1), "play-muted");
  assert.equal(nextAutostartStep(YT_STATE.UNSTARTED, 2), "none");
  assert.equal(nextAutostartStep(YT_STATE.PLAYING, 1), "none");
});
