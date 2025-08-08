import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { ITP_STEPS } from "./itp-model";
import { db } from "./itp-db";
import {
  linkToStep,
  setStatus,
  exportCSV,
  exportJSON,
  getStepStatistics,
} from "./itp-service";
import { repaintForStep, clearAllHighlighting } from "./itp-painter";
import {
  getPileElements,
  getColumnElements,
  selectStructuralElements,
} from "./structural-selector";
import type { ElementSelection } from "./itp-model";

// helper: current viewport selection -> array of { modelId, expressID, ifcGuid? }
async function getCurrentSelection(
  components: OBC.Components,
): Promise<ElementSelection[]> {
  const highlighter = components.get(OBF.Highlighter);
  const map = highlighter.selection.select; // ModelIdMap
  // flatten to array for linking/status updates
  const arr: ElementSelection[] = [];
  for (const [modelId, ids] of Object.entries(map)) {
    for (const id of ids as Set<number>) {
      arr.push({ modelId, expressID: id });
    }
  }
  // (optional) resolve GUIDs using fragments/groups if you need them
  return arr;
}

export default function QualityPanel(components: OBC.Components) {
  // seed steps once
  (async () => {
    const count = await db.itp_steps.count();
    if (count === 0) {
      await db.itp_steps.bulkPut(
        ITP_STEPS.map((s) => ({ stepId: s.id, name: s.name })),
      );
    }
  })();

  // Steps table
  const stepsTable = document.createElement("bim-table") as BUI.Table<{
    Step: string;
    Name: string;
    Pass: number;
    Fail: number;
    Open: number;
    NA: number;
    Total: number;
  }>;
  stepsTable.selectableRows = true;
  stepsTable.style.height = "300px";

  // Function to update the steps table with statistics
  const updateStepsTable = async () => {
    const steps = await db.itp_steps.toArray();
    const rows = [];

    for (const step of steps) {
      const stats = await getStepStatistics(step.stepId);
      rows.push({
        data: {
          Step: step.stepId,
          Name: step.name,
          Pass: stats.pass,
          Fail: stats.fail,
          Open: stats.open,
          NA: stats.na,
          Total: stats.total,
        },
      });
    }

    stepsTable.data = rows;
  };

  // Initial load
  updateStepsTable();

  // Selected step state
  let selectedStep: string | null = null;

  stepsTable.addEventListener("cellclick", () => {
    const chosen = [...stepsTable.selection][0];
    if (chosen && chosen.Step) {
      selectedStep = chosen.Step;
      repaintForStep(components, chosen.Step);
    }
  });

  // Selection info panel
  const selectionInfo = BUI.Component.create(() => {
    return BUI.html`
      <div style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.5rem; background: var(--bim-ui_bg-contrast-20); border-radius: 0.375rem;">
        <div style="font-weight: 600;">Selection Info</div>
        <div id="selection-count" style="font-size: 0.875rem; color: var(--bim-ui_main-contrast);">
          No elements selected
        </div>
      </div>
    `;
  });

  // Update selection info
  const updateSelectionInfo = async () => {
    const selection = await getCurrentSelection(components);
    const countEl = selectionInfo.querySelector("#selection-count");
    if (countEl) {
      countEl.textContent = `${selection.length} elements selected`;
    }
  };

  // Listen for selection changes
  const highlighter = components.get(OBF.Highlighter);
  if (highlighter.events && highlighter.events.select) {
    highlighter.events.select.onHighlight.add(() => {
      updateSelectionInfo();
    });
    highlighter.events.select.onClear.add(() => {
      updateSelectionInfo();
    });
  }

  // Initialize selection info
  updateSelectionInfo();

  // Link button
  const linkBtn = BUI.Component.create(() => {
    const onClick = async () => {
      if (!selectedStep) {
        console.warn("Please select a step first");
        return;
      }
      const selection = await getCurrentSelection(components);
      if (selection.length === 0) {
        console.warn("Please select elements in the 3D viewer first");
        return;
      }
      await linkToStep(selectedStep, selection);
      await repaintForStep(components, selectedStep);
      await updateStepsTable();
    };
    return BUI.html`<bim-button label="Link Selection to Step" @click=${onClick}></bim-button>`;
  });

  // Status buttons
  const passBtn = BUI.Component.create(() => {
    const onClick = async () => {
      if (!selectedStep) {
        console.warn("Please select a step first");
        return;
      }
      const selection = await getCurrentSelection(components);
      if (selection.length === 0) {
        console.warn("Please select elements in the 3D viewer first");
        return;
      }
      await setStatus(selectedStep, selection, "Pass");
      await repaintForStep(components, selectedStep);
      await updateStepsTable();
    };
    return BUI.html`<bim-button label="Set Pass" style="background: var(--bim-ui_accent-base);" @click=${onClick}></bim-button>`;
  });

  const failBtn = BUI.Component.create(() => {
    const onClick = async () => {
      if (!selectedStep) {
        console.warn("Please select a step first");
        return;
      }
      const selection = await getCurrentSelection(components);
      if (selection.length === 0) {
        console.warn("Please select elements in the 3D viewer first");
        return;
      }
      await setStatus(selectedStep, selection, "Fail");
      await repaintForStep(components, selectedStep);
      await updateStepsTable();
    };
    return BUI.html`<bim-button label="Set Fail" style="background: #aa0000; color: white;" @click=${onClick}></bim-button>`;
  });

  const openBtn = BUI.Component.create(() => {
    const onClick = async () => {
      if (!selectedStep) {
        console.warn("Please select a step first");
        return;
      }
      const selection = await getCurrentSelection(components);
      if (selection.length === 0) {
        console.warn("Please select elements in the 3D viewer first");
        return;
      }
      await setStatus(selectedStep, selection, "Open");
      await repaintForStep(components, selectedStep);
      await updateStepsTable();
    };
    return BUI.html`<bim-button label="Set Open" @click=${onClick}></bim-button>`;
  });

  const naBtn = BUI.Component.create(() => {
    const onClick = async () => {
      if (!selectedStep) {
        console.warn("Please select a step first");
        return;
      }
      const selection = await getCurrentSelection(components);
      if (selection.length === 0) {
        console.warn("Please select elements in the 3D viewer first");
        return;
      }
      await setStatus(selectedStep, selection, "NA");
      await repaintForStep(components, selectedStep);
      await updateStepsTable();
    };
    return BUI.html`<bim-button label="Set N/A" style="background: #ffaa00; color: black;" @click=${onClick}></bim-button>`;
  });

  // Clear highlighting button
  const clearBtn = BUI.Component.create(() => {
    const onClick = async () => {
      await clearAllHighlighting(components);
    };
    return BUI.html`<bim-button label="Clear Highlighting" @click=${onClick}></bim-button>`;
  });

  // Bulk selection buttons
  const selectPilesBtn = BUI.Component.create(() => {
    const onClick = async () => {
      console.log("Attempting to select all piles...");
      const piles = await getPileElements(components);
      if (piles.length > 0) {
        await selectStructuralElements(components, piles);
        console.log(`Selected ${piles.length} pile elements`);
      } else {
        console.log("No pile elements found or auto-selection not available");
      }
    };
    return BUI.html`<bim-button label="Select Piles" @click=${onClick}></bim-button>`;
  });

  const selectColumnsBtn = BUI.Component.create(() => {
    const onClick = async () => {
      console.log("Attempting to select all columns...");
      const columns = await getColumnElements(components);
      if (columns.length > 0) {
        await selectStructuralElements(components, columns);
        console.log(`Selected ${columns.length} column elements`);
      } else {
        console.log("No column elements found or auto-selection not available");
      }
    };
    return BUI.html`<bim-button label="Select Columns" @click=${onClick}></bim-button>`;
  });

  // CSV Import functionality
  const csvImportBtn = BUI.Component.create(() => {
    const onImport = async () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv";
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split("\n").filter((line) => line.trim());
        const header = lines[0];

        if (!header.includes("stepId") || !header.includes("name")) {
          console.error(
            "CSV must have 'stepId' and 'name' columns. Found:",
            header,
          );
          return;
        }

        const steps = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(",");
          if (parts.length >= 2) {
            const stepId = parts[0].replace(/"/g, "").trim();
            const name = parts[1].replace(/"/g, "").trim();
            if (stepId && name) {
              steps.push({ stepId, name });
            }
          }
        }

        if (steps.length > 0) {
          await db.itp_steps.bulkPut(steps);
          await updateStepsTable();
          console.log(`Imported ${steps.length} ITP steps from CSV`);
        }
      };
      input.click();
    };
    return BUI.html`<bim-button label="Import CSV Steps" @click=${onImport}></bim-button>`;
  });
  const exportBtns = BUI.Component.create(() => {
    const onCsv = async () => {
      const { stepsCsv, inspectionsCsv } = await exportCSV();
      // trigger downloads
      const a1 = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(new Blob([stepsCsv], { type: "text/csv" })),
        download: "itp_steps.csv",
      });
      const a2 = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(
          new Blob([inspectionsCsv], { type: "text/csv" }),
        ),
        download: "inspections.csv",
      });
      a1.click();
      a2.click();
    };
    const onJson = async () => {
      const data = await exportJSON();
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        ),
        download: "quality.json",
      });
      a.click();
    };
    return BUI.html`
      <div style="display:flex; gap:.5rem">
        <bim-button label="Export CSV" @click=${onCsv}></bim-button>
        <bim-button label="Export JSON" @click=${onJson}></bim-button>
      </div>`;
  });

  // Keyboard shortcuts
  const handleKeyPress = (event: KeyboardEvent) => {
    if (!selectedStep) return;

    switch (event.key.toLowerCase()) {
      case "p":
        passBtn.click();
        break;
      case "f":
        failBtn.click();
        break;
      case "o":
        openBtn.click();
        break;
      case "n":
        naBtn.click();
        break;
      default:
        break;
    }
  };

  // Add keyboard listener when panel is active
  document.addEventListener("keydown", handleKeyPress);

  // Layout
  return BUI.Component.create(
    () => BUI.html`
    <bim-panel label="Quality Inspection & Test Plan">
      <bim-panel-section label="Instructions" style="padding: 0.5rem;">
        <div style="font-size: 0.875rem; color: var(--bim-ui_main-contrast); line-height: 1.4;">
          <p><strong>Workflow:</strong></p>
          <ol>
            <li>Select a step from the table below</li>
            <li>Select elements in the 3D viewer</li>
            <li>Use "Link Selection" to associate elements with the step</li>
            <li>Set status using buttons or hotkeys: P (Pass), F (Fail), O (Open), N (N/A)</li>
          </ol>
          <p><strong>Colors:</strong> Green = Pass, Red = Fail, Orange = N/A</p>
        </div>
      </bim-panel-section>

      <bim-panel-section label="Selection">
        ${selectionInfo}
        <div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-top: 0.5rem;">
          ${selectPilesBtn}
          ${selectColumnsBtn}
        </div>
      </bim-panel-section>

      <bim-panel-section label="ITP Steps (click to select)">
        ${stepsTable}
      </bim-panel-section>

      <bim-panel-section label="Link & Status">
        <div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom: 1rem;">
          ${linkBtn}
        </div>
        <div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom: 1rem;">
          ${passBtn} ${failBtn} ${openBtn} ${naBtn}
        </div>
        <div style="display:flex; gap:.5rem;">
          ${clearBtn}
        </div>
      </bim-panel-section>

      <bim-panel-section label="Import/Export">
        ${csvImportBtn}
        ${exportBtns}
      </bim-panel-section>
    </bim-panel>
  `,
  );
}
