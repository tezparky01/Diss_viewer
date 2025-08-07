import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";

interface DataManagementPanelState {
  components: OBC.Components;
}

export const dataManagementTemplate: BUI.StatefullComponent<DataManagementPanelState> = (state) => {
  const { components } = state;
  const classifier = components.get(OBC.Classifier);
  const itemsFinder = components.get(OBC.ItemsFinder);
  const fragments = components.get(OBC.FragmentsManager);

  // Classification Functions
  const onClassifyByCategory = async () => {
    try {
      console.log("Classifying by category...");
      await classifier.byCategory();
      console.log("Classification complete");
      
      // Update results display
      const resultsPanel = document.getElementById("classification-results");
      if (resultsPanel) {
        let html = "<h4>Classification Results:</h4>";
        for (const [classificationName, groups] of classifier.list) {
          html += `<div><strong>${classificationName}:</strong><ul>`;
          for (const [groupName, groupData] of groups) {
            const modelIdMap = groupData.get();
            const itemCount = Object.values(modelIdMap).reduce(
              (sum, ids) => sum + ids.size,
              0,
            );
            html += `<li>${groupName} (${itemCount} items)</li>`;
          }
          html += "</ul></div>";
        }
        resultsPanel.innerHTML = html;
      }
    } catch (error) {
      console.error("Error classifying by category:", error);
    }
  };

  const onClassifyByStorey = async () => {
    try {
      console.log("Classifying by building storey...");
      await classifier.byIfcBuildingStorey();
      console.log("Storey classification complete");
      
      // Update results display (same pattern as above)
      const resultsPanel = document.getElementById("classification-results");
      if (resultsPanel) {
        let html = "<h4>Classification Results:</h4>";
        for (const [classificationName, groups] of classifier.list) {
          html += `<div><strong>${classificationName}:</strong><ul>`;
          for (const [groupName, groupData] of groups) {
            const modelIdMap = groupData.get();
            const itemCount = Object.values(modelIdMap).reduce(
              (sum, ids) => sum + ids.size,
              0,
            );
            html += `<li>${groupName} (${itemCount} items)</li>`;
          }
          html += "</ul></div>";
        }
        resultsPanel.innerHTML = html;
      }
    } catch (error) {
      console.error("Error classifying by storey:", error);
    }
  };

  const onClassifyByModel = async () => {
    try {
      console.log("Classifying by model...");
      await classifier.byModel();
      console.log("Model classification complete");
      
      // Update results display
      const resultsPanel = document.getElementById("classification-results");
      if (resultsPanel) {
        let html = "<h4>Classification Results:</h4>";
        for (const [classificationName, groups] of classifier.list) {
          html += `<div><strong>${classificationName}:</strong><ul>`;
          for (const [groupName, groupData] of groups) {
            const modelIdMap = groupData.get();
            const itemCount = Object.values(modelIdMap).reduce(
              (sum, ids) => sum + ids.size,
              0,
            );
            html += `<li>${groupName} (${itemCount} items)</li>`;
          }
          html += "</ul></div>";
        }
        resultsPanel.innerHTML = html;
      }
    } catch (error) {
      console.error("Error classifying by model:", error);
    }
  };

  // Item Finder Functions
  const onCreateCategoryQueries = async () => {
    try {
      console.log("Creating category-based queries...");
      const categories = await itemsFinder.addFromCategories();
      console.log("Category queries created:", categories);
      
      // Update queries display
      const queriesPanel = document.getElementById("finder-queries");
      if (queriesPanel) {
        let html = "<h4>Available Queries:</h4><ul>";
        for (const [queryName] of itemsFinder.list) {
          html += `
            <li>
              <button class="query-execute-btn" data-query="${queryName}">
                ${queryName}
              </button>
            </li>
          `;
        }
        html += "</ul>";
        queriesPanel.innerHTML = html;
        
        // Add event listeners
        queriesPanel.querySelectorAll(".query-execute-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const queryName = (e.target as HTMLElement).dataset.query;
            if (queryName) {
              try {
                const query = itemsFinder.list.get(queryName);
                if (query) {
                  console.log(`Executing query: ${queryName}`);
                  const results = await itemsFinder.getItems(query.queries);
                  console.log(`Query results:`, results);
                  
                  // Update button text with results
                  (e.target as HTMLElement).textContent = `${queryName} (${Object.values(results).reduce(
                    (sum: number, ids) => sum + ids.size,
                    0,
                  )} items)`;
                }
              } catch (error) {
                console.error(`Error executing query "${queryName}":`, error);
              }
            }
          });
        });
      }
    } catch (error) {
      console.error("Error creating category queries:", error);
    }
  };

  // Data Extraction Functions
  const onExtractElementData = async () => {
    try {
      console.log("Extracting element data...");
      
      // Get all model IDs
      const modelIdMap: OBC.ModelIdMap = {};
      for (const [modelId] of fragments.list) {
        modelIdMap[modelId] = new Set<number>();
      }
      
      if (Object.keys(modelIdMap).length === 0) {
        console.warn("No models available for data extraction");
        return;
      }

      const data = await fragments.getData(modelIdMap);
      console.log("Extracted element data:", data);
      
      // Display results
      const dataPanel = document.getElementById("extracted-data");
      if (dataPanel) {
        let html = "<h4>Extracted Data:</h4>";
        for (const [modelId, items] of Object.entries(data)) {
          html += `<div><strong>Model ${modelId}:</strong><ul>`;
          const displayItems = items.slice(0, 10);
          for (let i = 0; i < displayItems.length; i++) {
            const item = displayItems[i];
            const displayName =
              typeof item.Name === "object" && (item.Name as any)?.value
                ? (item.Name as any).value
                : item.type || "Unknown";
            html += `<li>Item ${i + 1}: ${JSON.stringify(displayName)}</li>`;
          }
          if (items.length > 10) {
            html += `<li>... and ${items.length - 10} more items</li>`;
          }
          html += "</ul></div>";
        }
        dataPanel.innerHTML = html;
      }
    } catch (error) {
      console.error("Error extracting element data:", error);
    }
  };

  const onExportClassificationData = () => {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        classifications: {},
      };

      for (const [classificationName, groups] of classifier.list) {
        (data.classifications as any)[classificationName] = {};
        for (const [groupName, groupData] of groups) {
          (data.classifications as any)[classificationName][groupName] = {
            modelIds: Object.fromEntries(
              Object.entries(groupData.get()).map(([modelId, ids]) => [
                modelId,
                Array.from(ids),
              ]),
            ),
          };
        }
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `classification-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log("Classification data exported");
    } catch (error) {
      console.error("Error exporting classification data:", error);
    }
  };

  const onExportFinderData = () => {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        queries: itemsFinder.export(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finder-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log("Finder data exported");
    } catch (error) {
      console.error("Error exporting finder data:", error);
    }
  };

  return BUI.html`
    <bim-panel label="Data Management">
      <bim-panel-section collapsed label="Element Classification">
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <bim-button @click=${onClassifyByCategory} label="Classify by Category"></bim-button>
          <bim-button @click=${onClassifyByStorey} label="Classify by Building Storey"></bim-button>
          <bim-button @click=${onClassifyByModel} label="Classify by Model"></bim-button>
          <bim-button @click=${onExportClassificationData} label="Export Classification Data"></bim-button>
        </div>
        <div id="classification-results" style="margin-top: 1rem; max-height: 200px; overflow-y: auto;">
          <p>No classifications yet. Use the buttons above to start classifying elements.</p>
        </div>
      </bim-panel-section>
      
      <bim-panel-section collapsed label="Element Finder">
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <bim-button @click=${onCreateCategoryQueries} label="Create Category Queries"></bim-button>
          <bim-button @click=${onExportFinderData} label="Export Finder Data"></bim-button>
        </div>
        <div id="finder-queries" style="margin-top: 1rem; max-height: 200px; overflow-y: auto;">
          <p>No queries available. Create category queries to start.</p>
        </div>
      </bim-panel-section>
      
      <bim-panel-section collapsed label="Data Extraction">
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <bim-button @click=${onExtractElementData} label="Extract All Element Data"></bim-button>
        </div>
        <div id="extracted-data" style="margin-top: 1rem; max-height: 200px; overflow-y: auto;">
          <p>No data extracted yet. Use the button above to extract element data.</p>
        </div>
      </bim-panel-section>
    </bim-panel>
  `;
};
