import assert from "node:assert/strict";
import test from "node:test";
import { buildProductSearchIndex, scoreProductSearch, normalizeSearchText } from "../lib/productSearch.ts";

const tea = buildProductSearchIndex({
  sku: "RL-36", brand: "Relx三颗装", product_name_cn: "铁观音", display_name: "R 铁观音", product_name_en: "Tieguanyin Tea",
});
const peach = buildProductSearchIndex({
  sku: "SP-01", brand: "SP", product_name_cn: "蜜桃乌龙", display_name: "SP 蜜桃乌龙🍑", product_name_en: "Peach Oolong",
}, ["A1-01"]);
const matches = (index, query) => scoreProductSearch(index, query) > 0;

test("Chinese names, full pinyin, initials and mixed brand keywords", () => {
  for (const query of ["铁观音", "tieguanyin", "tgy", "TGY", "ｔｇｙ", "t g y", "relx tgy", "tgy relx"]) assert.ok(matches(tea, query), query);
  for (const query of ["蜜桃", "mtwl", "peach", "po", "乌龙 蜜桃", "SP mtwl"]) assert.ok(matches(peach, query), query);
  assert.equal(matches(tea, "sp tgy"), false);
});

test("spacing, punctuation, tone marks and compact SKUs", () => {
  for (const query of ["RL36", "rl-36", "ＲＬ－３６", "rl 36"]) assert.ok(matches(tea, query), query);
  for (const query of ["sp01", "sp1", "SP 01", "a101", "A1 01", "peach-oolong"]) assert.ok(matches(peach, query), query);
  const green = buildProductSearchIndex({ product_name_cn: "绿茶" });
  for (const query of ["lvcha", "lücha", "lǜchá", "lu:cha", "lc"]) assert.ok(matches(green, query), query);
  assert.equal(normalizeSearchText("ＳＰ－０１ 🍑"), "sp01");
});

test("one typo, a missing letter, and adjacent swapped letters", () => {
  for (const query of ["tieguanyim", "tieguanyni", "tiguan yin", "pech", "铁观因", "铁音"]) {
    const index = query.startsWith("pe") ? peach : tea;
    assert.ok(matches(index, query), query);
  }
  assert.equal(matches(tea, "qwerty"), false);
  assert.equal(matches(peach, "tgy"), false);
  assert.equal(matches(tea, "铁观观因"), false);
});

test("numbers are never fuzzed into a different SKU or location", () => {
  for (const query of ["RL37", "SP02", "SP-02", "A102", "11"]) {
    const index = query.startsWith("RL") ? tea : peach;
    assert.equal(matches(index, query), false, query);
  }
});

test("exact results rank ahead of initials and approximate results", () => {
  assert.ok(scoreProductSearch(tea, "铁观音") > scoreProductSearch(tea, "tgy"));
  assert.ok(scoreProductSearch(tea, "tgy") > scoreProductSearch(tea, "铁观因"));
  const skuPrefix = buildProductSearchIndex({ sku: "SP-010" });
  assert.ok(scoreProductSearch(peach, "SP01") > scoreProductSearch(skuPrefix, "SP01"));
});

test("empty queries preserve the catalog; emoji search remains specific", () => {
  assert.equal(scoreProductSearch(tea, ""), 1);
  assert.equal(scoreProductSearch(tea, "   "), 1);
  assert.ok(matches(peach, "🍑"));
  assert.equal(matches(tea, "🍑"), false);
});
