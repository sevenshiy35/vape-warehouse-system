import assert from "node:assert/strict";
import test from "node:test";
import { forecastOrderInventory, recognitionPickQuantity } from "../lib/orderInventory.ts";

const bin = (position, quantity, reserved = 0) => ({
  id: `bin-${position}`, product_id: "tea", location: `A${position}`, position, quantity, reserved,
});

test("uses all three locations in priority order, excluding batch reservations", () => {
  const bins = [bin(3, 10), bin(1, 5, 2), bin(2, 4, 1)];
  const saved = structuredClone(bins);
  const [result] = forecastOrderInventory([{ productId: "tea", quantity: 8 }], bins);
  assert.equal(result.status, "sufficient");
  assert.equal(result.available, 16);
  assert.equal(result.onHand, 19);
  assert.equal(result.reserved, 3);
  assert.equal(result.after, 8);
  assert.deepEqual(result.allocations, [
    { position: 1, location: "A1", quantity: 3 },
    { position: 2, location: "A2", quantity: 3 },
    { position: 3, location: "A3", quantity: 2 },
  ]);
  assert.deepEqual(bins, saved, "forecasts must never mutate inventory");
});

test("duplicate order rows share stock and show the cumulative shortage", () => {
  const results = forecastOrderInventory([
    { productId: "tea", quantity: 4 }, { productId: "tea", quantity: 4 }, { productId: "tea", quantity: 1 },
  ], [bin(1, 5), bin(2, 2)]);
  assert.deepEqual(results.map(({ before, after, shortage }) => ({ before, after, shortage })), [
    { before: 7, after: 3, shortage: 0 }, { before: 3, after: -1, shortage: 1 }, { before: -1, after: -2, shortage: 2 },
  ]);
  assert.equal(results[1].allocations.reduce((sum, entry) => sum + entry.quantity, 0), 3);
  assert.deepEqual(results[2].allocations, []);
});

test("zero inventory is a shortage; exact stock is sufficient", () => {
  const [missing] = forecastOrderInventory([{ productId: "tea", quantity: 2 }], []);
  assert.equal(missing.status, "insufficient");
  assert.equal(missing.shortage, 2);
  const [exact] = forecastOrderInventory([{ productId: "tea", quantity: 2 }], [bin(1, 2)]);
  assert.equal(exact.status, "sufficient");
  assert.equal(exact.after, 0);
});

test("unmatched or unconfirmed quantities never consume stock", () => {
  const results = forecastOrderInventory([
    { productId: null, quantity: 5 }, { productId: "tea", quantity: null },
    { productId: "tea", quantity: -1 }, { productId: "tea", quantity: 2 },
  ], [bin(1, 3)]);
  assert.deepEqual(results.map((result) => result.status), ["unmatched", "needs_review", "needs_review", "sufficient"]);
  assert.equal(results[3].before, 3);
});

test("archived locations are excluded and products do not share balances", () => {
  const [result, other] = forecastOrderInventory([
    { productId: "tea", quantity: 4 }, { productId: "other", quantity: 2 },
  ], [bin(null, 100), bin(1, 3), { ...bin(1, 9), product_id: "other", id: "other" }]);
  assert.equal(result.available, 3);
  assert.equal(result.shortage, 1);
  assert.equal(other.after, 7);
});

test("AI box and carton forecasts use actual product conversion rules", () => {
  const product = { default_pick_multiplier: 3, carton_pick_multiplier: 10 };
  assert.equal(recognitionPickQuantity(2, "盒", product), 6);
  assert.equal(recognitionPickQuantity(2, "条", product), 20);
  assert.equal(recognitionPickQuantity(2, "支", product), 2);
  assert.equal(recognitionPickQuantity(2, "个", product), 2);
  assert.equal(recognitionPickQuantity(2, "未知", product), null);
  assert.equal(recognitionPickQuantity(2, "盒"), null);
  assert.equal(recognitionPickQuantity(0, "盒", product), null);
});

test("refreshing recomputes from new stock instead of a saved AI snapshot", () => {
  const demands = [{ productId: "tea", quantity: 6 }];
  assert.equal(forecastOrderInventory(demands, [bin(1, 3)])[0].shortage, 3);
  const [refreshed] = forecastOrderInventory(demands, [bin(1, 10, 2)]);
  assert.equal(refreshed.status, "sufficient");
  assert.equal(refreshed.after, 2);
});
