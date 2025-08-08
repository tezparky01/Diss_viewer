import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { appIcons } from "../../globals";

export interface ToolsManagementPanelState {
  components: OBC.Components;
  world: OBC.World;
}

export const toolsManagementPanelTemplate: BUI.StatefullComponent<
  ToolsManagementPanelState
> = (state, update) => {
  const { components } = state;

  const lengthMeasurer = components.get(OBF.LengthMeasurement);
  const areaMeasurer = components.get(OBF.AreaMeasurement);
  const fragments = components.get(OBC.FragmentsManager);

  const onClearMeasurements = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    console.log("Clearing all measurements from tools management panel");
    
    // Clear all measurements using the list.clear() method
    lengthMeasurer.list.clear();
    areaMeasurer.list.clear();
    
    target.loading = false;
    update();
  };

  // Helper functions to display data
  const displayExtractedData = (data: Record<string, any[]>) => {
    let displayText = "Element Data Extracted:\n\n";
    let htmlContent = '<div><h4 style="margin: 0 0 0.5rem 0;">Element Data Extracted:</h4>';
    
    for (const [modelId, items] of Object.entries(data)) {
      displayText += `Model ${modelId}: ${items.length} elements\n`;
      htmlContent += `<div style="margin-bottom: 1rem;"><strong>Model ${modelId}:</strong> ${items.length} elements<br>`;
      
      // Show sample of first few items
      const sampleItems = items.slice(0, 5);
      sampleItems.forEach((item, index) => {
        const displayName = typeof item.Name === "object" && (item.Name as any)?.value
          ? (item.Name as any).value
          : item.type || "Unknown";
        displayText += `  - Item ${index + 1}: ${displayName}\n`;
        htmlContent += `<div style="margin-left: 1rem; font-size: 0.8rem; color: var(--bim-ui_bg-contrast-80);">• ${displayName}</div>`;
      });
      
      if (items.length > 5) {
        displayText += `  ... and ${items.length - 5} more items\n`;
        htmlContent += `<div style="margin-left: 1rem; font-size: 0.8rem; color: var(--bim-ui_bg-contrast-60); font-style: italic;">... and ${items.length - 5} more items</div>`;
      }
      displayText += "\n";
      htmlContent += '</div>';
    }
    
    htmlContent += '<div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--bim-ui_bg-contrast-60);">Full data logged to console for detailed inspection.</div></div>';
    
    // Update UI
    const resultsArea = document.getElementById("extraction-results");
    if (resultsArea) {
      resultsArea.innerHTML = htmlContent;
      const clearBtn = document.getElementById("clear-results-btn");
      if (clearBtn) clearBtn.style.display = "block";
    }
    
    displayText += "Full data logged to console.";
    console.warn(displayText);
    console.log("Detailed element data:", data);
  };

  const displayModelProperties = (modelData: any) => {
    let displayText = "Model Properties:\n\n";
    let htmlContent = '<div><h4 style="margin: 0 0 0.5rem 0;">Model Properties:</h4>';
    
    for (const [modelId, data] of Object.entries(modelData)) {
      const modelInfo = data as any;
      displayText += `${modelInfo.objectName} (${modelId}):\n`;
      displayText += `  - Object Name: ${modelInfo.objectName}\n`;
      displayText += `  - Visible: ${modelInfo.visible}\n`;
      displayText += `  - Children: ${modelInfo.children}\n\n`;
      
      htmlContent += `<div style="margin-bottom: 1rem;">
        <strong>${modelInfo.objectName}</strong> (${modelId})<br>
        <div style="margin-left: 1rem; font-size: 0.85rem; color: var(--bim-ui_bg-contrast-80);">
          • Object Name: ${modelInfo.objectName}<br>
          • Visible: ${modelInfo.visible ? '✅ Yes' : '❌ No'}<br>
          • Children: ${modelInfo.children}
        </div>
      </div>`;
    }
    
    htmlContent += '<div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--bim-ui_bg-contrast-60);">Full data logged to console for detailed inspection.</div></div>';
    
    // Update UI
    const resultsArea = document.getElementById("extraction-results");
    if (resultsArea) {
      resultsArea.innerHTML = htmlContent;
      const clearBtn = document.getElementById("clear-results-btn");
      if (clearBtn) clearBtn.style.display = "block";
    }
    
    displayText += "Full data logged to console.";
    console.warn(displayText);
    console.log("Detailed model properties:", modelData);
  };

  // FragmentsManager Data Extraction Functions
  const getAllModelIds = async (): Promise<OBC.ModelIdMap> => {
    const modelIdMap: OBC.ModelIdMap = {};
    
    try {
      for (const [modelId, model] of fragments.list) {
        console.log("Processing model:", modelId);
        
        // Use the proper API to get all items with geometry
        const fragmentIds = await model.getItemsIdsWithGeometry();
        modelIdMap[modelId] = new Set(fragmentIds);
        console.log(`Model ${modelId}: Found ${fragmentIds.length} fragments with geometry`);
      }
    } catch (error) {
      console.error("Error in getAllModelIds:", error);
    }
    
    console.log("Complete modelIdMap:", modelIdMap);
    return modelIdMap;
  };

  const onExtractElementData = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    try {
      console.log("=== EXTRACTING ELEMENT DATA ===");
      console.log("Available models:", fragments.list.size);
      
      // Get proper fragment IDs using the correct API
      const modelIdMap = await getAllModelIds();
      
      if (Object.keys(modelIdMap).length === 0) {
        console.warn("No models available for data extraction");
        console.warn("No models loaded to extract data from.");
        target.loading = false;
        return;
      }

      console.log("Model ID Map created:", modelIdMap);
      
      // Extract actual element data using the fragments.getData method
      const elementData = await fragments.getData(modelIdMap);
      console.log("Raw element data returned:", elementData);
      
      // Let's also try getting metadata and other information
      for (const [modelId, model] of fragments.list) {
        console.log(`=== MODEL ${modelId} DETAILED INFO ===`);
        
        try {
          const metadata = await model.getMetadata();
          console.log("Model metadata:", metadata);
        } catch (error) {
          console.log("No metadata available:", error);
        }
        
        try {
          const categories = await model.getCategories();
          console.log("Model categories:", categories);
        } catch (error) {
          console.log("No categories available:", error);
        }
        
        try {
          const attributeNames = await model.getAttributeNames();
          console.log("Model attribute names:", attributeNames);
        } catch (error) {
          console.log("No attribute names available:", error);
        }
        
        try {
          const spatialStructure = await model.getSpatialStructure();
          console.log("Spatial structure:", spatialStructure);
        } catch (error) {
          console.log("No spatial structure available:", error);
        }
      }
      
      if (Object.keys(elementData).length > 0) {
        displayExtractedData(elementData);
      } else {
        // Show diagnostic information in UI
        const resultsArea = document.getElementById("extraction-results");
        if (resultsArea) {
          resultsArea.innerHTML = `
            <div style="padding: 1rem; color: var(--bim-ui_bg-contrast-80);">
              <div style="font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--bim-ui_bg-contrast-100);"><strong>Diagnostic Information</strong></div>
              <div style="margin-bottom: 0.5rem;">
                <strong>Models loaded:</strong> ${fragments.list.size}<br>
                <strong>Fragment IDs found:</strong> ${Object.values(modelIdMap).reduce((total, set) => total + set.size, 0)}
              </div>
              <div style="font-size: 0.9rem; color: var(--bim-ui_bg-contrast-70); background-color: var(--bim-ui_bg-base); padding: 0.5rem; border-radius: 0.25rem;">
                <div style="margin-bottom: 0.5rem;"><strong>Possible reasons for no data:</strong></div>
                <div>• Model is a simple geometry file without IFC properties</div>
                <div>• Fragment file was created without property data</div>
                <div>• Model needs to finish loading property data</div>
                <div style="margin-top: 0.5rem; font-style: italic;">Check browser console for detailed diagnostic information.</div>
              </div>
            </div>`;
        }
        console.warn(
          "No element data extracted - fragments may not have loaded properties",
        );
        console.warn(
          "No element data available. Ensure models are fully loaded with properties.",
        );
      }
    } catch (error) {
      console.error("Error extracting element data:", error);
      console.warn("Error extracting data. Check console for details.");
    }
    target.loading = false;
  };

  const onExtractModelProperties = async ({
    target,
  }: {
    target: BUI.Button;
  }) => {
    target.loading = true;
    try {
      console.log("=== EXTRACTING MODEL PROPERTIES ===");
      console.log("Extracting model properties...");
      
      const modelData: any = {};
      
      for (const [modelId, model] of fragments.list) {
        console.log(`Processing model: ${modelId}`);
        
        // Get basic model info
        modelData[modelId] = {
          id: modelId,
          objectName: model.object.name || modelId,
          visible: model.object.visible,
          children: model.object.children.length,
        };
        
        // Try to get additional model information
        try {
          const maxLocalId = await model.getMaxLocalId();
          modelData[modelId].maxLocalId = maxLocalId;
          console.log(`Model ${modelId} max local ID: ${maxLocalId}`);
        } catch (error) {
          console.log(`Could not get max local ID for ${modelId}:`, error);
        }
        
        try {
          const itemsWithGeometry = await model.getItemsIdsWithGeometry();
          modelData[modelId].itemsWithGeometry = itemsWithGeometry.length;
          console.log(`Model ${modelId} items with geometry: ${itemsWithGeometry.length}`);
        } catch (error) {
          console.log(`Could not get items with geometry for ${modelId}:`, error);
        }
      }
      
      if (Object.keys(modelData).length === 0) {
        // Show no data message in UI
        const resultsArea = document.getElementById("extraction-results");
        if (resultsArea) {
          resultsArea.innerHTML = `
            <div style="text-align: center; padding: 1rem; color: var(--bim-ui_bg-contrast-60);">
              <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">⚠️</div>
              <div>No models available</div>
              <div style="font-size: 0.8rem; margin-top: 0.5rem;">
                Load IFC or Fragment models first.
              </div>
            </div>`;
        }
      }
      
      console.log("Model properties extracted:", modelData);
      displayModelProperties(modelData);
    } catch (error) {
      console.error("Error extracting model properties:", error);
      console.warn(
        "Error extracting model properties. Check console for details.",
      );
    }
    target.loading = false;
  };

  const onExportAllData = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    try {
      console.log("Exporting all data...");
      
      const modelIdMap = await getAllModelIds();
      const elementData =
        Object.keys(modelIdMap).length > 0
          ? await fragments.getData(modelIdMap)
          : {};
      
      const modelProperties: any = {};
      for (const [modelId, model] of fragments.list) {
        modelProperties[modelId] = {
          id: modelId,
          objectName: model.object.name || modelId,
          children: model.object.children.length,
        };
      }

      const exportData = {
        timestamp: new Date().toISOString(),
        modelProperties,
        elementData,
        measurements: {
          length: lengthMeasurer.list.size,
          area: areaMeasurer.list.size,
        },
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bim-data-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log("Data exported successfully");
      console.warn("Data exported successfully!");
    } catch (error) {
      console.error("Error exporting data:", error);
      console.warn("Error exporting data. Check console for details.");
    }
    target.loading = false;
  };

  const measurementCount = lengthMeasurer.list.size + areaMeasurer.list.size;
  const modelCount = fragments.list.size;

  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.SETTINGS} label="Tools Management">
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        
        <div class="dashboard-card" style="padding: 0.75rem; margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span class="card-label">Measurements (${measurementCount})</span>
            <bim-button 
              style="flex: 0; padding: 0.25rem 0.5rem;" 
              label="Clear All" 
              @click=${onClearMeasurements}
              ?disabled=${measurementCount === 0}
            ></bim-button>
          </div>
          <div style="font-size: 0.85rem; color: var(--bim-ui_bg-contrast-80);">
            Length: ${lengthMeasurer.list.size} | Area: ${areaMeasurer.list.size}
          </div>
        </div>

        <div class="dashboard-card" style="padding: 0.75rem; margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span class="card-label">FragmentsManager Data (${modelCount})</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.375rem;">
            <bim-button 
              style="flex: 0; padding: 0.25rem 0.5rem;" 
              label="Extract Elements" 
              @click=${onExtractElementData}
              ?disabled=${modelCount === 0}
            ></bim-button>
            <bim-button 
              style="flex: 0; padding: 0.25rem 0.5rem;" 
              label="Model Properties" 
              @click=${onExtractModelProperties}
              ?disabled=${modelCount === 0}
            ></bim-button>
            <bim-button 
              style="flex: 0; padding: 0.25rem 0.5rem;" 
              label="Export All" 
              @click=${onExportAllData}
              ?disabled=${modelCount === 0}
            ></bim-button>
          </div>
          <div style="font-size: 0.85rem; color: var(--bim-ui_bg-contrast-80); margin-top: 0.5rem;">
            Models loaded: ${modelCount}
          </div>
        </div>

        <div class="dashboard-card" style="padding: 0.75rem; margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span class="card-label">Extraction Results</span>
            <bim-button 
              id="clear-results-btn"
              style="flex: 0; padding: 0.25rem 0.5rem; display: none;" 
              label="Clear" 
              @click=${() => {
                const resultsArea = document.getElementById("extraction-results");
                if (resultsArea) {
                  resultsArea.innerHTML = '<p style="color: var(--bim-ui_bg-contrast-60); font-style: italic;">No data extracted yet. Use the buttons above to extract model data.</p>';
                  document.getElementById("clear-results-btn")!.style.display = "none";
                }
              }}
            ></bim-button>
          </div>
          <div id="extraction-results" style="max-height: 300px; overflow-y: auto; font-size: 0.85rem; background-color: var(--bim-ui_bg-base); padding: 0.5rem; border-radius: 0.25rem;">
            <p style="color: var(--bim-ui_bg-contrast-60); font-style: italic;">No data extracted yet. Use the buttons above to extract model data.</p>
          </div>
        </div>

        <div style="font-size: 0.8rem; color: var(--bim-ui_bg-contrast-60); padding: 0.5rem;">
          <strong>Keyboard Shortcuts:</strong><br>
          • Double-click: Create tool items<br>
          • Delete/Backspace: Remove last item<br>
          • Enter: Complete area measurement
        </div>
      </div>
    </bim-panel-section>
  `;
};
