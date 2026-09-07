import assert from "node:assert/strict";
import test from "node:test";
import {
  HERO_SOURCE_TILT,
  heroVisibilityProgress,
  sampleCursorScroll,
  sampleHeroVisibility,
  sampleOverlayScroll
} from "./heroMotion.js";

test("the hero stays front-facing throughout its entrance", () => {
  const start = sampleHeroVisibility(0);

  assert.deepEqual(start, HERO_SOURCE_TILT);
  assert.deepEqual(HERO_SOURCE_TILT, {
    perspective: 1200,
    translateX: 0,
    translateY: 0,
    scale: 1,
    rotateZ: 0,
    rotateX: 0,
    rotateY: 0,
    skewX: 0
  });
  assert.equal(start.perspective, 1200);
  assert.equal(start.rotateX, 0);
  assert.equal(start.rotateY, 0);
  assert.equal(start.skewX, 0);
  assert.equal(start.scale, 1);
});

test("the dashboard never tilts or shifts while entering the viewport", () => {
  const progressAt450 = heroVisibilityProgress({
    sceneTop: 548.8,
    sceneHeight: 806.664,
    viewportHeight: 782,
    scrollY: 450
  });
  const at450 = sampleHeroVisibility(progressAt450);
  const end = sampleHeroVisibility(1);

  assert.equal(at450.translateX, 0);
  assert.equal(at450.translateY, 0);
  assert.equal(at450.scale, 1);
  assert.equal(at450.rotateY, 0);
  assert.equal(end.translateX, 0);
  assert.equal(end.translateY, 0);
  assert.equal(end.scale, 1);
  assert.equal(end.rotateZ, 0);
  assert.equal(end.rotateX, 0);
  assert.equal(end.rotateY, 0);
  assert.equal(end.skewX, 0);
});

test("floating cards keep the source parallax speeds without an early cutoff", () => {
  assert.deepEqual(sampleOverlayScroll(750), {
    activityY: 75,
    deliverableY: 37.5
  });
  assert.deepEqual(sampleOverlayScroll(-20), {
    activityY: 0,
    deliverableY: 0
  });
});

test("the missing cursor combines 63-percent parallax with its target transform", () => {
  const cursor = sampleCursorScroll(450);

  assert.ok(Math.abs(cursor.translateX + 3.7657) < 0.001);
  assert.ok(Math.abs(cursor.translateY - 170.2657) < 0.001);
  assert.ok(Math.abs(cursor.scale - 0.937657) < 0.00001);
  assert.ok(Math.abs(cursor.rotateZ - 1.870293) < 0.00001);
});
