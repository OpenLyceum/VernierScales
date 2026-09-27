/**
 * Fleet-standard memory-leak regression suite.
 *
 * Creates a disposable AXON Property inside a function boundary, disposes it,
 * forces garbage collection via global.gc (--expose-gc in vitest.config.ts), then
 * asserts via WeakRef that the object was collected. V8 requires a function
 * boundary (not merely a block scope) so local strong references die when the
 * helper returns.
 *
 * The fixture is a NumberProperty — the reactive primitive every model in this
 * sim is built from — so the regression covers the exact dispose path the
 * screens rely on, rather than a stand-in object invented for the test.
 */

import { NumberProperty } from "scenerystack/axon";
import { describe, expect, it } from "vitest";
import { forceGC } from "./helpers/memoryLeak.js";

function createAndDisposeProperty(): WeakRef<object> {
  const property = new NumberProperty(0);
  const ref = new WeakRef<object>(property);
  property.dispose();
  return ref;
}

describe("Memory leak regression", () => {
  it("a disposed NumberProperty is collected", async () => {
    const ref = createAndDisposeProperty();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("double dispose() does not throw", () => {
    const property = new NumberProperty(0);
    property.dispose();
    expect(() => property.dispose()).not.toThrow();
  });

  it("repeated create/dispose cycles leave no survivors", async () => {
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 10; i++) {
      refs.push(createAndDisposeProperty());
    }
    await forceGC(refs);
    const survivors = refs.filter((r) => r.deref() !== undefined).length;
    expect(survivors).toBe(0);
  });
});
