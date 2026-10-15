import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it } from "node:test";

type Component = { type: string; name?: string; [key: string]: unknown };
type Screen = { id: string; data: Record<string, unknown>; layout: { children: Component[] }; terminal?: boolean };

const flow = JSON.parse(readFileSync(join(__dirname, "../flows/booking.json"), "utf-8")) as {
  version: string;
  data_api_version: string;
  routing_model: Record<string, string[]>;
  screens: Screen[];
};

const references = (value: unknown, kind: "data" | "form"): string[] =>
  [...JSON.stringify(value).matchAll(new RegExp(`\\$\\{${kind}\\.([a-z_]+)\\}`, "g"))].map((match) => match[1]!);

describe("booking Flow JSON", () => {
  it("uses a data endpoint version", () => {
    assert.equal(flow.data_api_version, "3.0");
    assert.ok(Number(flow.version) >= 7);
  });

  it("routes only between declared screens and ends on a terminal screen", () => {
    const ids = flow.screens.map((screen) => screen.id);
    for (const [from, targets] of Object.entries(flow.routing_model)) {
      assert.ok(ids.includes(from), `${from} is not a screen`);
      targets.forEach((target) => assert.ok(ids.includes(target), `${target} is not a screen`));
    }
    assert.ok(flow.screens.some((screen) => screen.terminal));
  });

  for (const screen of flow.screens) {
    it(`${screen.id}: every \${data.*} reference is declared with an example`, () => {
      for (const key of references(screen.layout, "data")) {
        const declared = screen.data[key] as { __example__?: unknown } | undefined;
        assert.ok(declared, `${screen.id} uses undeclared data.${key}`);
        assert.ok("__example__" in declared, `${screen.id}.data.${key} has no __example__`);
      }
    });

    it(`${screen.id}: every \${form.*} reference names an input on the screen`, () => {
      const inputs = screen.layout.children.map((component) => component.name).filter(Boolean);
      for (const key of references(screen.layout, "form")) {
        assert.ok(inputs.includes(key), `${screen.id} uses unknown form.${key}`);
      }
    });
  }

  it("reloads slots on the same screen when the date changes", () => {
    const book = flow.screens.find((screen) => screen.id === "BOOK")!;
    const date = book.layout.children.find((component) => component.name === "date")!;
    assert.deepEqual((date["on-select-action"] as { name: string }).name, "data_exchange");
  });
});
