import assert from "node:assert/strict";
import test from "node:test";
import { h } from "preact";
import render from "preact-render-to-string";
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import Services from "../src/components/Services";
import { PLAN_COMPARISON_LABELS, SERVICES_ITEMS } from "../src/config/home";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

function find(root: Node, className: string): Element[] {
  const matches: Element[] = [];
  if ("attrs" in root && root.attrs.some(attr =>
    attr.name === "class" && attr.value.split(/\s+/).includes(className)
  )) matches.push(root as Element);
  if ("childNodes" in root) {
    for (const child of root.childNodes) matches.push(...find(child, className));
  }
  return matches;
}

test("Subscription columns render the same comparison rows with a separate Plans header", () => {
  const root = parseFragment(render(h(Services, {})));
  const [grid] = find(root, "services-grid");
  assert.ok(grid);
  assert.match(grid.attrs.find(attr => attr.name === "style")?.value ?? "",
    new RegExp(`--services-comparison-row-count:\\s*${PLAN_COMPARISON_LABELS.length}(?:;|$)`));
  const [header] = find(grid, "services-plan-index__header");
  assert.equal(find(header, "services-plan-index__title").length, 1);
  assert.equal(find(header, "services-plan-index__intro-image").length, 1);
  const [labels] = find(grid, "services-plan-index__list");
  assert.equal(find(labels, "services-plan-index__item").length, PLAN_COMPARISON_LABELS.length);
  assert.equal(find(labels, "services-plan-index__item--intro").length, 0);
  const cards = find(grid, "service-cta-card");
  assert.equal(cards.length, SERVICES_ITEMS.length);
  for (const card of cards) {
    assert.equal(find(card, "service-cta-card__list-item").length, PLAN_COMPARISON_LABELS.length);
    assert.equal(find(card, "service-cta-card__button").length, 1);
  }
});
