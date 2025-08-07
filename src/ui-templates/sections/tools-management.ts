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
  const { components, world } = state;

  const lengthMeasurer = components.get(OBF.LengthMeasurement);
  const areaMeasurer = components.get(OBF.AreaMeasurement);
  const clipper = components.get(OBC.Clipper);

  const onClearMeasurements = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    console.log("Clearing all measurements from tools management panel");
    
    // Clear all measurements using the list.clear() method
    lengthMeasurer.list.clear();
    areaMeasurer.list.clear();
    
    target.loading = false;
    update();
  };

  const onClearClippingPlanes = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    const planeIds = Array.from(clipper.list.keys());
    for (const planeId of planeIds) {
      clipper.delete(world, planeId);
    }
    target.loading = false;
    update();
  };

  const measurementCount = lengthMeasurer.list.size + areaMeasurer.list.size;
  const clippingPlaneCount = clipper.list.size;

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
            <span class="card-label">Clipping Planes (${clippingPlaneCount})</span>
            <bim-button 
              style="flex: 0; padding: 0.25rem 0.5rem;" 
              label="Clear All" 
              @click=${onClearClippingPlanes}
              ?disabled=${clippingPlaneCount === 0}
            ></bim-button>
          </div>
          <div style="font-size: 0.85rem; color: var(--bim-ui_bg-contrast-80);">
            Active section planes
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
