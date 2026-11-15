/**
 * Memory-leak regression suite (fleet standard).
 *
 * None of this sim's models define dispose(): they live for the lifetime of the sim and are
 * built entirely from axon Properties. The suite therefore covers them two ways:
 *
 * 1. describeDisposalLeaks() on helpers that dispose a VernierScaleModel's (and the
 *    InstrumentsModel's) owned Properties — DerivedProperties first, then leaf Properties, the
 *    same pattern as VariableStarPhotometry's PhotometryModel — and checks the model is
 *    collected afterwards.
 * 2. Create/drop forceGC tests for every screen model, proving no module-level or global state
 *    (Property registries, the shared enumerations, StringManager, ...) retains an instance.
 *
 * V8 requires a function boundary (not merely a block scope) for locals to be released, so every
 * allocation happens inside a helper that returns only a WeakRef.
 */

import { NumberProperty } from "scenerystack/axon";
import { describe, expect, it } from "vitest";
import { CaliperModel } from "../src/caliper/model/CaliperModel.js";
import { VernierScaleModel } from "../src/common/model/VernierScaleModel.js";
import { MICROMETER_MICRON, PROTRACTOR_FIVE_MINUTE } from "../src/common/model/VernierScaleSpec.js";
import { InstrumentsModel } from "../src/instruments/model/InstrumentsModel.js";
import { PracticeModel } from "../src/practice/model/PracticeModel.js";
import { VernierPrincipleModel } from "../src/principle/model/VernierPrincipleModel.js";
import { describeDisposalLeaks, forceGC } from "./helpers/memoryLeak.js";

/** Dispose every Property a VernierScaleModel owns: DerivedProperties first, then the leaves. */
function disposeVernierScaleModel(model: VernierScaleModel): void {
  model.readingValueProperty.dispose();
  model.readingErrorProperty.dispose();
  model.vernierLabelReadProperty.dispose();
  model.mainDivisionsReadProperty.dispose();
  model.coincidentIndexProperty.dispose();
  model.readingTicksProperty.dispose();
  model.rawReadingTicksProperty.dispose();
  model.offsetTicksProperty.dispose();
  model.measurementRangeProperty.dispose();

  model.snapToReadableEnabledProperty.dispose();
  model.zeroErrorTicksProperty.dispose();
  model.measurementProperty.dispose();
  model.specProperty.dispose();
}

/** A VernierScaleModel that can be handed to describeDisposalLeaks(). */
class DisposableVernierScaleModel extends VernierScaleModel {
  public dispose(): void {
    disposeVernierScaleModel(this);
  }
}

/** An InstrumentsModel that disposes both owned scales and its instrument selection. */
class DisposableInstrumentsModel extends InstrumentsModel {
  public dispose(): void {
    disposeVernierScaleModel(this.micrometer);
    disposeVernierScaleModel(this.protractor);
    this.instrumentProperty.dispose();
  }
}

describeDisposalLeaks([
  {
    name: "VernierScaleModel (micrometer)",
    create: () => new DisposableVernierScaleModel(MICROMETER_MICRON, 5),
  },
  {
    name: "VernierScaleModel (protractor)",
    create: () => new DisposableVernierScaleModel(PROTRACTOR_FIVE_MINUTE, 30),
  },
  { name: "InstrumentsModel (owned Properties)", create: () => new DisposableInstrumentsModel() },
]);

/** Allocate a fresh object, drop it without disposing, and return a WeakRef to it. */
function createAndDrop(create: () => object): WeakRef<object> {
  return new WeakRef<object>(create());
}

describe("Screen models are not retained by global state", () => {
  const cases: ReadonlyArray<{ name: string; create: () => object }> = [
    { name: "CaliperModel", create: () => new CaliperModel() },
    { name: "PracticeModel", create: () => new PracticeModel() },
    { name: "InstrumentsModel", create: () => new InstrumentsModel() },
    { name: "VernierPrincipleModel", create: () => new VernierPrincipleModel() },
    { name: "VernierScaleModel", create: () => new VernierScaleModel(MICROMETER_MICRON, 5) },
  ];

  for (const { name, create } of cases) {
    it(`${name} is collected once dropped`, async () => {
      const ref = createAndDrop(create);
      await forceGC(ref);
      expect(ref.deref()).toBeUndefined();
    });

    it(`${name}: repeated create/drop cycles leave no survivors`, async () => {
      const refs: WeakRef<object>[] = [];
      for (let i = 0; i < 10; i++) {
        refs.push(createAndDrop(create));
      }
      await forceGC(refs);
      expect(refs.filter((r) => r.deref() !== undefined).length).toBe(0);
    });
  }

  it("a model built after use (reset + edits) is still collected", async () => {
    const ref = (() => {
      const model = new CaliperModel();
      model.scale.setMeasurement(12);
      model.reset();
      return new WeakRef<object>(model);
    })();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });

  it("a disposed NumberProperty is collected (harness sanity)", async () => {
    const ref = (() => {
      const property = new NumberProperty(0);
      const weak = new WeakRef<object>(property);
      property.dispose();
      return weak;
    })();
    await forceGC(ref);
    expect(ref.deref()).toBeUndefined();
  });
});
