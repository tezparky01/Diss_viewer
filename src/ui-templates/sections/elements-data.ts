import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { appIcons } from "../../globals";

export interface ElementsDataPanelState {
  components: OBC.Components;
}

export const elementsDataPanelTemplate: BUI.StatefullComponent<
  ElementsDataPanelState
> = (state) => {
  const { components } = state;

  const fragments = components.get(OBC.FragmentsManager);
  const highlighter = components.get(OBF.Highlighter);

  // Helper function to get Property Sets using correct ThatOpen approach
  const getItemPropertySets = async (model: any, localId: number) => {
    if (!localId) return null;
    try {
      const [data] = await model.getItemsData([localId], {
        attributesDefault: false,
        attributes: ["Name", "NominalValue"],
        relations: {
          IsDefinedBy: { attributes: true, relations: true },
          DefinesOcurrence: { attributes: false, relations: false },
        },
      });
      return data.IsDefinedBy ?? [];
    } catch (error) {
      console.warn("Could not get property sets:", error);
      return [];
    }
  };

  // Helper function to format property sets into readable object
  const formatItemPsets = (rawPsets: any[]) => {
    const result: Record<string, Record<string, any>> = {};
    for (const [_, pset] of rawPsets.entries()) {
      const { Name: psetName, HasProperties } = pset;
      if (!("value" in psetName && Array.isArray(HasProperties))) continue;
      const props: Record<string, any> = {};
      for (const [_, prop] of HasProperties.entries()) {
        const { Name, NominalValue } = prop;
        if (!("value" in Name && "value" in NominalValue)) continue;
        const name = Name.value;
        const nominalValue = NominalValue.value;
        if (!(name && nominalValue !== undefined)) continue;
        props[name] = nominalValue;
      }
      result[psetName.value] = props;
    }
    return result;
  };

  const [propsTable, updatePropsTable] = CUI.tables.itemsData({
    components,
    modelIdMap: {},
  });

  propsTable.preserveStructureOnFilter = true;
  // fragments.onFragmentsDisposed.add(() => updatePropsTable());

  highlighter.events.select.onHighlight.add((modelIdMap) => {
    // const panel = document.getElementById("data")!;
    // panel.style.removeProperty("display");
    updatePropsTable({ modelIdMap });
  });

  highlighter.events.select.onClear.add(() => {
    // const panel = document.getElementById("data")!;
    // panel.style.display = "none";
    updatePropsTable({ modelIdMap: {} });
  });

  const search = (e: Event) => {
    const input = e.target as BUI.TextInput;
    propsTable.queryString = input.value;
  };

  const toggleExpanded = () => {
    propsTable.expanded = !propsTable.expanded;
  };

  // Enhanced export function using correct Property Set extraction
  const exportWithPropertySets = async () => {
    try {
      console.log("🚀 Starting ENHANCED export with Property Sets...");
      const allElementsData: any[] = [];
      
      for (const [modelId, model] of fragments.list) {
        console.log(`📊 Processing model: ${modelId}`);
        
        // Get all elements with geometry
        const elementIds = await model.getItemsIdsWithGeometry();
        console.log(`Found ${elementIds.length} elements in model ${modelId}`);
        
        for (const elementId of elementIds) {
          try {
            // Get basic element attributes including GUID with more comprehensive approach
            const [basicData] = await model.getItemsData([elementId], {
              attributesDefault: false,
              attributes: ["Name", "GlobalId", "GlobalID", "GUID"],
            });
            
            // Get element category
            const categories = await model.getCategories();
            const allElementIds = await model.getItemsIdsWithGeometry();
            const elementIndex = allElementIds.indexOf(elementId);
            const category = elementIndex >= 0 && categories[elementIndex] ? categories[elementIndex] : "Unknown";
            
            // Get Property Sets using the correct ThatOpen approach
            const rawPsets = await getItemPropertySets(model, elementId);
            const formattedPsets = formatItemPsets(rawPsets);
            
            // Extract GUID with fallback options
            let guid = "";
            if (basicData.GlobalId && "value" in basicData.GlobalId) {
              guid = basicData.GlobalId.value;
            } else if (basicData.GlobalID && "value" in basicData.GlobalID) {
              guid = basicData.GlobalID.value;
            } else if (basicData.GUID && "value" in basicData.GUID) {
              guid = basicData.GUID.value;
            }
            
            // Create element object
            const element: any = {
              ElementID: elementId,
              Model: modelId,
              Category: category,
              Name: (basicData.Name && "value" in basicData.Name) ? basicData.Name.value : `Element_${elementId}`,
              GUID: guid || `MISSING-GUID-${elementId}`,
            };
            
            // Add Property Sets as flattened properties
            for (const [psetName, properties] of Object.entries(formattedPsets)) {
              for (const [propName, propValue] of Object.entries(properties as any)) {
                element[`${psetName}.${propName}`] = propValue;
              }
            }
            
            allElementsData.push(element);
            
            if (Object.keys(formattedPsets).length > 0) {
              console.log(`✅ Element ${elementId}: Found ${Object.keys(formattedPsets).length} property sets`);
            }
            
          } catch (elementError) {
            console.warn(`⚠️ Could not process element ${elementId}:`, elementError);
          }
        }
      }
      
      if (allElementsData.length === 0) {
        alert("No elements with property data found");
        return;
      }
      
      // Export as JSON
      const dataStr = JSON.stringify(allElementsData, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      
      const exportFileDefaultName = `elements-with-psets-${Date.now()}.json`;
      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
      
      console.log(`🎉 Successfully exported ${allElementsData.length} elements with Property Sets!`);
      
    } catch (error) {
      console.error("❌ Enhanced export failed:", error);
      alert("Export failed. Check console for details.");
    }
  };

  const sectionId = BUI.Manager.newRandomId();

  return BUI.html`
    <bim-panel-section fixed id=${sectionId} icon=${appIcons.TASK} label="Selection Data">
      <div style="display: flex; flex-direction: column;">
        <div style="display: flex; gap: 0.375rem; margin-bottom: 1.5rem !important;">
          <bim-text-input @input=${search} vertical placeholder="Search..." debounce="200"></bim-text-input>
          <bim-button style="flex: 0;" @click=${toggleExpanded} icon=${appIcons.EXPAND}></bim-button>
          <bim-button style="flex: 0;" @click=${() => propsTable.downloadData("ElementData", "tsv")} icon=${appIcons.EXPORT} tooltip-title="Export Data" tooltip-text="Export the shown properties to TSV."></bim-button>
          <bim-button style="flex: 0;" @click=${exportWithPropertySets} icon=${appIcons.EXPORT} tooltip-title="Export with Psets" tooltip-text="Export ALL elements with complete Property Sets"></bim-button>
        </div>
        <div>
          ${propsTable}
        </div>
      </div>
    </bim-panel-section> 
  `;
};
