import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import { ViewerToolbarState, viewerToolbarTemplate } from "..";
import { appIcons, tooltips } from "../../globals";

type BottomToolbar = { name: "bottomToolbar"; state: ViewerToolbarState };
type LeftToolbar = { name: "leftToolbar"; state: {} };

type ViewportGridElements = [BottomToolbar, LeftToolbar];

type ViewportGridLayouts = ["main"];

interface ViewportGridState {
  components: OBC.Components;
  world: OBC.World;
}

export const viewportGridTemplate: BUI.StatefullComponent<ViewportGridState> = (
  state,
) => {
  const { components, world } = state;

  const leftToolbarTemplate: BUI.StatefullComponent = (_: {}, update) => {
    const highlighter = components.get(OBF.Highlighter);
    const lengthMeasurer = components.get(OBF.LengthMeasurement);
    const areaMeasurer = components.get(OBF.AreaMeasurement);
    const clipper = components.get(OBC.Clipper);

    const areMeasurementsEnabled =
      lengthMeasurer.enabled || areaMeasurer.enabled;

    const disableAll = (exceptions?: ("clipper" | "length" | "area")[]) => {
      BUI.ContextMenu.removeMenus();
      highlighter.clear("select");
      highlighter.enabled = false;
      if (!exceptions?.includes("length")) lengthMeasurer.enabled = false;
      if (!exceptions?.includes("area")) areaMeasurer.enabled = false;
      if (!exceptions?.includes("clipper")) clipper.enabled = false;
    };

    const onLengthMeasurement = () => {
      console.log("Length measurement button clicked");
      disableAll(["length"]);
      
      if (lengthMeasurer.enabled) {
        // Disable the tool
        console.log("Disabling length measurement tool");
        lengthMeasurer.enabled = false;
        
        // Remove existing double-click handler
        if (world.renderer && world.renderer.three.domElement.parentElement) {
          world.renderer.three.domElement.parentElement.ondblclick = null;
          console.log("Removed double-click handler from container");
        }
      } else {
        // Enable the tool and set up double-click to create measurements
        console.log("Enabling length measurement tool");
        lengthMeasurer.enabled = true;
        
        // Set up the double-click handler according to documentation
        if (world.renderer && world.renderer.three.domElement.parentElement) {
          world.renderer.three.domElement.parentElement.ondblclick = () => {
            console.log("Double-click detected - creating length measurement");
            lengthMeasurer.create();
          };
          console.log("Set up double-click handler for length measurement");
        }
      }
      
      highlighter.enabled = !lengthMeasurer.enabled;
      console.log("Length measurement enabled:", lengthMeasurer.enabled);
      update();
    };

    const onAreaMeasurement = () => {
      console.log("Area measurement button clicked");
      disableAll(["area"]);
      
      if (areaMeasurer.enabled) {
        // Disable the tool
        console.log("Disabling area measurement tool");
        areaMeasurer.enabled = false;
        
        // Remove existing double-click handler
        if (world.renderer && world.renderer.three.domElement.parentElement) {
          world.renderer.three.domElement.parentElement.ondblclick = null;
          console.log("Removed double-click handler from container");
        }
      } else {
        // Enable the tool and set up double-click to create measurements
        console.log("Enabling area measurement tool");
        areaMeasurer.enabled = true;
        
        // Set up the double-click handler according to documentation
        if (world.renderer && world.renderer.three.domElement.parentElement) {
          world.renderer.three.domElement.parentElement.ondblclick = () => {
            console.log("Double-click detected - creating area measurement");
            areaMeasurer.create();
          };
          console.log("Set up double-click handler for area measurement");
        }
      }
      
      highlighter.enabled = !areaMeasurer.enabled;
      console.log("Area measurement enabled:", areaMeasurer.enabled);
      update();
    };

    const onModelSection = () => {
      console.log("Clipping section button clicked");
      disableAll(["clipper"]);
      
      if (clipper.enabled) {
        // Disable the tool
        console.log("Disabling clipper tool");
        clipper.enabled = false;
        
        // Remove existing double-click handler
        if (world.renderer && world.renderer.three.domElement.parentElement) {
          world.renderer.three.domElement.parentElement.ondblclick = null;
          console.log("Removed double-click handler from container");
        }
      } else {
        // Enable the tool and set up double-click to create clip planes
        console.log("Enabling clipper tool");
        clipper.enabled = true;
        
        // Set up the double-click handler according to documentation
        if (world.renderer && world.renderer.three.domElement.parentElement) {
          world.renderer.three.domElement.parentElement.ondblclick = () => {
            console.log("Double-click detected - creating clip plane");
            clipper.create(world);
          };
          console.log("Set up double-click handler for clipping");
        }
      }
      
      highlighter.enabled = !clipper.enabled;
      console.log("Clipper enabled:", clipper.enabled);
      update();
    };

    const onMeasurementsClick = () => {
      lengthMeasurer.enabled = false;
      areaMeasurer.enabled = false;
      update();
    };

    const onDeleteMeasurements = async ({ target }: { target: BUI.Button }) => {
      target.loading = true;
      // Clear all measurements
      lengthMeasurer.delete();
      areaMeasurer.delete();
      target.loading = false;
    };

    // eslint-disable-next-line prettier/prettier
    const onDeleteClippingPlanes = async ({ target }: { target: BUI.Button }) => {
      target.loading = true;
      // Delete all clipping planes
      const planeIds = Array.from(clipper.list.keys());
      for (const planeId of planeIds) {
        clipper.delete(world, planeId);
      }
      target.loading = false;
    };

    return BUI.html`
      <bim-toolbar style="align-self: start;" vertical>
        <bim-toolbar-section>
          <bim-button @click=${onMeasurementsClick} ?active=${areMeasurementsEnabled} label="Measurements" tooltip-title=${tooltips.MEASUREMENTS.TITLE} tooltip-text=${tooltips.MEASUREMENTS.TEXT} icon=${appIcons.RULER}>
            <bim-context-menu>
              <bim-button ?active=${lengthMeasurer.enabled} label="Length" tooltip-title=${tooltips.LENGTH_MEASURE.TITLE} tooltip-text=${tooltips.LENGTH_MEASURE.TEXT} @click=${onLengthMeasurement}></bim-button>
              <bim-button ?active=${areaMeasurer.enabled} label="Area" tooltip-title=${tooltips.AREA_MEASURE.TITLE} tooltip-text=${tooltips.AREA_MEASURE.TEXT} @click=${onAreaMeasurement}></bim-button>
              <div style="border-top: 1px solid var(--bim-ui_bg-contrast-40); margin: 0.25rem 0; padding-top: 0.25rem;">
                <bim-button label="Delete All" @click=${onDeleteMeasurements} style="color: #ff6b6b;"></bim-button>
              </div>
            </bim-context-menu>
          </bim-button>
          <bim-button ?active=${clipper.enabled} @click=${onModelSection} label="Section" tooltip-title=${tooltips.CLIPPING.TITLE} tooltip-text=${tooltips.CLIPPING.TEXT} icon=${appIcons.CLIPPING}>
            <bim-context-menu>
              <bim-button label="Delete All Planes" @click=${onDeleteClippingPlanes} style="color: #ff6b6b;"></bim-button>
            </bim-context-menu>
          </bim-button> 
        </bim-toolbar-section>
      </bim-toolbar>
    `;
  };

  const elements: BUI.GridComponents<ViewportGridElements> = {
    leftToolbar: { template: leftToolbarTemplate, initialState: {} },
    bottomToolbar: {
      template: viewerToolbarTemplate,
      initialState: { components, world },
    },
  };

  const onCreated = (e?: Element) => {
    if (!e) return;
    const grid = e as BUI.Grid<ViewportGridLayouts, ViewportGridElements>;
    grid.elements = elements;

    grid.layouts = {
      main: {
        template: `
          "leftToolbar messages rightToolbar" auto
          "leftToolbar empty rightToolbar" 1fr
          "bottomToolbar bottomToolbar bottomToolbar" auto
          /auto 1fr auto
        `,
      },
    };
  };

  return BUI.html`<bim-grid ${BUI.ref(onCreated)} layout="main" floating></bim-grid>`;
};
