import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import * as FRAGS from "@thatopen/fragments";
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
import type { ElementSelection } from "./itp-model";

// helper: current viewport selection -> array of { modelId, expressID, ifcGuid? }
async function getCurrentSelection(
  components: OBC.Components,
): Promise<ElementSelection[]> {
  try {
    console.log("🔍 Getting current selection...");

    const highlighter = components.get(OBF.Highlighter);

    // Check if highlighter is setup
    if (!highlighter.isSetup) {
      console.log("⚠️ Highlighter not setup, setting up now...");
      const worlds = components.get(OBC.Worlds);
      const world = worlds.list.values().next().value;
      if (world) {
        highlighter.setup({
          world,
          selectMaterialDefinition: {
            color: new THREE.Color("#BCF124"),
            opacity: 1,
            transparent: false,
            renderedFaces: FRAGS.RenderedFaces.ONE,
          },
        });
      }
    }

    const selectName = highlighter.config.selectName || "select";
    const selectionMap = highlighter.selection[selectName];

    console.log(`🎯 Using select name: ${selectName}`);
    console.log("📊 Selection map:", selectionMap);

    const arr: ElementSelection[] = [];

    if (selectionMap && typeof selectionMap === "object") {
      for (const [modelId, ids] of Object.entries(selectionMap)) {
        if (ids && ids instanceof Set) {
          console.log(
            `🏗️ Processing model ${modelId} with ${ids.size} elements`,
          );
          for (const id of ids) {
            arr.push({
              modelId,
              expressID: Number(id),
            });
            console.log(
              `📍 Found selection: modelId=${modelId}, expressID=${id}`,
            );
          }
        }
      }
    }

    console.log(`✅ Total selected elements: ${arr.length}`);
    return arr;
  } catch (error) {
    console.error("❌ Error getting current selection:", error);
    return [];
  }
}

export default function QualityPanel(components: OBC.Components) {
  // Initialize highlighter and setup quality styles
  const initQualityHighlighter = async () => {
    try {
      const highlighter = components.get(OBF.Highlighter);
      
      if (!highlighter.isSetup) {
        const worlds = components.get(OBC.Worlds);
        const world = worlds.list.values().next().value;
        if (world) {
          highlighter.setup({
            world,
            selectMaterialDefinition: {
              color: new THREE.Color("#BCF124"),
              opacity: 1,
              transparent: false,
              renderedFaces: FRAGS.RenderedFaces.ONE,
            },
          });
        }
      }
      
      // Setup quality status highlight styles
      highlighter.styles.set("quality-pass", {
        color: new THREE.Color("#4CAF50"), // Green
        opacity: 0.8,
        transparent: true,
        renderedFaces: FRAGS.RenderedFaces.ONE,
      });
      
      highlighter.styles.set("quality-fail", {
        color: new THREE.Color("#F44336"), // Red
        opacity: 0.8,
        transparent: true,
        renderedFaces: FRAGS.RenderedFaces.ONE,
      });
      
      highlighter.styles.set("quality-open", {
        color: new THREE.Color("#FF9800"), // Orange
        opacity: 0.8,
        transparent: true,
        renderedFaces: FRAGS.RenderedFaces.ONE,
      });
      
      highlighter.styles.set("quality-na", {
        color: new THREE.Color("#9E9E9E"), // Gray
        opacity: 0.6,
        transparent: true,
        renderedFaces: FRAGS.RenderedFaces.ONE,
      });
      
      console.log("✅ Quality highlighter styles initialized");
    } catch (error) {
      console.error("❌ Failed to initialize quality highlighter:", error);
    }
  };

  // Initialize on creation
  initQualityHighlighter();
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

  // Enhanced table row selection handling using rowselected event
  stepsTable.addEventListener("rowselected", (e) => {
    console.log("🖱️ Row selected event fired");
    const event = e as CustomEvent<{ data: Partial<{ Step: string; Name: string; Pass: number; Fail: number; Open: number; NA: number; Total: number; }> }>;
    const rowData = event.detail.data;
    
    console.log("✅ Selected row data:", rowData);
    console.log("🔍 Step property:", rowData.Step);
    
    if (rowData.Step) {
      selectedStep = rowData.Step;
      console.log(`✅ Selected step: ${rowData.Step}`);
      repaintForStep(components, rowData.Step);
    } else {
      console.warn("❌ No Step property found in selected row");
      selectedStep = null;
    }
  });

  stepsTable.addEventListener("rowdeselected", () => {
    console.log("🖱️ Row deselected");
    selectedStep = null;
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
  
  // Try multiple approaches to listen for selection changes
  const updateSelectionDebounced = () => {
    setTimeout(updateSelectionInfo, 100); // Debounce to avoid rapid updates
  };
  
  // Method 1: Try the events property if it exists
  if (highlighter.events?.select?.onHighlight) {
    highlighter.events.select.onHighlight.add(updateSelectionDebounced);
  }
  if (highlighter.events?.select?.onClear) {
    highlighter.events.select.onClear.add(updateSelectionDebounced);
  }
  
  // Method 2: Fallback - poll for changes every 2 seconds
  setInterval(updateSelectionInfo, 2000);

  // Initialize selection info
  updateSelectionInfo();

  // Link button
  const linkBtn = BUI.Component.create(() => {
    const onClick = async () => {
      console.log("🔗 Link button clicked");
      if (!selectedStep) {
        console.warn("❌ No step selected");
        return;
      }
      console.log(`📋 Selected step: ${selectedStep}`);
      
      const selection = await getCurrentSelection(components);
      if (selection.length === 0) {
        console.warn("❌ No elements selected in 3D viewer");
        return;
      }
      
      console.log(
        `🎯 Linking ${selection.length} elements to step ${selectedStep}`,
      );
      try {
        await linkToStep(selectedStep, selection);
        console.log("✅ Successfully linked elements to step");
        await repaintForStep(components, selectedStep);
        console.log("🎨 Repainted elements for step");
        await updateStepsTable();
        console.log("📊 Updated steps table");
      } catch (error) {
        console.error("❌ Error linking elements:", error);
      }
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

  // Bulk selection buttons removed per user request

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
    <bim-panel label="Quality Inspection & Test Plan" style="height: 100vh; overflow-y: auto;">
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
