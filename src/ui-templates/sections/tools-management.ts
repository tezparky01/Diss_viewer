import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";

export interface ToolsManagementPanelState {
  components: OBC.Components;
  world: OBC.World;
}

export const toolsManagementPanelTemplate: BUI.StatefullComponent<
  ToolsManagementPanelState
> = () => {
  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.SETTINGS} label="Tools Management">
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        
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
