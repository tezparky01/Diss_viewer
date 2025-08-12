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
  /*
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
  */

  // Simple CSV export function
  const exportSimpleCSV = async () => {
    try {
      const data = ["ElementID,Model,Category,Name,GUID,PropertySet,PropertyName,PropertyValue"];
      
      for (const [modelId, model] of fragments.list) {
        const elementIds = await model.getItemsIdsWithGeometry();
        const categories = await model.getCategories();
        
        for (let i = 0; i < elementIds.length; i++) {
          const elementId = elementIds[i];
          const category = categories[i] || "Unknown";
          
          try {
            const [basicData] = await model.getItemsData([elementId], {
              attributesDefault: false,
              attributes: ["Name", "GlobalId"],
            });
            
            const elementName = (basicData.Name && "value" in basicData.Name) 
              ? basicData.Name.value 
              : `Element_${elementId}`;
            const guid = (basicData.GlobalId && "value" in basicData.GlobalId)
              ? basicData.GlobalId.value
              : "";
            
            const rawPsets = await getItemPropertySets(model, elementId);
            const formattedPsets = formatItemPsets(rawPsets);
            
            for (const [psetName, properties] of Object.entries(formattedPsets)) {
              for (const [propName, propValue] of Object.entries(properties as any)) {
                data.push(`"${elementId}","${modelId}","${category}","${elementName}","${guid}","${psetName}","${propName}","${propValue}"`);
              }
            }
          } catch (error) {
            console.warn(`Could not process element ${elementId}`);
          }
        }
      }
      
      const csvContent = data.join("\n");
      const link = document.createElement("a");
      link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
      link.download = `elements-export-${Date.now()}.csv`;
      link.click();
    } catch (error) {
      console.error("CSV export failed:", error);
    }
  };

  // True Star Schema with consistent hash-based IDs
  const exportTrueStarSchema = async () => {
    try {
      console.log("🌟 Starting True Star Schema JSON export with consistent IDs...");
      
      // Hash function for consistent IDs
      const simpleHash = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
      };
      
      // Dimension Tables with consistent hash-based IDs
      const dimModels = new Map<string, {model_id: number; model_name: string}>();
      const dimElementTypes = new Map<string, {element_type_id: number; element_type_name: string}>();
      const dimPropertySets = new Map<string, {property_set_id: number; property_set_name: string}>();
      const dimProperties = new Map<string, {property_id: number; property_name: string; property_set_id: number; data_type: string}>();
      
      // DUAL FACT TABLES - Separate element and property facts
      const factElements: Array<{
        element_express_id: number;
        element_guid: string;
        model_id: number;
        element_type_id: number;
        element_count: number;
      }> = [];
      
      const factProperties: Array<{
        element_express_id: number;
        element_guid: string;
        property_id: number;
        property_set_id: number;
        model_id: number;
        element_type_id: number;
        property_value: any;
        data_type: string;
        property_count: number;
      }> = [];
      
      // Track processed elements to avoid duplicates in FACT_Elements
      const processedElements = new Set<string>();
      
      // Process all models and build dimensional data
      for (const [modelName, model] of fragments.list) {
        console.log(`📊 Processing model: ${modelName}`);
        
        // Add to Models dimension with consistent hash-based ID
        const modelId = simpleHash(`model_${modelName}`);
        if (!dimModels.has(modelName)) {
          dimModels.set(modelName, { model_id: modelId, model_name: modelName });
        }
        
        const elementIds = await model.getItemsIdsWithGeometry();
        const categories = await model.getCategories();
        
        for (let i = 0; i < elementIds.length; i++) {
          const elementId = elementIds[i];
          const categoryName = categories[i] || "Unknown";
          
          try {
            const [basicData] = await model.getItemsData([elementId], {
              attributesDefault: false,
              attributes: ["Name", "GlobalId"],
            });
            
            const guid = (basicData.GlobalId && "value" in basicData.GlobalId)
              ? basicData.GlobalId.value
              : `GUID_${modelName}_${elementId}`;
            
            // Add to ElementTypes dimension with consistent hash-based ID
            const elementTypeId = simpleHash(`elementtype_${categoryName}`);
            if (!dimElementTypes.has(categoryName)) {
              dimElementTypes.set(categoryName, { 
                element_type_id: elementTypeId, 
                element_type_name: categoryName 
              });
            }
            
            // Add to FACT_Elements (one row per element, avoid duplicates)
            const elementKey = `${modelId}_${elementId}_${guid}`;
            if (!processedElements.has(elementKey)) {
              factElements.push({
                element_express_id: elementId,
                element_guid: guid,
                model_id: modelId,
                element_type_id: elementTypeId,
                element_count: 1  // Always 1 for counting elements
              });
              processedElements.add(elementKey);
            }
            
            // Process Property Sets for FACT_Properties
            const rawPsets = await getItemPropertySets(model, elementId);
            const formattedPsets = formatItemPsets(rawPsets);
            
            for (const [psetName, properties] of Object.entries(formattedPsets)) {
              // Add to PropertySets dimension with consistent hash-based ID
              const psetId = simpleHash(`pset_${psetName}`);
              if (!dimPropertySets.has(psetName)) {
                dimPropertySets.set(psetName, { property_set_id: psetId, property_set_name: psetName });
              }
              
              for (const [propName, propValue] of Object.entries(properties as any)) {
                // Add to Properties dimension with consistent hash-based ID
                const propertyId = simpleHash(`prop_${psetName}_${propName}`);
                const propKey = `${psetName}_${propName}`;
                if (!dimProperties.has(propKey)) {
                  // Determine data type
                  let dataType: string = typeof propValue;
                  if (dataType === 'object' && propValue !== null) {
                    dataType = Array.isArray(propValue) ? 'array' : 'object';
                  }
                  
                  dimProperties.set(propKey, { 
                    property_id: propertyId, 
                    property_name: propName, 
                    property_set_id: psetId,
                    data_type: dataType
                  });
                }
                
                // Add to FACT_Properties (element-property relationships)
                const dataType = typeof propValue;
                factProperties.push({
                  element_express_id: elementId,
                  element_guid: guid,
                  property_id: propertyId,
                  property_set_id: psetId,
                  model_id: modelId,
                  element_type_id: elementTypeId,
                  property_value: propValue,
                  data_type: dataType === 'object' && propValue !== null 
                    ? (Array.isArray(propValue) ? 'array' : 'object') 
                    : dataType,
                  property_count: 1  // Always 1 for counting properties
                });
              }
            }
          } catch (error) {
            console.warn(`Could not process element ${elementId}`);
          }
        }
      }
      
      // Generate metadata for dual FACT star schema export
      const exportTimestamp = new Date().toISOString();
      const metadata = {
        exportType: "TP_StS1",
        exportTimestamp,
        processedModels: Array.from(fragments.list.keys()),
        totalElements: factElements.length,
        totalProperties: factProperties.length,
        uniqueElementTypes: dimElementTypes.size,
        uniquePropertySets: dimPropertySets.size,
        uniqueProperties: dimProperties.size
      };
      
      console.log("📊 Export Summary:", metadata);
      
      // Generate 6 separate files with delay to prevent browser blocking  
      const downloadWithDelay = (content: string, filename: string, delay: number) => {
        setTimeout(() => {
          const link = document.createElement("a");
          link.href = `data:application/json;charset=utf-8,${encodeURIComponent(content)}`;
          link.download = filename;
          link.click();
        }, delay);
      };
      
      // 1. Properties Dimension - flattened for BI tools
      downloadWithDelay(
        JSON.stringify(Array.from(dimProperties.values()).map(prop => ({
          ...prop,
          exportTimestamp
        })), null, 2),
        "DIM_Properties.json",
        100
      );
      
      // 2. ElementTypes Dimension - flattened for BI tools  
      downloadWithDelay(
        JSON.stringify(Array.from(dimElementTypes.values()).map(type => ({
          ...type,
          exportTimestamp
        })), null, 2),
        "DIM_ElementType.json",
        200
      );
      
      // 3. Models Dimension - flattened for BI tools
      downloadWithDelay(
        JSON.stringify(Array.from(dimModels.values()).map(model => ({
          ...model,
          exportTimestamp
        })), null, 2),
        "DIM_Models.json",
        300
      );
      
      // 4. PropertySets Dimension - flattened for BI tools
      downloadWithDelay(
        JSON.stringify(Array.from(dimPropertySets.values()).map(pset => ({
          ...pset,
          exportTimestamp
        })), null, 2),
        "DIM_PropertySet.json",
        400
      );
      
      // 5. FACT_Elements - flattened for BI tools (one row per element)
      downloadWithDelay(
        JSON.stringify(factElements.map(fact => ({
          ...fact,
          exportTimestamp,
          exportType: metadata.exportType
        })), null, 2),
        "FACT_Elements.json",
        500
      );
      
      // 6. FACT_Properties - flattened for BI tools (element-property relationships)
      downloadWithDelay(
        JSON.stringify(factProperties.map(fact => ({
          ...fact,
          exportTimestamp,
          exportType: metadata.exportType
        })), null, 2),
        "FACT_Properties.json",
        600
      );
      
      console.log(`⭐ Dual FACT Star Schema export complete!`);
      console.log(`📊 FACT_Elements: ${factElements.length} elements`);
      console.log(`📊 FACT_Properties: ${factProperties.length} property relationships`);
      console.log(`📁 6 files: 4 dimension tables + 2 specialized FACT tables`);
      console.log(`� Using hash-based consistent IDs for multi-export compatibility`);
      
    } catch (error) {
      console.error("Dual FACT Star Schema export failed:", error);
      alert("Dual FACT Star Schema export failed. Check console for details.");
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
          <bim-button style="flex: 0;" @click=${exportSimpleCSV} icon=${appIcons.EXPORT} tooltip-title="CSV Export" tooltip-text="Export ALL elements with complete Property Sets to CSV"></bim-button>
          <bim-button style="flex: 0;" @click=${exportTrueStarSchema} icon=${appIcons.EXPORT} tooltip-title="Dual FACT Star Schema" tooltip-text="Export as 6 files: 4 DIM + 2 specialized FACT tables with hash-based consistent IDs"></bim-button>able)"></bim-button>
        </div>
        <div>
          ${propsTable}
        </div>
      </div>
    </bim-panel-section> 
  `;
};
