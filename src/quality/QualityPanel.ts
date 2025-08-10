import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import * as FRAGS from "@thatopen/fragments";
import { ITP_STEPS } from "./itp-model";
import { db } from "./itp-db";
import {
  linkAndSetStatus,
  exportCSV,
  exportJSON,
  getStepStatistics,
} from "./itp-service";
import { repaintForStep, clearAllHighlighting } from "./itp-painter";
import type { ElementSelection } from "./itp-model";

// helper: current viewport selection -> array of { modelId, expressID, guid }
async function getCurrentSelection(
  components: OBC.Components,
): Promise<ElementSelection[]> {
  try {
    console.log("🔍 Getting current selection...");

    const highlighter = components.get(OBF.Highlighter);
    const fragments = components.get(OBC.FragmentsManager);

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
      // Convert selection map to GUIDs to get the actual element GUIDs
      const guids = await fragments.modelIdMapToGuids(selectionMap);
      console.log(`🆔 Retrieved ${guids.length} GUIDs from selection`);

      // Build array with both modelId/expressID and GUID information
      let guidIndex = 0;
      for (const [modelId, ids] of Object.entries(selectionMap)) {
        if (ids && ids instanceof Set) {
          console.log(
            `🏗️ Processing model ${modelId} with ${ids.size} elements`,
          );
          for (const id of ids) {
            const guid =
              guidIndex < guids.length ? guids[guidIndex] : undefined;
            arr.push({
              modelId,
              expressID: Number(id),
              guid,
            });
            console.log(
              `📍 Found selection: modelId=${modelId}, expressID=${id}, guid=${guid}`,
            );
            guidIndex++;
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
        color: new THREE.Color("#0080FF"), // Modern electric blue
        opacity: 0.6,
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

  // Migrate existing "Open" status to "Ready for Inspection"
  (async () => {
    try {
      const openRecords = await db.inspections
        .where("status")
        .equals("Open")
        .toArray();
      if (openRecords.length > 0) {
        console.log(
          `🔄 Migrating ${openRecords.length} records from "Open" to "Ready for Inspection"`,
        );
        await db.transaction("rw", db.inspections, async () => {
          for (const record of openRecords) {
            await db.inspections.update(record.pk, {
              status: "Ready for Inspection" as any,
            });
          }
        });
        console.log("✅ Migration completed");
      }
    } catch (error) {
      console.error("❌ Migration failed:", error);
    }
  })();

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

  // Selected step state
  let selectedStep: string | null = null;

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

    // Store current selection before updating data
    const currentSelectedStep = selectedStep;

    stepsTable.data = rows;

    // Restore selection after data update if we had a selected step
    if (currentSelectedStep) {
      setTimeout(() => {
        // Find the row with the matching step and select it
        const tableRows = stepsTable.querySelectorAll("tr");
        for (const row of tableRows) {
          const stepCell = row.querySelector("td:first-child");
          if (stepCell && stepCell.textContent === currentSelectedStep) {
            (row as any).selected = true;
            break;
          }
        }
        // Ensure our local state is preserved
        selectedStep = currentSelectedStep;
      }, 50);
    }
  };

  // Initial load
  updateStepsTable();

  // Enhanced table row selection handling using rowselected event
  stepsTable.addEventListener("rowselected", (e) => {
    console.log("🖱️ Row selected event fired");
    const event = e as CustomEvent<{
      data: Partial<{
        Step: string;
        Name: string;
        Pass: number;
        Fail: number;
        Open: number;
        NA: number;
        Total: number;
      }>;
    }>;
    const rowData = event.detail.data;

    console.log("✅ Selected row data:", rowData);
    console.log("🔍 Step property:", rowData.Step);

    if (rowData.Step) {
      const newSelectedStep = rowData.Step;
      console.log(
        `✅ Setting selected step: ${newSelectedStep} (was: ${selectedStep})`,
      );
      selectedStep = newSelectedStep;
      repaintForStep(components, newSelectedStep);
    } else {
      console.warn("❌ No Step property found in selected row");
      selectedStep = null;
    }
  });

  stepsTable.addEventListener("rowdeselected", () => {
    console.log("🖱️ Row deselected - clearing selected step");
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

  // Matrix helper functions
  const getStatusCellStyle = (status: string) => {
    switch (status) {
      case "Pass":
        return "background: #e8f5e8; color: #2d5a2d; border-left: 3px solid #4CAF50;";
      case "Fail":
        return "background: #ffe8e8; color: #8b0000; border-left: 3px solid #F44336;";
      case "Ready for Inspection":
        return "background: #e8f4ff; color: #003d82; border-left: 3px solid #0080FF;";
      case "NA":
        return "background: #f5f5f5; color: #666; border-left: 3px solid #9E9E9E;";
      default:
        return "background: #f9f9f9; border-left: 3px solid transparent;";
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "Pass":
      case "Fail":
      case "Ready for Inspection":
      case "NA":
        return "●";
      default:
        return "";
    }
  };

  // Create inspection matrix function
  const createInspectionMatrix = async () => {
    try {
      console.log("Creating inspection matrix...");
      
      // Get currently loaded models
      const fragments = components.get(OBC.FragmentsManager);
      const loadedModelIds = Array.from(fragments.list.keys());
      console.log("Currently loaded models:", loadedModelIds);
      
      if (loadedModelIds.length === 0) {
        return `
          <div style="padding: 2rem; text-align: center; color: #666; font-style: italic;">
            No models currently loaded in the viewer.
          </div>
        `;
      }
      
      // Get all inspections and steps, and filter inspections by loaded models
      const [allInspections, allSteps] = await Promise.all([
        db.inspections.orderBy("inspectedAt").toArray(),
        db.itp_steps.orderBy("stepId").toArray(),
      ]);

      // Filter inspections to only include currently loaded models
      const filteredInspections = allInspections.filter(
        (inspection) =>
          inspection.modelId && loadedModelIds.includes(inspection.modelId),
      );

      console.log("Total inspections in DB:", allInspections.length);
      console.log("Filtered inspections for loaded models:", filteredInspections.length);
      console.log("Found steps:", allSteps.length);

      // Get all Express IDs from all loaded models
      const allElementsMap = new Map();
      
      for (const modelId of loadedModelIds) {
        const model = fragments.list.get(modelId);
        if (model) {
          try {
            const fragmentIds = await model.getItemsIdsWithGeometry();
            console.log(`Model ${modelId}: Found ${fragmentIds.length} elements with geometry`);
            
            for (const expressID of fragmentIds) {
              const elementKey = `${modelId}:${expressID}`;
              allElementsMap.set(elementKey, {
                expressID,
                modelId,
                guid: null, // Will be populated if we have inspection data
                steps: new Map(),
              });
            }
          } catch (error) {
            console.warn(`Could not get elements from model ${modelId}:`, error);
          }
        }
      }

      // Now overlay the inspection data onto all elements
      filteredInspections.forEach((inspection) => {
        if (inspection.expressID) {
          const elementKey = `${inspection.modelId}:${inspection.expressID}`;
          if (allElementsMap.has(elementKey)) {
            const element = allElementsMap.get(elementKey);
            element.guid = inspection.guid; // Update with GUID from inspection data
            element.steps.set(inspection.stepId, inspection);
          }
        }
      });

      console.log(`Total elements from all loaded models: ${allElementsMap.size}`);

      if (allElementsMap.size === 0) {
        return `
          <div style="padding: 2rem; text-align: center; color: #666; font-style: italic;">
            No elements found in currently loaded models.<br>
            Ensure models have geometry data and are fully loaded.
          </div>
        `;
      }

      // Group inspections by Express ID instead of GUID - using ALL elements now
      const elementMap = allElementsMap;

      if (elementMap.size === 0) {
        return `
          <div style="padding: 2rem; text-align: center; color: #666; font-style: italic;">
            No elements with Express IDs found. Try selecting elements in the 3D viewer and setting their status.
          </div>
        `;
      }

      // Create matrix HTML
      return `
        <div style="margin-top: 1rem; border: 1px solid #ddd; border-radius: 4px; overflow: auto; max-height: 500px; background: white;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
            <thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 1;">
              <tr>
                <th style="padding: 8px; border: 1px solid #ddd; min-width: 100px; text-align: left; background: #f8f9fa;">
                  Express ID
                </th>
                ${allSteps.map(step => 
                  `<th style="padding: 6px 4px; border: 1px solid #ddd; min-width: 50px; text-align: center; background: #f8f9fa; writing-mode: vertical-rl; text-orientation: mixed;" title="${step.name}">
                    ${step.stepId}
                  </th>`
                ).join("")}
              </tr>
            </thead>
            <tbody>
              ${Array.from(elementMap.entries()).map(([, elementData]) => 
                `<tr style="hover:background: #f5f5f5;">
                  <td style="padding: 6px 8px; border: 1px solid #ddd; font-family: 'Courier New', monospace; font-weight: bold; cursor: pointer;" title="Express ID ${elementData.expressID}">
                    ${elementData.expressID}
                  </td>
                  ${allSteps.map((step) => {
                    const inspection = elementData.steps.get(step.stepId);
                    const cellStyle = inspection 
                      ? getStatusCellStyle(inspection.status) 
                      : "background: #f9f9f9; border-left: 3px solid transparent;";
                    const cellContent = inspection 
                      ? getStatusIndicator(inspection.status) 
                      : "";
                    const cellTitle = inspection 
                      ? `${inspection.status} (${new Date(inspection.inspectedAt).toLocaleDateString()})` 
                      : "Not Inspected";

                    return `<td 
                      style="padding: 4px; border: 1px solid #ddd; text-align: center; ${cellStyle} cursor: pointer;" 
                      title="${cellTitle}"
                      data-model-id="${elementData.modelId}"
                      data-express-id="${elementData.expressID}"
                      data-step-id="${step.stepId}"
                      class="matrix-cell"
                      onclick="window.handleMatrixCellClick('${elementData.modelId}', ${elementData.expressID}, '${step.stepId}', this)"
                    >
                      ${cellContent}
                    </td>`;
                  }).join("")}
                </tr>`
              ).join("")}
            </tbody>
          </table>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.7rem; color: #666; text-align: center;">
          ${elementMap.size} elements • ${allSteps.length} ITP steps
        </div>
      `;
    } catch (error) {
      console.error("Error creating inspection matrix:", error);
      return `
        <div style="padding: 1rem; color: #d32f2f; text-align: center;">
          Error loading inspection matrix. Check console for details.
        </div>
      `;
    }
  };

  // Initialize and update matrix function
  const updateInspectionMatrix = async () => {
    try {
      console.log("Updating inspection matrix...");
      const newContent = await createInspectionMatrix();
      // Find matrix in the DOM after it's rendered
      setTimeout(() => {
        const contentEl = document.querySelector("#matrix-content");
        if (contentEl && typeof newContent === "string") {
          contentEl.innerHTML = newContent;
          console.log("Matrix updated successfully");
        }
      }, 100);
    } catch (error) {
      console.error("Error updating inspection matrix:", error);
    }
  };

  // Matrix cell click handler for element highlighting and camera focus
  const handleMatrixCellClick = async (
    modelId: string,
    expressID: number,
    stepId: string,
    cellElement: HTMLElement,
  ) => {
    try {
      console.log(
        `🎯 Matrix cell clicked: Model ${modelId}, Express ID ${expressID}, Step ${stepId}`,
      );

      const highlighter = components.get(OBF.Highlighter);
      const worlds = components.get(OBC.Worlds);

      // Ensure highlighter is setup
      if (!highlighter.isSetup) {
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

      // Clear previous selections
      await highlighter.clear("select");

      // Remove previous cell selection styling
      document.querySelectorAll(".matrix-cell.selected").forEach((cell) => {
        cell.classList.remove("selected");
        (cell as HTMLElement).style.boxShadow = "";
      });

      // Highlight the selected element using the correct format
      const modelIdMap: Record<string, Set<number>> = {};
      modelIdMap[modelId] = new Set([expressID]);

      await highlighter.highlightByID("select", modelIdMap as any, false);

      // Add visual feedback to the selected cell
      cellElement.classList.add("selected");
      cellElement.style.boxShadow = "inset 0 0 0 2px #1976d2";

      console.log(`✅ Element ${expressID} highlighted successfully`);
    } catch (error) {
      console.error("Error handling matrix cell click:", error);
    }
  };

  // Make the handler available globally for onclick
  (window as any).handleMatrixCellClick = handleMatrixCellClick;

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
      await linkAndSetStatus(selectedStep, selection, "Pass");
      await repaintForStep(components, selectedStep);
      await updateStepsTable();
      await updateInspectionMatrix();
    };
    return BUI.html`<bim-button label="Set Pass" style="background: #4CAF50; color: white;" @click=${onClick}></bim-button>`;
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
      await linkAndSetStatus(selectedStep, selection, "Fail");
      await repaintForStep(components, selectedStep);
      await updateStepsTable();
      await updateInspectionMatrix();
    };
    return BUI.html`<bim-button label="Set Fail" style="background: #F44336; color: white;" @click=${onClick}></bim-button>`;
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
      await linkAndSetStatus(selectedStep, selection, "Ready for Inspection");
      await repaintForStep(components, selectedStep);
      await updateStepsTable();
      await updateInspectionMatrix();
    };
    return BUI.html`<bim-button label="Ready for Inspection" style="background: #0080FF; color: white;" @click=${onClick}></bim-button>`;
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
      await linkAndSetStatus(selectedStep, selection, "NA");
      await repaintForStep(components, selectedStep);
      await updateStepsTable();
      await updateInspectionMatrix();
    };
    return BUI.html`<bim-button label="Set N/A" style="background: #9E9E9E; color: white;" @click=${onClick}></bim-button>`;
  });

  // Clear highlighting button
  const clearBtn = BUI.Component.create(() => {
    const onClick = async () => {
      await clearAllHighlighting(components);
    };
    return BUI.html`<bim-button label="Clear Highlighting" @click=${onClick}></bim-button>`;
  });

  // Matrix component
  const inspectionMatrix = BUI.Component.create(() => {
    return BUI.html`
      <div id="matrix-content" style="padding: 1rem; text-align: center; color: #666;">
        Loading inspection matrix...
      </div>
    `;
  });

  // Initialize matrix after a delay
  setTimeout(updateInspectionMatrix, 1000);

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
      <div style="display:flex; gap:1rem">
        <div><bim-button label="Export CSV" @click=${onCsv}></bim-button></div>
        <div><bim-button label="Export JSON" @click=${onJson}></bim-button></div>
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

  // Layout - Create the panel component
  const panelComponent = BUI.Component.create(
    () => BUI.html`
    <bim-panel class="quality-panel" label="Quality Inspection & Test Plan" style="height: 100vh; overflow-y: auto;">
      <bim-panel-section collapsed label="Instructions" style="padding: 0.5rem;">
        <div style="font-size: 0.875rem; color: var(--bim-ui_main-contrast); line-height: 1.4;">
          <p><strong>Workflow:</strong></p>
          <ol>
            <li>Select a step from the table below</li>
            <li>Select elements in the 3D viewer</li>
            <li>Set status using buttons or hotkeys: P (Pass), F (Fail), O (Ready for Inspection), N (N/A)</li>
            <li>Elements will be automatically linked to the step when setting status</li>
          </ol>
          <p><strong>Colors:</strong> Green = Pass, Red = Fail, Blue = Ready for Inspection, Gray = N/A</p>
        </div>
      </bim-panel-section>

      <bim-panel-section collapsed label="ITP Steps (click to select)">
        ${stepsTable}
      </bim-panel-section>

      <bim-panel-section collapsed label="Selection">
        ${selectionInfo}
      </bim-panel-section>

      <bim-panel-section collapsed label="Status">
        <div style="display: flex; flex-direction: column;">
          <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom: 1.5rem !important;">
            <div>${passBtn}</div>
            <div>${failBtn}</div>
            <div>${openBtn}</div>
            <div>${naBtn}</div>
          </div>
          <div style="display:flex; gap:1rem;">
            <div>${clearBtn}</div>
          </div>
        </div>
      </bim-panel-section>

      <bim-panel-section collapsed label="Inspection Progress Matrix">
        <div style="padding: 0.5rem;">
          <div style="font-size: 0.875rem; color: var(--bim-ui_main-contrast); margin-bottom: 1rem;">
            Visual overview of all element inspection statuses across ITP steps.
          </div>
          <div id="inspection-matrix-container" style="background: white; border-radius: 4px;">
            ${inspectionMatrix}
          </div>
        </div>
      </bim-panel-section>

      <bim-panel-section collapsed label="Import/Export">
        <div style="display: flex; flex-direction: column;">
          <div style="margin-bottom: 1.5rem !important;">
            ${csvImportBtn}
          </div>
          <div>
            ${exportBtns}
          </div>
        </div>
      </bim-panel-section>
    </bim-panel>
  `,
  );

  // Enhanced approach: Force collapsed state using multiple methods
  const forceCollapsedState = () => {
    const panelSections = panelComponent.querySelectorAll("bim-panel-section");
    panelSections.forEach((section) => {
      // Method 1: Set attribute
      section.setAttribute("collapsed", "");

      // Method 2: Set property if available
      if ("collapsed" in section) {
        (section as any).collapsed = true;
      }

      // Method 3: Set CSS custom property
      (section as HTMLElement).style.setProperty(
        "--bim-panel-section--content-height",
        "0px",
      );
    });
  };

  // Apply collapsed state immediately and after DOM updates
  setTimeout(forceCollapsedState, 0);
  setTimeout(forceCollapsedState, 100);
  setTimeout(forceCollapsedState, 500);

  return panelComponent;
}
