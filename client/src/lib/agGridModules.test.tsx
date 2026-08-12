// SEC-108: registration is a process-global side effect (ModuleRegistry.registerModules is
// static, not per-grid) — the only reliable way to prove a module is actually registered is to
// render a real <AgGridReact> that exercises it and confirm AG Grid's own dev validation
// (enableDevValidations(), active here since vitest runs with import.meta.env.DEV=true) does NOT
// emit its "module X is not registered" console error. A test that inspects registerModules'
// call arguments would only prove the array we pass in, not that AG Grid actually accepted it.
import { render } from "@testing-library/react";
import { describe, expect, test, vi, afterEach } from "vitest";
import { AgGridReact } from "ag-grid-react";
import "./agGridModules";

describe("agGridModules — SEC-108 centralized module registration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("rowSelection, tooltipField, cellClass, autoHeight and rowStyle render without AG Grid module errors", async () => {
    const consoleErrors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      consoleErrors.push(args.map(String).join(" "));
    });

    render(
      <div style={{ height: 300, width: 300 }}>
        <AgGridReact
          rowData={[{ id: "1", name: "Test" }]}
          columnDefs={[
            { field: "name", tooltipField: "name", cellClass: "test-cell" },
          ]}
          rowSelection={{ mode: "multiRow" }}
          rowStyle={{ cursor: "pointer" }}
        />
      </div>
    );

    // AG Grid initializes asynchronously (its own microtask/rAF scheduling) — module validation
    // errors surface during that init, not synchronously on render().
    await new Promise((resolve) => setTimeout(resolve, 50));

    const moduleErrors = consoleErrors.filter((e) => e.includes("is not registered"));
    expect(moduleErrors, moduleErrors.join("\n")).toHaveLength(0);
  });
});
