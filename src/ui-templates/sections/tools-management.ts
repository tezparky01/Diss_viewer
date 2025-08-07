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
    
    for (const [modelId, items] of Object.entries(data)) {
      displayText += `Model ${modelId}: ${items.length} elements\n`;
      
      // Show sample of first few items
      const sampleItems = items.slice(0, 3);
      sampleItems.forEach((item, index) => {
        const displayName = typeof item.Name === "object" && (item.Name as any)?.value
          ? (item.Name as any).value
          : item.type || "Unknown";
        displayText += `  - Item ${index + 1}: ${displayName}\n`;
      });
      
      if (items.length > 3) {
        displayText += `  ... and ${items.length - 3} more items\n`;
      }
      displayText += "\n";
    }
    
    displayText += "Full data logged to console.";
    console.warn(displayText);
  };

  const displayModelProperties = (modelData: any) => {
    let displayText = "Model Properties:\n\n";
    
    for (const [modelId, data] of Object.entries(modelData)) {
      const modelInfo = data as any;
      displayText += `${modelInfo.objectName} (${modelId}):\n`;
      displayText += `  - Object Name: ${modelInfo.objectName}\n`;
      displayText += `  - Visible: ${modelInfo.visible}\n`;
      displayText += `  - Children: ${modelInfo.children}\n\n`;
    }
    
    displayText += "Full data logged to console.";
    console.warn(displayText);
  };

  // FragmentsManager Data Extraction Functions
  const getAllModelIds = (): OBC.ModelIdMap => {
    const modelIdMap: OBC.ModelIdMap = {};
    
    // Try using FragmentsManager's built-in method to get all items
    try {
      for (const [modelId, model] of fragments.list) {
        console.log("Processing model:", modelId);
        
        // Try to get fragment IDs using a different approach
        const fragmentIds = new Set<number>();
        
        // Check if model has geometry data we can extract
        if (model.object && model.object.children.length > 0) {
          // Use child indices as fragment IDs
          for (let i = 0; i < model.object.children.length; i++) {
            fragmentIds.add(i);
          }
        }
        
        modelIdMap[modelId] = fragmentIds;
        console.log(`Model ${modelId}: Created ${fragmentIds.size} fragment IDs`);
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
      console.log("Extracting element data...");
      console.log("Available models:", fragments.list.size);
      
      // For now, let's provide basic model information
      const modelInfo: Record<string, any> = {};
      
      for (const [modelId, model] of fragments.list) {
        console.log(
          "Model object properties:",
          Object.getOwnPropertyNames(model),
        );
        
        modelInfo[modelId] = [
          {
            name: model.object.name || "Model",
            type: "FragmentsModel",
            children: model.object.children.length,
            visible: model.object.visible,
          },
        ];
      }
      
      if (Object.keys(modelInfo).length > 0) {
        console.log("Showing basic model info:", modelInfo);
        displayExtractedData(modelInfo);
      } else {
        console.warn("No model data available");
        console.warn("No models loaded to extract data from.");
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
      console.log("Extracting model properties...");
      
      const modelData: any = {};
      
      for (const [modelId, model] of fragments.list) {
        modelData[modelId] = {
          id: modelId,
          objectName: model.object.name || modelId,
          visible: model.object.visible,
          children: model.object.children.length,
        };
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
      
      const modelIdMap = getAllModelIds();
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
