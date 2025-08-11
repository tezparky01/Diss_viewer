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
  getStepStatisticsForLoadedModels,
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
        color: new THREE.Color("#FF8C00"), // Orange to match table cells
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

  // Steps dropdown for better UX
  const stepsDropdown = document.createElement("div");
  stepsDropdown.style.cssText = `
    margin-bottom: 1.5rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    border-radius: 12px;
    border: 1px solid #e3f2fd;
    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.08);
    position: relative;
    overflow: hidden;
  `;

  const createStepsDropdown = () => {
    return `
      <div style="position: relative; z-index: 2;">
        <!-- Header Section -->
        <div style="
          display: flex; 
          align-items: center; 
          gap: 0.75rem; 
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #e3f2fd;
        ">
          <div style="
            width: 4px; 
            height: 24px; 
            background: linear-gradient(135deg, #007bff, #0056b3);
            border-radius: 2px;
          "></div>
          <h3 style="
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: #1a365d;
            letter-spacing: -0.02em;
          ">ITP Step Selection</h3>
        </div>

        <!-- Dropdown Section -->
        <div style="
          display: flex; 
          flex-direction: column; 
          gap: 1rem;
        ">
          <div style="position: relative;">
            <label style="
              display: block;
              font-weight: 500; 
              font-size: 0.9rem; 
              color: #4a5568;
              margin-bottom: 0.5rem;
            ">Select Step</label>
            <select id="steps-dropdown" style="
              width: 100%;
              padding: 0.75rem 1rem;
              font-size: 0.9rem;
              border: 2px solid #e2e8f0;
              border-radius: 8px;
              background: white;
              cursor: pointer;
              transition: all 0.2s ease;
              appearance: none;
              background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"12\\" height=\\"8\\" viewBox=\\"0 0 12 8\\"><path fill=\\"%23666\\" d=\\"M6 8L0 2h12z\\"/></svg>');
              background-repeat: no-repeat;
              background-position: calc(100% - 1rem) center;
              background-size: 12px 8px;
              padding-right: 3rem;
            " onmouseover="this.style.borderColor='#007bff'; this.style.boxShadow='0 0 0 3px rgba(0, 123, 255, 0.1)'" 
               onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'"
               onfocus="this.style.borderColor='#007bff'; this.style.boxShadow='0 0 0 3px rgba(0, 123, 255, 0.1)'"
               onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
              <option value="">Choose an ITP step...</option>
            </select>
          </div>
          
          <!-- Modern Statistics Card -->
          <div id="step-stats" style="
            padding: 1rem;
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            min-height: 4rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.85rem;
            color: #718096;
            text-align: center;
            transition: all 0.3s ease;
          ">
            <div style="
              display: flex;
              align-items: center;
              gap: 0.5rem;
              opacity: 0.7;
            ">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
              </svg>
              Select a step to view inspection statistics
            </div>
          </div>
        </div>
      </div>
      
      <!-- Subtle background decoration -->
      <div style="
        position: absolute;
        top: -50px;
        right: -50px;
        width: 150px;
        height: 150px;
        background: radial-gradient(circle, rgba(0, 123, 255, 0.05) 0%, transparent 70%);
        border-radius: 50%;
        z-index: 1;
      "></div>
    `;
  };

  stepsDropdown.innerHTML = createStepsDropdown();

  // Selected step state
  let selectedStep: string | null = null;

  // Function to update the steps dropdown with statistics
  const updateStepsDropdown = async () => {
    const steps = await db.itp_steps.toArray();
    const dropdown = document.getElementById("steps-dropdown") as HTMLSelectElement;
    const statsDiv = document.getElementById("step-stats") as HTMLDivElement;
    
    if (!dropdown) return;

    // Get loaded model IDs for filtering statistics
    const fragments = components.get(OBC.FragmentsManager);
    const loadedModelIds = Array.from(fragments.list.keys());

    // Clear existing options except the first one
    dropdown.innerHTML = `<option value="">-- Select a step --</option>`;

    const rows = [];
    for (const step of steps) {
      // Use filtered statistics for loaded models only
      const stats = loadedModelIds.length > 0 
        ? await getStepStatisticsForLoadedModels(step.stepId, loadedModelIds)
        : await getStepStatistics(step.stepId);
        
      rows.push({
        stepId: step.stepId,
        name: step.name,
        stats: stats,
      });

      // Add option to dropdown
      const option = document.createElement("option");
      option.value = step.stepId;
      option.textContent = `${step.stepId} - ${step.name}`;
      option.setAttribute("data-pass", stats.pass.toString());
      option.setAttribute("data-fail", stats.fail.toString());
      option.setAttribute("data-open", stats.open.toString());
      option.setAttribute("data-na", stats.na.toString());
      option.setAttribute("data-total", stats.total.toString());
      dropdown.appendChild(option);
    }

    // Restore selected step if it exists
    if (selectedStep && dropdown.querySelector(`option[value="${selectedStep}"]`)) {
      dropdown.value = selectedStep;
      await updateStepStats(selectedStep);
    }

    console.log("📋 Steps dropdown updated with", steps.length, "steps");
  };

  // Function to update step statistics display with modern design
  const updateStepStats = async (stepId: string) => {
    const dropdown = document.getElementById("steps-dropdown") as HTMLSelectElement;
    const statsDiv = document.getElementById("step-stats") as HTMLDivElement;
    
    if (!dropdown || !statsDiv) return;

    // Get loaded model IDs
    const fragments = components.get(OBC.FragmentsManager);
    const loadedModelIds = Array.from(fragments.list.keys());

    // Get step information from database
    const step = await db.itp_steps.where({ stepId }).first();
    // Use filtered statistics for loaded models only
    const stats = loadedModelIds.length > 0 
      ? await getStepStatisticsForLoadedModels(stepId, loadedModelIds)
      : await getStepStatistics(stepId);
    
    if (step) {
      const hasElements = stats.total > 0;
      
      statsDiv.innerHTML = `
        <div style="width: 100%; text-align: left;">
          <!-- Step Header -->
          <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 0.75rem;
          ">
            <div>
              <div style="
                font-weight: 600; 
                font-size: 0.95rem; 
                color: #1a365d;
                margin-bottom: 0.25rem;
              ">${step.stepId}</div>
              <div style="
                font-size: 0.8rem; 
                color: #718096;
                line-height: 1.3;
              ">${step.name || 'No description'}</div>
            </div>
            <div style="
              padding: 0.25rem 0.5rem;
              background: ${hasElements ? '#e6fffa' : '#fff5f5'};
              border: 1px solid ${hasElements ? '#38b2ac' : '#feb2b2'};
              border-radius: 12px;
              font-size: 0.75rem;
              font-weight: 500;
              color: ${hasElements ? '#2c7a7b' : '#c53030'};
            ">
              ${hasElements ? `${stats.total} elements` : 'No elements'}
            </div>
          </div>

          <!-- Statistics Grid -->
          <div style="
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); 
            gap: 0.5rem;
            ${hasElements ? '' : 'opacity: 0.6;'}
          ">
            <!-- Pass -->
            <div style="
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              padding: 0.4rem 0.2rem;
              background: ${stats.pass > 0 ? 'linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%)' : '#f9f9f9'};
              border: 1px solid ${stats.pass > 0 ? '#38a169' : '#e2e8f0'};
              border-radius: 4px;
              transition: all 0.2s ease;
            ">
              <div style="
                font-size: 0.9rem; 
                font-weight: 600; 
                color: ${stats.pass > 0 ? '#2f855a' : '#a0aec0'};
                margin-bottom: 0.15rem;
              ">${stats.pass}</div>
              <div style="
                font-size: 0.55rem; 
                font-weight: 500; 
                color: ${stats.pass > 0 ? '#2f855a' : '#a0aec0'};
                text-transform: uppercase;
                letter-spacing: 0.03em;
              ">Pass</div>
            </div>

            <!-- Fail -->
            <div style="
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              padding: 0.4rem 0.2rem;
              background: ${stats.fail > 0 ? 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)' : '#f9f9f9'};
              border: 1px solid ${stats.fail > 0 ? '#e53e3e' : '#e2e8f0'};
              border-radius: 4px;
              transition: all 0.2s ease;
            ">
              <div style="
                font-size: 0.9rem; 
                font-weight: 600; 
                color: ${stats.fail > 0 ? '#c53030' : '#a0aec0'};
                margin-bottom: 0.15rem;
              ">${stats.fail}</div>
              <div style="
                font-size: 0.55rem; 
                font-weight: 500; 
                color: ${stats.fail > 0 ? '#c53030' : '#a0aec0'};
                text-transform: uppercase;
                letter-spacing: 0.03em;
              ">Fail</div>
            </div>

            <!-- Ready for Inspection -->
            <div style="
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              padding: 0.4rem 0.2rem;
              background: ${stats.open > 0 ? 'linear-gradient(135deg, #ebf8ff 0%, #bee3f8 100%)' : '#f9f9f9'};
              border: 1px solid ${stats.open > 0 ? '#3182ce' : '#e2e8f0'};
              border-radius: 4px;
              transition: all 0.2s ease;
            ">
              <div style="
                font-size: 0.9rem; 
                font-weight: 600; 
                color: ${stats.open > 0 ? '#2b6cb0' : '#a0aec0'};
                margin-bottom: 0.15rem;
              ">${stats.open}</div>
              <div style="
                font-size: 0.55rem; 
                font-weight: 500; 
                color: ${stats.open > 0 ? '#2b6cb0' : '#a0aec0'};
                text-transform: uppercase;
                letter-spacing: 0.03em;
              ">Ready</div>
            </div>

            <!-- N/A -->
            <div style="
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              padding: 0.4rem 0.2rem;
              background: ${stats.na > 0 ? 'linear-gradient(135deg, #f7fafc 0%, #e2e8f0 100%)' : '#f9f9f9'};
              border: 1px solid ${stats.na > 0 ? '#718096' : '#e2e8f0'};
              border-radius: 4px;
              transition: all 0.2s ease;
            ">
              <div style="
                font-size: 0.9rem; 
                font-weight: 600; 
                color: ${stats.na > 0 ? '#cc6600' : '#a0aec0'};
                margin-bottom: 0.15rem;
              ">${stats.na}</div>
              <div style="
                font-size: 0.55rem; 
                font-weight: 500; 
                color: ${stats.na > 0 ? '#cc6600' : '#a0aec0'};
                text-transform: uppercase;
                letter-spacing: 0.03em;
              ">N/A</div>
            </div>
          </div>

          ${!hasElements ? `
            <div style="
              margin-top: 1rem;
              padding: 0.75rem;
              background: #fff5f5;
              border: 1px solid #fed7d7;
              border-radius: 6px;
              text-align: center;
              font-size: 0.8rem;
              color: #c53030;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.5rem;
            ">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
              </svg>
              No elements have been assigned to this step yet
            </div>
          ` : ''}
        </div>
      `;
    } else {
      statsDiv.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e53e3e;
          font-size: 0.85rem;
          gap: 0.5rem;
        ">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
          </svg>
          Step not found in database
        </div>
      `;
    }
  };

  // Load and set initial dropdown state
  const initializeDropdown = async () => {
    await updateStepsDropdown();
    
    // If there was a previously selected step, restore it
    if (selectedStep) {
      const dropdown = stepsDropdown.querySelector("select") as HTMLSelectElement;
      if (dropdown) {
        dropdown.value = selectedStep;
        await updateStepStats(selectedStep);
      }
    }
  };

  // Initial load
  initializeDropdown();

  // Dropdown selection handling
  stepsDropdown.addEventListener("change", async (e: Event) => {
    const dropdown = e.target as HTMLSelectElement;
    const newSelectedStep = dropdown.value;
    
    console.log(`✅ Dropdown selection changed: ${newSelectedStep} (was: ${selectedStep})`);
    
    if (newSelectedStep && newSelectedStep !== "") {
      selectedStep = newSelectedStep;
      await updateStepStats(newSelectedStep);
      repaintForStep(components, newSelectedStep);
    } else {
      console.log("🖱️ No step selected - clearing selected step");
      selectedStep = null;
      // Reset stats display to default
      const statsDiv = document.getElementById("step-stats") as HTMLDivElement;
      if (statsDiv) {
        statsDiv.innerHTML = `
          <div style="
            display: flex;
            align-items: center;
            gap: 0.5rem;
            opacity: 0.7;
            justify-content: center;
          ">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
            Select a step to view inspection statistics
          </div>
        `;
      }
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
        return "background: rgba(255, 165, 0, 0.2); color: #cc6600; border-left: 3px solid #ff8c00;";
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

  // Column management state - moved here to be accessible throughout
  let columnSettings = {
    visibleSteps: new Set<string>(), // Initially all steps visible
    stepOrder: [] as string[], // Custom order for steps  
    sortBy: "none" as "none" | "status" | "date" | "alphabetical",
    groupBy: "none" as "none" | "status" | "model"
  };

  // Matrix cell click handler - defined early to be available
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

  // Create inspection matrix function
  const createInspectionMatrix = async () => {
    try {
      console.log("Creating inspection matrix...");
      
      // Initialize column settings if needed
      if (columnSettings.visibleSteps.size === 0) {
        // Will be initialized when steps are available
      }
      
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
      console.log("🔍 Starting to overlay inspection data...");
      let inspectionCount = 0;
      filteredInspections.forEach((inspection) => {
        if (inspection.expressID) {
          const elementKey = `${inspection.modelId}:${inspection.expressID}`;
          if (allElementsMap.has(elementKey)) {
            const element = allElementsMap.get(elementKey);
            element.guid = inspection.guid; // Update with GUID from inspection data
            element.steps.set(inspection.stepId, inspection);
            inspectionCount++;
            console.log(`✅ Added inspection for Express ID ${inspection.expressID}, Step ${inspection.stepId}, Status: ${inspection.status}`);
          } else {
            console.warn(`⚠️ Element ${elementKey} not found in loaded models for inspection:`, inspection);
          }
        } else {
          console.warn(`⚠️ Inspection missing Express ID:`, inspection);
        }
      });
      
      console.log(`📊 Processed ${inspectionCount} inspections onto ${allElementsMap.size} elements`);

      console.log(`Total elements from all loaded models: ${allElementsMap.size}`);

      if (allElementsMap.size === 0) {
        return `
          <div style="padding: 2rem; text-align: center; color: #666; font-style: italic;">
            No elements found in currently loaded models.<br>
            Ensure models have geometry data and are fully loaded.
          </div>
        `;
      }

      // Initialize column settings if needed
      if (columnSettings.visibleSteps.size === 0) {
        columnSettings.visibleSteps = new Set(allSteps.map((s) => s.stepId));
        columnSettings.stepOrder = allSteps.map((s) => s.stepId);
      }

      // Filter visible steps and sort elements
      const visibleSteps = allSteps.filter(step => columnSettings.visibleSteps.has(step.stepId));
      
      // Apply filtering based on user controls
      const applyFilters = (elements: Array<[string, any]>): Array<[string, any]> => {
        // Get filter values from DOM
        const statusFilterEl = document.getElementById("status-filter") as HTMLSelectElement;
        const elementIdFilterEl = document.getElementById("element-id-filter") as HTMLInputElement;
        
        const statusFilter = statusFilterEl?.value || "";
        const elementIdFilter = elementIdFilterEl?.value || "";
        
        return elements.filter(([expressId, elementData]) => {
          // Element ID filter
          if (elementIdFilter && !expressId.toLowerCase().includes(elementIdFilter.toLowerCase())) {
            return false;
          }
          
          // Get inspections for this element across all visible steps
          const elementInspections = visibleSteps.map(step => 
            elementData.steps.get(step.stepId)
          ).filter(Boolean);
          
          // Combined Status & Progress filter
          if (statusFilter) {
            if (statusFilter === "No Status") {
              // For "No Status", show elements with no inspections across any visible steps
              const hasAnyInspection = elementInspections.some(inspection => inspection !== undefined);
              if (hasAnyInspection) return false;
            } else if (statusFilter === "started") {
              // Progress filter: Started (Has Status) - show elements with any inspection
              const hasAnyInspection = elementInspections.length > 0;
              if (!hasAnyInspection) return false;
            } else if (statusFilter === "not-started") {
              // Progress filter: Not Started (No Status) - show elements with no inspections
              const hasAnyInspection = elementInspections.length > 0;
              if (hasAnyInspection) return false;
            } else {
              // For specific statuses, check if any inspection has that status
              const hasStatus = elementInspections.some(inspection => inspection?.status === statusFilter);
              if (!hasStatus) return false;
            }
          }
          
          return true;
        });
      };
      
      const sortedElements = sortElementsBySettings(Array.from(allElementsMap.entries()));
      const filteredElements = applyFilters(sortedElements);
      const groupedElements = groupElementsBySettings(filteredElements);

      // Group inspections by Express ID instead of GUID - using ALL elements now
      const elementMap = allElementsMap;

      if (elementMap.size === 0) {
        return `
          <div style="padding: 2rem; text-align: center; color: #666; font-style: italic;">
            No elements found in currently loaded models.<br>
            Ensure models have geometry data and are fully loaded.
          </div>
        `;
      }

      // Create modern column controls
      const columnControlsHtml = `
        <div style="
          margin-bottom: 1.5rem; 
          padding: 1.25rem; 
          background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
          border-radius: 12px; 
          border: 1px solid #e3f2fd;
          box-shadow: 0 2px 8px rgba(0, 123, 255, 0.05);
        ">
          <!-- Header -->
          <div style="
            display: flex; 
            align-items: center; 
            gap: 0.75rem; 
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid #e3f2fd;
          ">
            <div style="
              width: 4px; 
              height: 20px; 
              background: linear-gradient(135deg, #007bff, #0056b3);
              border-radius: 2px;
            "></div>
            <h4 style="
              margin: 0;
              font-size: 1rem;
              font-weight: 600;
              color: #1a365d;
              letter-spacing: -0.02em;
            ">Matrix Filters & Controls</h4>
            <div style="
              margin-left: auto;
              font-size: 0.8rem;
              color: #718096;
              padding: 0.25rem 0.75rem;
              background: #e2e8f0;
              border-radius: 12px;
              font-weight: 500;
            ">
              ${visibleSteps.length}/${allSteps.length} columns • ${elementMap.size} elements
            </div>
          </div>

          <!-- Unified Filters & Controls Container -->
          <div style="
            padding: 1.5rem;
            background: #f7fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            margin-bottom: 1rem;
          ">
            <div style="
              display: flex;
              align-items: center;
              gap: 0.75rem;
              margin-bottom: 1.5rem;
            ">
              <svg width="20" height="20" fill="#4a5568" viewBox="0 0 16 16">
                <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
              </svg>
              <h3 style="
                font-size: 1.1rem; 
                font-weight: 700;
                color: #2d3748;
                margin: 0;
              ">Matrix Filters & Controls</h3>
            </div>

            <!-- All Controls in Single Grid -->
            <div style="
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 1rem;
            ">
              <!-- Column Selection -->
              <div>
                <label style="
                  display: block;
                  font-size: 0.85rem;
                  font-weight: 600;
                  color: #4a5568;
                  margin-bottom: 0.5rem;
                ">Column Selection</label>
                <select id="column-selection-dropdown" style="
                  width: 100%;
                  padding: 0.6rem 0.8rem;
                  font-size: 0.85rem;
                  border: 2px solid #e2e8f0;
                  border-radius: 8px;
                  background: white;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  appearance: none;
                  background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"12\\" height=\\"8\\" viewBox=\\"0 0 12 8\\"><path fill=\\"%23666\\" d=\\"M6 8L0 2h12z\\"/></svg>');
                  background-repeat: no-repeat;
                  background-position: calc(100% - 0.8rem) center;
                  background-size: 12px 8px;
                  padding-right: 2.5rem;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                " onmouseover="this.style.borderColor='#007bff'; this.style.boxShadow='0 0 0 3px rgba(0, 123, 255, 0.1)'" 
                   onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'"
                   onfocus="this.style.borderColor='#007bff'; this.style.boxShadow='0 0 0 3px rgba(0, 123, 255, 0.1)'"
                   onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                  <option value="">Choose columns to display...</option>
                  <option value="all">Show All Columns</option>
                  ${allSteps.map(step => `
                    <option value="${step.stepId}">
                      ${step.stepId} - ${step.name || "No description"}
                    </option>
                  `).join("")}
                </select>
              </div>

              <!-- Table Organisation -->
              <div>
                <label style="
                  display: block;
                  font-size: 0.85rem;
                  font-weight: 600;
                  color: #4a5568;
                  margin-bottom: 0.5rem;
                ">Table Organisation</label>
                <select id="organization-select" style="
                  width: 100%;
                  padding: 0.6rem 0.8rem;
                  font-size: 0.85rem;
                  border: 2px solid #e2e8f0;
                  border-radius: 8px;
                  background: white;
                  color: #4a5568;
                  font-weight: 500;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  appearance: none;
                  background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"12\\" height=\\"8\\" viewBox=\\"0 0 12 8\\"><path fill=\\"%23666\\" d=\\"M6 8L0 2h12z\\"/></svg>');
                  background-repeat: no-repeat;
                  background-position: calc(100% - 0.8rem) center;
                  background-size: 12px 8px;
                  padding-right: 2.5rem;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                " onmouseover="this.style.borderColor='#007bff'; this.style.boxShadow='0 0 0 3px rgba(0, 123, 255, 0.1)'" 
                   onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'"
                   onfocus="this.style.borderColor='#007bff'; this.style.boxShadow='0 0 0 3px rgba(0, 123, 255, 0.1)'" 
                   onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'">
                  <option value="none">No Organisation</option>
                  <optgroup label="Group By:">
                    <option value="group-status">Group by Started / Not</option>
                    <option value="group-model">Group by Model</option>
                  </optgroup>
                  <optgroup label="Sort By:">
                    <option value="sort-status">Sort by Status</option>
                    <option value="sort-date">Sort by Date</option>
                    <option value="sort-alphabetical">Sort by Element ID</option>
                  </optgroup>
                </select>
              </div>

              <!-- Status & Progress Filter -->
              <div>
                <label style="
                  display: block;
                  font-size: 0.85rem;
                  font-weight: 600;
                  color: #4a5568;
                  margin-bottom: 0.5rem;
                ">Filter by Status</label>
                <select id="status-filter" style="
                  width: 100%;
                  padding: 0.6rem 0.8rem;
                  font-size: 0.85rem;
                  border: 2px solid #e2e8f0;
                  border-radius: 8px;
                  background: white;
                  color: #4a5568;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  appearance: none;
                  background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"10\\" height=\\"6\\" viewBox=\\"0 0 10 6\\"><path fill=\\"%23666\\" d=\\"M5 6L0 1h10z\\"/></svg>');
                  background-repeat: no-repeat;
                  background-position: calc(100% - 0.8rem) center;
                  background-size: 10px 6px;
                  padding-right: 2.5rem;
                " onmouseover="this.style.borderColor='#007bff'" onmouseout="this.style.borderColor='#e2e8f0'">
                  <option value="">All Elements</option>
                  <optgroup label="By Inspection Status:">
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                    <option value="Ready for Inspection">Ready for Inspection</option>
                    <option value="NA">N/A</option>
                    <option value="No Status">No Status</option>
                  </optgroup>
                  <optgroup label="By Progress:">
                    <option value="started">Started (Has Status)</option>
                    <option value="not-started">Not Started (No Status)</option>
                  </optgroup>
                </select>
              </div>

              <!-- Element ID Filter -->
              <div>
                <label style="
                  display: block;
                  font-size: 0.85rem;
                  font-weight: 600;
                  color: #4a5568;
                  margin-bottom: 0.5rem;
                ">Filter by Element ID</label>
                <input id="element-id-filter" type="text" placeholder="Enter Element ID..." maxlength="9" style="
                  width: 100%;
                  padding: 0.6rem 0.8rem;
                  font-size: 0.85rem;
                  border: 2px solid #e2e8f0;
                  border-radius: 8px;
                  background: white;
                  color: #4a5568;
                  transition: all 0.2s ease;
                  box-sizing: border-box;
                " onmouseover="this.style.borderColor='#007bff'" 
                   onmouseout="this.style.borderColor='#e2e8f0'" 
                   onfocus="this.style.borderColor='#007bff'; this.style.outline='none'; this.style.boxShadow='0 0 0 3px rgba(0, 123, 255, 0.1)'" 
                   onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none'"/>
              </div>

              <!-- Clear Filters -->
              <div style="display: flex; align-items: end;">
                <button id="clear-filters" style="
                  width: 100%;
                  padding: 0.6rem 1rem;
                  font-size: 0.85rem;
                  font-weight: 600;
                  border: 2px solid #e2e8f0;
                  border-radius: 8px;
                  background: white;
                  color: #4a5568;
                  cursor: pointer;
                  transition: all 0.2s ease;
                " onmouseover="this.style.background='#f7fafc'; this.style.borderColor='#007bff'" onmouseout="this.style.background='white'; this.style.borderColor='#e2e8f0'">
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Create matrix content with grouping
      const matrixContent = Object.entries(groupedElements).map(([groupName, elements]) => `
        ${Object.keys(groupedElements).length > 1 ? `
          <div style="margin: ${Object.keys(groupedElements).indexOf(groupName) === 0 ? '0' : '1.5rem'} 0 0.75rem 0; padding: 0.75rem; background: linear-gradient(135deg, #e3f2fd 0%, #f8f9fa 100%); border-left: 4px solid #2196F3; font-weight: bold; font-size: 0.9rem; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>${groupName}</span>
              <span style="font-size: 0.8rem; color: #666; font-weight: normal;">${elements.length} elements</span>
            </div>
          </div>
        ` : ''}
        
        <div style="border: 1px solid #ddd; border-radius: 4px; overflow: auto; max-height: 400px; background: white; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
            <thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 1;">
              <tr>
                <th style="padding: 8px; border: 1px solid #ddd; min-width: 100px; text-align: left; background: #f8f9fa; font-weight: 600;">
                  Express ID
                </th>
                ${visibleSteps.map(step => 
                  `<th style="padding: 4px 2px; border: 1px solid #ddd; min-width: 50px; text-align: center; background: #f8f9fa; writing-mode: vertical-rl; text-orientation: mixed; font-weight: 600;" 
                      title="${step.name}">
                    ${step.stepId}
                  </th>`
                ).join("")}
              </tr>
            </thead>
            <tbody>
              ${elements.map(([, elementData]) => 
                `<tr style="hover:background: #f5f5f5; transition: background-color 0.2s ease;">
                  <td style="padding: 6px 8px; border: 1px solid #ddd; font-family: 'Courier New', monospace; font-weight: bold; cursor: pointer; background: #fafafa;" title="Express ID ${elementData.expressID}">
                    ${elementData.expressID}
                  </td>
                  ${visibleSteps.map((step) => {
                    const inspection = elementData.steps.get(step.stepId);
                    
                    // Debug logging for first few elements
                    if (elementData.expressID <= 10) {
                      console.log(`🔍 Element ${elementData.expressID}, Step ${step.stepId}:`, 
                        inspection ? `Status: ${inspection.status}` : 'No inspection data');
                    }
                    
                    const cellStyle = inspection 
                      ? getStatusCellStyle(inspection.status) 
                      : "background: #f9f9f9; border-left: 3px solid transparent;";
                    const cellContent = inspection 
                      ? getStatusIndicator(inspection.status) 
                      : "";
                    const cellTitle = inspection 
                      ? `${inspection.status} (${new Date(inspection.inspectedAt).toLocaleString()})` 
                      : "Not Inspected - Click to select element";

                    return `<td 
                      style="padding: 4px; border: 1px solid #ddd; text-align: center; ${cellStyle} cursor: pointer; transition: all 0.2s ease;" 
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
      `).join('');

      // Create matrix HTML with full column management
      return `
        ${columnControlsHtml}
        ${matrixContent}
        <div style="margin-top: 0.5rem; font-size: 0.7rem; color: #666; text-align: center; padding: 0.5rem; background: #f8f9fa; border-radius: 3px;">
          📊 Interactive Matrix: ${filteredElements.length} elements across ${visibleSteps.length} visible steps • Click any cell to highlight elements in 3D viewer
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
      
      // Capture current filter values before matrix update
      const statusFilterEl = document.getElementById("status-filter") as HTMLSelectElement;
      const elementIdFilterEl = document.getElementById("element-id-filter") as HTMLInputElement;
      
      const savedStatusValue = statusFilterEl?.value || "";
      const savedElementIdValue = elementIdFilterEl?.value || "";
      
      const newContent = await createInspectionMatrix();
      // Find matrix in the DOM after it's rendered
      setTimeout(() => {
        const contentEl = document.querySelector("#matrix-content");
        if (contentEl && typeof newContent === "string") {
          contentEl.innerHTML = newContent;
          
          // Restore filter values after matrix regeneration
          const newStatusFilter = document.getElementById("status-filter") as HTMLSelectElement;
          const newElementIdFilter = document.getElementById("element-id-filter") as HTMLInputElement;
          
          if (newStatusFilter && savedStatusValue) {
            newStatusFilter.value = savedStatusValue;
            // Restore visual state
            newStatusFilter.style.color = '#2d3748';
            newStatusFilter.style.fontWeight = '600';
          }
          if (newElementIdFilter && savedElementIdValue) {
            newElementIdFilter.value = savedElementIdValue;
            // Restore visual state
            newElementIdFilter.style.fontWeight = '600';
            newElementIdFilter.style.color = '#2d3748';
          }
          
          // Attach event handlers for column controls
          const expandAllBtn = document.getElementById("expand-all-columns");
          const collapseAllBtn = document.getElementById("collapse-all-columns");
          const columnSelectionDropdown = document.getElementById("column-selection-dropdown");
          const organizationSelect = document.getElementById("organization-select");
          
          if (expandAllBtn) {
            expandAllBtn.onclick = () => {
              // Get all steps from current data
              const currentAllSteps = Array.from(columnSettings.stepOrder).map(stepId => ({ stepId }));
              (window as any).expandAllColumns(currentAllSteps);
            };
          }
          if (collapseAllBtn) {
            collapseAllBtn.onclick = () => (window as any).collapseAllColumns();
          }
          if (columnSelectionDropdown) {
            (columnSelectionDropdown as HTMLSelectElement).onchange = (e) => {
              const target = e.target as HTMLSelectElement;
              const selectedValue = target.value;
              
              // Visual feedback for selection
              if (selectedValue && selectedValue !== '') {
                target.style.color = '#2d3748';
                target.style.fontWeight = '600';
              } else {
                target.style.color = '#4a5568';
                target.style.fontWeight = '500';
              }
              
              if (selectedValue === "") {
                // No selection - hide all columns, reset placeholder
                columnSettings.visibleSteps = new Set();
              } else if (selectedValue === "all") {
                // Show all columns
                columnSettings.visibleSteps = new Set(columnSettings.stepOrder);
              } else {
                // Show only the selected column
                columnSettings.visibleSteps = new Set([selectedValue]);
              }
              
              updateInspectionMatrix();
            };
            
            // Set the current selection in the dropdown to maintain state
            const currentSelection = columnSettings.visibleSteps;
            if (currentSelection.size === 0) {
              (columnSelectionDropdown as HTMLSelectElement).value = "";
              (columnSelectionDropdown as HTMLSelectElement).style.color = '#4a5568';
              (columnSelectionDropdown as HTMLSelectElement).style.fontWeight = '500';
            } else if (currentSelection.size === columnSettings.stepOrder.length) {
              (columnSelectionDropdown as HTMLSelectElement).value = "all";
              (columnSelectionDropdown as HTMLSelectElement).style.color = '#2d3748';
              (columnSelectionDropdown as HTMLSelectElement).style.fontWeight = '600';
            } else if (currentSelection.size === 1) {
              const singleStep = Array.from(currentSelection)[0];
              (columnSelectionDropdown as HTMLSelectElement).value = singleStep;
              (columnSelectionDropdown as HTMLSelectElement).style.color = '#2d3748';
              (columnSelectionDropdown as HTMLSelectElement).style.fontWeight = '600';
            }
          }
          if (organizationSelect) {
            (organizationSelect as HTMLSelectElement).onchange = (e) => {
              const target = e.target as HTMLSelectElement;
              const selectedValue = target.value;
              
              // Visual feedback for selection
              if (selectedValue && selectedValue !== 'none') {
                target.style.color = '#2d3748';
                target.style.fontWeight = '600';
              } else {
                target.style.color = '#4a5568';
                target.style.fontWeight = '500';
              }
              
              // Reset both grouping and sorting
              columnSettings.groupBy = "none";
              columnSettings.sortBy = "none";
              
              // Apply the selected organization method
              if (selectedValue.startsWith("group-")) {
                const groupType = selectedValue.replace("group-", "");
                columnSettings.groupBy = groupType === "status" ? "status" : "model";
              } else if (selectedValue.startsWith("sort-")) {
                const sortType = selectedValue.replace("sort-", "");
                if (sortType === "status") {
                  columnSettings.sortBy = "status";
                } else if (sortType === "date") {
                  columnSettings.sortBy = "date";
                } else if (sortType === "alphabetical") {
                  columnSettings.sortBy = "alphabetical";
                } else {
                  columnSettings.sortBy = "none";
                }
              }
              
              updateInspectionMatrix();
            };
            
            // Set the current selection in the dropdown to maintain state
            const currentGrouping = columnSettings.groupBy;
            const currentSorting = columnSettings.sortBy;
            
            if (currentGrouping === "status") {
              (organizationSelect as HTMLSelectElement).value = "group-status";
              (organizationSelect as HTMLSelectElement).style.color = '#2d3748';
              (organizationSelect as HTMLSelectElement).style.fontWeight = '600';
            } else if (currentGrouping === "model") {
              (organizationSelect as HTMLSelectElement).value = "group-model";
              (organizationSelect as HTMLSelectElement).style.color = '#2d3748';
              (organizationSelect as HTMLSelectElement).style.fontWeight = '600';
            } else if (currentSorting === "status") {
              (organizationSelect as HTMLSelectElement).value = "sort-status";
              (organizationSelect as HTMLSelectElement).style.color = '#2d3748';
              (organizationSelect as HTMLSelectElement).style.fontWeight = '600';
            } else if (currentSorting === "date") {
              (organizationSelect as HTMLSelectElement).value = "sort-date";
              (organizationSelect as HTMLSelectElement).style.color = '#2d3748';
              (organizationSelect as HTMLSelectElement).style.fontWeight = '600';
            } else if (currentSorting === "alphabetical") {
              (organizationSelect as HTMLSelectElement).value = "sort-alphabetical";
              (organizationSelect as HTMLSelectElement).style.color = '#2d3748';
              (organizationSelect as HTMLSelectElement).style.fontWeight = '600';
            } else {
              (organizationSelect as HTMLSelectElement).value = "none";
              (organizationSelect as HTMLSelectElement).style.color = '#4a5568';
              (organizationSelect as HTMLSelectElement).style.fontWeight = '500';
            }
          }

          // Attach event handlers for filtering controls
          const statusFilter = document.getElementById("status-filter");
          const elementIdFilter = document.getElementById("element-id-filter");
          const clearFiltersBtn = document.getElementById("clear-filters");

          if (statusFilter) {
            (statusFilter as HTMLSelectElement).onchange = (e) => {
              const target = e.target as HTMLSelectElement;
              // Update visual feedback for selection
              if (target.value) {
                target.style.color = '#2d3748';
                target.style.fontWeight = '600';
              } else {
                target.style.color = '#4a5568';
                target.style.fontWeight = '500';
              }
              updateInspectionMatrix();
            };
            
            // Restore status filter visual state based on current value
            const currentStatusValue = (statusFilter as HTMLSelectElement).value;
            if (currentStatusValue) {
              (statusFilter as HTMLSelectElement).style.color = '#2d3748';
              (statusFilter as HTMLSelectElement).style.fontWeight = '600';
            } else {
              (statusFilter as HTMLSelectElement).style.color = '#4a5568';
              (statusFilter as HTMLSelectElement).style.fontWeight = '500';
            }
          }

          if (elementIdFilter) {
            // Fix Element ID filter with proper event handling and debouncing
            let elementIdTimeout: any; // Use any instead of NodeJS.Timeout for compatibility
            const handleElementIdChange = () => {
              clearTimeout(elementIdTimeout);
              elementIdTimeout = setTimeout(() => {
                updateInspectionMatrix();
              }, 800); // 800ms debounce to allow more comfortable typing time
            };

            (elementIdFilter as HTMLInputElement).addEventListener('input', handleElementIdChange);
            (elementIdFilter as HTMLInputElement).addEventListener('keyup', handleElementIdChange);
            
            // Visual feedback for Element ID input
            (elementIdFilter as HTMLInputElement).addEventListener('input', (e) => {
              const target = e.target as HTMLInputElement;
              if (target.value) {
                target.style.fontWeight = '600';
                target.style.color = '#2d3748';
              } else {
                target.style.fontWeight = '400';
                target.style.color = '#4a5568';
              }
            });
            
            // Restore Element ID filter visual state based on current value
            const currentElementIdValue = (elementIdFilter as HTMLInputElement).value;
            if (currentElementIdValue) {
              (elementIdFilter as HTMLInputElement).style.fontWeight = '600';
              (elementIdFilter as HTMLInputElement).style.color = '#2d3748';
            } else {
              (elementIdFilter as HTMLInputElement).style.fontWeight = '400';
              (elementIdFilter as HTMLInputElement).style.color = '#4a5568';
            }
          }

          if (clearFiltersBtn) {
            clearFiltersBtn.onclick = () => {
              // Clear all filter values and reset visual states
              if (statusFilter) {
                (statusFilter as HTMLSelectElement).value = '';
                (statusFilter as HTMLSelectElement).style.color = '#4a5568';
                (statusFilter as HTMLSelectElement).style.fontWeight = '500';
              }
              if (elementIdFilter) {
                (elementIdFilter as HTMLInputElement).value = '';
                (elementIdFilter as HTMLInputElement).style.fontWeight = '400';
                (elementIdFilter as HTMLInputElement).style.color = '#4a5568';
              }
              // Reset organization select as well
              if (organizationSelect) {
                (organizationSelect as HTMLSelectElement).value = 'none';
                (organizationSelect as HTMLSelectElement).style.color = '#4a5568';
                (organizationSelect as HTMLSelectElement).style.fontWeight = '500';
                columnSettings.groupBy = "none";
                columnSettings.sortBy = "none";
              }
              // Reset column selection 
              if (columnSelectionDropdown) {
                (columnSelectionDropdown as HTMLSelectElement).value = '';
                (columnSelectionDropdown as HTMLSelectElement).style.color = '#4a5568';
                (columnSelectionDropdown as HTMLSelectElement).style.fontWeight = '500';
                columnSettings.visibleSteps = new Set();
              }
              updateInspectionMatrix();
            };
          }
          
          console.log("Matrix updated successfully with column controls and filters");
        }
      }, 100);
    } catch (error) {
      console.error("Error updating inspection matrix:", error);
    }
  };

  // Initialize column settings when steps are loaded
  // Column management UI - with dropdown for column selection
  const createColumnControls = (allSteps: any[]) => {
    const visibleCount = columnSettings.visibleSteps.size;
    const totalCount = allSteps.length;
    
    return `
      <div style="margin-bottom: 1rem; padding: 0.75rem; background: #f8f9fa; border-radius: 4px; border: 1px solid #e9ecef;">
        <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <strong style="font-size: 0.85rem;">Matrix Controls:</strong>
            <button id="expand-all-columns" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border: 1px solid #ccc; border-radius: 3px; background: white; cursor: pointer;" title="Show all columns">
              ⊞ Expand All
            </button>
            <button id="collapse-all-columns" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border: 1px solid #ccc; border-radius: 3px; background: white; cursor: pointer;" title="Hide all columns">
              ⊟ Collapse All
            </button>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="font-size: 0.8rem;">Show Columns:</label>
            <select id="column-visibility-select" multiple style="padding: 0.25rem; font-size: 0.75rem; border: 1px solid #ccc; border-radius: 3px; min-width: 150px; max-height: 120px;" title="Hold Ctrl/Cmd to select multiple columns">
              ${allSteps.map(step => `
                <option value="${step.stepId}" ${columnSettings.visibleSteps.has(step.stepId) ? 'selected' : ''} title="${step.name}">
                  ${step.stepId} - ${step.name?.substring(0, 30)}${step.name?.length > 30 ? '...' : ''}
                </option>
              `).join('')}
            </select>
            <span style="font-size: 0.7rem; color: #666;">(${visibleCount}/${totalCount} shown)</span>
          </div>
          
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="font-size: 0.8rem;">Group by:</label>
            <select id="group-by-select" style="padding: 0.25rem; font-size: 0.75rem; border: 1px solid #ccc; border-radius: 3px;">
              <option value="none">No Grouping</option>
              <option value="status">Inspection Status</option>
              <option value="model">Model</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="font-size: 0.8rem;">Sort by:</label>
            <select id="sort-by-select" style="padding: 0.25rem; font-size: 0.75rem; border: 1px solid #ccc; border-radius: 3px;">
              <option value="none">No Sorting</option>
              <option value="status">Completion Status</option>
              <option value="date">Last Updated</option>
              <option value="alphabetical">Express ID</option>
            </select>
          </div>
        </div>
        
        <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #666; font-style: italic;">
          💡 Tip: Use the dropdown to select which ITP steps to display as columns. Hold Ctrl/Cmd to select multiple.
        </div>
      </div>
    `;
  };

  // Column management functions
  const toggleColumn = (stepId: string) => {
    if (columnSettings.visibleSteps.has(stepId)) {
      columnSettings.visibleSteps.delete(stepId);
    } else {
      columnSettings.visibleSteps.add(stepId);
    }
    updateInspectionMatrix(); // Refresh the matrix
  };

  const toggleAllColumns = (allSteps: any[]) => {
    const allVisible = allSteps.every(step => columnSettings.visibleSteps.has(step.stepId));
    if (allVisible) {
      columnSettings.visibleSteps.clear(); // Hide all
    } else {
      // Show all
      allSteps.forEach(step => columnSettings.visibleSteps.add(step.stepId));
    }
    updateInspectionMatrix();
  };

  const resetColumns = (allSteps: any[]) => {
    columnSettings.visibleSteps = new Set(allSteps.map((s) => s.stepId));
    columnSettings.stepOrder = allSteps.map((s) => s.stepId);
    columnSettings.groupBy = "none";
    columnSettings.sortBy = "none";
    updateInspectionMatrix();
  };

  const sortElementsBySettings = (elementEntries: [string, any][]): [string, any][] => {
    switch (columnSettings.sortBy) {
      case "status":
        return elementEntries.sort(([, a], [, b]) => {
          const aCompleted = Array.from(a.steps.values()).length;
          const bCompleted = Array.from(b.steps.values()).length;
          return bCompleted - aCompleted; // Most completed first
        });
      case "date":
        return elementEntries.sort(([, a], [, b]) => {
          const aLatest = Math.max(...Array.from(a.steps.values()).map((s: any) => new Date(s.inspectedAt).getTime()), 0);
          const bLatest = Math.max(...Array.from(b.steps.values()).map((s: any) => new Date(s.inspectedAt).getTime()), 0);
          return bLatest - aLatest; // Most recent first
        });
      case "alphabetical":
        return elementEntries.sort(([, a], [, b]) => {
          return String(a.expressID).localeCompare(String(b.expressID), undefined, { numeric: true });
        });
      default:
        return elementEntries;
    }
  };

  const groupElementsBySettings = (elementEntries: [string, any][]): { [key: string]: [string, any][] } => {
    if (columnSettings.groupBy === "none") {
      return { "All Elements": elementEntries };
    }

    const groups: { [key: string]: [string, any][] } = {};

    elementEntries.forEach(([key, element]) => {
      let groupKey = "Unknown";

      switch (columnSettings.groupBy) {
        case "status":
          const completedSteps = Array.from(element.steps.values()).length;
          const totalVisibleSteps = columnSettings.visibleSteps.size;
          if (completedSteps === 0) {
            groupKey = "🔴 Not Started";
          } else if (completedSteps === totalVisibleSteps) {
            groupKey = "🟢 Completed";
          } else {
            groupKey = `🟡 In Progress (${completedSteps}/${totalVisibleSteps})`;
          }
          break;
        case "model":
          groupKey = `📁 Model: ${element.modelId}`;
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push([key, element]);
    });

    return groups;
  };

  // Update dropdown selection to match current visible steps
  const updateColumnDropdownSelection = () => {
    const dropdown = document.getElementById("column-selection-dropdown") as HTMLSelectElement;
    if (dropdown) {
      const visibleStepsArray = Array.from(columnSettings.visibleSteps);
      if (visibleStepsArray.length === 0) {
        dropdown.value = "";
      } else if (visibleStepsArray.length === columnSettings.stepOrder.length) {
        dropdown.value = "all";
      } else if (visibleStepsArray.length === 1) {
        dropdown.value = visibleStepsArray[0];
      } else {
        // Multiple steps selected - default to "all"
        dropdown.value = "all";
      }
    }
  };

  // Toggle column header functionality (Excel-like)
  const toggleColumnHeader = async (stepId: string) => {
    if (columnSettings.visibleSteps.has(stepId)) {
      columnSettings.visibleSteps.delete(stepId);
    } else {
      columnSettings.visibleSteps.add(stepId);
    }
    await updateInspectionMatrix(); // Use updateInspectionMatrix instead
    updateColumnDropdownSelection();
  };

  // Expand all columns
  const expandAllColumns = async (allSteps: any[]) => {
    allSteps.forEach((step) => columnSettings.visibleSteps.add(step.stepId));
    await updateInspectionMatrix();
    // Update dropdown selection
    updateColumnDropdownSelection();
  };

  // Collapse all columns (keep at least Express ID)
  const collapseAllColumns = async () => {
    columnSettings.visibleSteps.clear();
    await updateInspectionMatrix();
    // Update dropdown selection
    updateColumnDropdownSelection();
  };

  // Make functions available globally
  (window as any).toggleColumn = toggleColumn;
  (window as any).toggleColumnHeader = toggleColumnHeader;
  (window as any).expandAllColumns = expandAllColumns;
  (window as any).collapseAllColumns = collapseAllColumns;
  (window as any).toggleAllColumns = (allSteps: any[]) => toggleAllColumns(allSteps);
  (window as any).resetColumns = (allSteps: any[]) => resetColumns(allSteps);

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
      await updateStepsDropdown();
      // Small delay to ensure database operations complete
      setTimeout(async () => {
        console.log("🔄 Refreshing matrix after Pass status set...");
        await updateInspectionMatrix();
      }, 100);
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
      await updateStepsDropdown();
      // Small delay to ensure database operations complete
      setTimeout(async () => {
        console.log("🔄 Refreshing matrix after Fail status set...");
        await updateInspectionMatrix();
      }, 100);
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
      await updateStepsDropdown();
      // Small delay to ensure database operations complete
      setTimeout(async () => {
        console.log("🔄 Refreshing matrix after Ready for Inspection status set...");
        await updateInspectionMatrix();
      }, 100);
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
      await updateStepsDropdown();
      // Small delay to ensure database operations complete
      setTimeout(async () => {
        console.log("🔄 Refreshing matrix after N/A status set...");
        await updateInspectionMatrix();
      }, 100);
    };
    return BUI.html`<bim-button label="Set N/A" style="background: #FF8C00; color: white;" @click=${onClick}></bim-button>`;
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
          await updateStepsDropdown();
          console.log(`Imported ${steps.length} ITP steps from CSV`);
        }
      };
      input.click();
    };
    return BUI.html`<bim-button label="Import CSV Steps" @click=${onImport}></bim-button>`;
  });

  // Clear Cache button
  const clearCacheBtn = BUI.Component.create(() => {
    const onClick = async () => {
      // Show confirmation dialog
      const confirmed = confirm(
        "Are you sure you want to clear the database cache?\n\n" +
        "This will:\n" +
        "• Clear all loaded ITP steps and data\n" +
        "• Reset all BIM model inspection statuses\n" +
        "• Remove all element-step associations\n" +
        "• Clear inspection progress matrix\n\n" +
        "This action cannot be undone."
      );
      
      if (!confirmed) return;
      
      try {
        console.log("🗑️ Clearing database cache...");
        
        // Clear ITP database cache
        await db.itp_steps.clear();
        await db.inspections.clear();
        console.log("Database tables cleared successfully");
        
        // Reset column settings
        columnSettings.stepOrder = [];
        columnSettings.visibleSteps = new Set();
        columnSettings.groupBy = "none";
        columnSettings.sortBy = "none";
        
        // Reset selected step
        selectedStep = null;
        
        // Clear highlighting
        const highlighter = components.get(OBF.Highlighter);
        highlighter.clear();
        
        // Clear all element highlighting/coloring
        clearAllHighlighting(components);
        
        // Reset UI components
        await updateStepsDropdown();
        await updateInspectionMatrix();
        await updateSelectionInfo();
        
        alert("Database cache cleared successfully!\n\nAll ITP data and inspection statuses have been reset.");
        console.log("✅ Database cache cleared successfully");
        
      } catch (error) {
        console.error("❌ Error clearing database cache:", error);
        alert("Error clearing database cache. Check console for details.");
      }
    };
    
    return BUI.html`<bim-button label="Clear Database Cache" style="background: #FF6B6B; color: white;" @click=${onClick}></bim-button>`;
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

      <bim-panel-section collapsed label="ITP Steps">
        ${stepsDropdown}
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
          <div style="margin-bottom: 1.5rem !important;">
            ${clearCacheBtn}
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
