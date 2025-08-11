import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import createQualityPanel from "../../components/Panels/Quality";

export interface QualityPanelState {
  components: OBC.Components;
  world?: OBC.World;
}

export const qualityPanelTemplate: BUI.StatefullComponent<QualityPanelState> = (
  state,
) => {
  const { components } = state;

  const onCreated = (e?: Element) => {
    if (!e) return;
    const qualityPanel = createQualityPanel(components);
    if (qualityPanel && e instanceof HTMLElement) {
      // Clear the placeholder and add the quality panel
      e.innerHTML = "";
      e.appendChild(qualityPanel);
    }
  };

  return BUI.html`<div style="width: 100%; height: 100%;" ${BUI.ref(
    onCreated,
  )}></div>`;
};