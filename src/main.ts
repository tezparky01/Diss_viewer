import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as TEMPLATES from "./ui-templates";
import { appIcons, CONTENT_GRID_ID } from "./globals";
import { viewportSettingsTemplate } from "./ui-templates/buttons/viewport-settings";

BUI.Manager.init();

// Components Setup

const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBF.PostproductionRenderer
>();

world.name = "Main";
world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = new THREE.Color(0x1a1d23);

const viewport = BUI.Component.create<BUI.Viewport>(() => {
  return BUI.html`<bim-viewport style="width: 100%; height: 100%;"></bim-viewport>`;
});

// Initialize the renderer after creating viewport
world.renderer = new OBF.PostproductionRenderer(components, viewport);
world.camera = new OBC.OrthoPerspectiveCamera(components);

// Set up camera properly
world.camera.threePersp.near = 0.01;
world.camera.threePersp.far = 1000;
world.camera.threePersp.updateProjectionMatrix();
world.camera.controls.restThreshold = 0.05;

// Set initial camera position
world.camera.three.position.set(10, 10, 10);
world.camera.three.lookAt(0, 0, 0);

const worldGrid = components.get(OBC.Grids).create(world);
worldGrid.material.uniforms.uColor.value = new THREE.Color(0x494b50);
worldGrid.material.uniforms.uSize1.value = 2;
worldGrid.material.uniforms.uSize2.value = 8;

const resizeWorld = () => {
  world.renderer?.resize();
  world.camera.updateAspect();
};

viewport.addEventListener("resize", resizeWorld);

world.dynamicAnchor = false;

// Initialize components first
components.init();

components.get(OBC.Raycasters).get(world);

// Initialize Viewpoints component for saving/loading camera views
// const viewpoints = components.get(OBC.Viewpoints);

// Add some basic lighting to the scene
const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
world.scene.three.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
world.scene.three.add(directionalLight);

const { postproduction } = world.renderer;
postproduction.enabled = true;
postproduction.style = OBF.PostproductionAspect.COLOR_SHADOWS;

const { aoPass, edgesPass } = world.renderer.postproduction;

edgesPass.color = new THREE.Color(0x494b50);

const aoParameters = {
  radius: 0.25,
  distanceExponent: 1,
  thickness: 1,
  scale: 1,
  samples: 16,
  distanceFallOff: 1,
  screenSpaceRadius: true,
};

const pdParameters = {
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 16,
};

aoPass.updateGtaoMaterial(aoParameters);
aoPass.updatePdMaterial(pdParameters);

const fragments = components.get(OBC.FragmentsManager);
fragments.init("/node_modules/@thatopen/fragments/dist/Worker/worker.mjs");

fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  const isLod = "isLodMaterial" in material && material.isLodMaterial;
  if (isLod) {
    world.renderer!.postproduction.basePass.isolatedMaterials.push(material);
  }
});

world.camera.projection.onChanged.add(() => {
  for (const [_, model] of fragments.list) {
    model.useCamera(world.camera.three);
  }
});

world.camera.controls.addEventListener("rest", () => {
  fragments.core.update(true);
});

const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup({
  autoSetWasm: false,
  wasm: { absolute: true, path: "https://unpkg.com/web-ifc@0.0.70/" },
});

const highlighter = components.get(OBF.Highlighter);
highlighter.setup({
  world,
  selectMaterialDefinition: {
    color: new THREE.Color("#bcf124"),
    renderedFaces: 1,
    opacity: 1,
    transparent: false,
  },
});

// Ensure highlighter is enabled for model selection
highlighter.enabled = true;

// CRITICAL FIX: Add selection event handling for Quality system
let lastSelectionMap: Record<string, Set<number>> = {};

// Store selection globally for Quality module access
(window as any).getCurrentBIMSelection = async () => {
  const fragments = components.get(OBC.FragmentsManager);
  try {
    if (Object.keys(lastSelectionMap).length > 0) {
      const modelIdMap = await fragments.getData(lastSelectionMap);
      const result: Array<{ modelId: string; expressID: number }> = [];

      for (const [modelId, expressIdMap] of Object.entries(modelIdMap)) {
        if (expressIdMap && typeof expressIdMap === "object") {
          for (const [expressIdStr] of Object.entries(expressIdMap)) {
            const expressID = Number(expressIdStr);
            if (expressID > 0) {
              result.push({ modelId, expressID });
            }
          }
        }
      }
      return result;
    }
    return [];
  } catch (error) {
    console.error("Error converting selection:", error);
    return [];
  }
};

// Listen for selection changes and update global state
if (highlighter.events?.select?.onHighlight) {
  highlighter.events.select.onHighlight.add((fragmentIdMap) => {
    console.log("🎯 Selection changed:", fragmentIdMap);
    lastSelectionMap = fragmentIdMap || {};

    // Dispatch custom event for Quality module
    window.dispatchEvent(
      new CustomEvent("bim-selection-changed", {
        detail: { fragmentIdMap, timestamp: Date.now() },
      }),
    );
  });
}

if (highlighter.events?.select?.onClear) {
  highlighter.events.select.onClear.add(() => {
    console.log("🧹 Selection cleared");
    lastSelectionMap = {};

    // Dispatch clear event
    window.dispatchEvent(
      new CustomEvent("bim-selection-cleared", {
        detail: { timestamp: Date.now() },
      }),
    );
  });
}

// Clipper Setup - following That Open Company methodology
const clipper = components.get(OBC.Clipper);

// Make sure clipper starts disabled
clipper.enabled = false;

console.log("Clipper initialized:", {
  enabled: clipper.enabled,
  listSize: clipper.list.size,
});

// Set up clipping planes for the renderer
const updateClippingPlanes = () => {
  if (world.renderer) {
    const planes = Array.from(clipper.list.values()).map(
      (plane) => plane.three,
    );
    world.renderer.three.clippingPlanes = planes;
    world.renderer.three.localClippingEnabled = planes.length > 0;
    console.log("Clipping planes updated:", {
      count: planes.length,
      enabled: planes.length > 0,
    });
  }
  
  // Update UI when clipping planes change
  const contentGrid = document.getElementById(CONTENT_GRID_ID) as any;
  if (contentGrid?.updateComponent?.toolsManagement) {
    contentGrid.updateComponent.toolsManagement();
  }
};

clipper.list.onItemSet.add(() => {
  console.log("Clipping plane added");
  updateClippingPlanes();
});
clipper.list.onItemDeleted.add(() => {
  console.log("Clipping plane deleted");
  updateClippingPlanes();
});

// Length Measurement Setup - following That Open Company methodology
const lengthMeasurer = components.get(OBF.LengthMeasurement);
// Provide a world to create dimensions inside
lengthMeasurer.world = world;
lengthMeasurer.color = new THREE.Color("#6528d7");
// Disabled by default - only enabled when user activates it
lengthMeasurer.enabled = false;

console.log("Length measurer initialized:", {
  world: lengthMeasurer.world ? "assigned" : "not assigned",
  enabled: lengthMeasurer.enabled,
  color: lengthMeasurer.color.getHexString(),
});

// Override the lines collection behavior to control label visibility
lengthMeasurer.lines.onItemAdded.add((dimensionLine) => {
  console.log("Dimension line added to lengthMeasurer.lines");
  
  // Check if this is a preview line (distance = 0) and hide its label
  const line = (dimensionLine as any).line;
  if (line && line.distance() === 0) {
    console.log("Hiding label for 0m preview dimension line");
    (dimensionLine as any).label.visible = false;
    
    // Set up a listener to monitor distance changes on this line
    const checkDistance = () => {
      const currentDistance = line.distance();
      if (currentDistance > 0) {
        console.log("Distance became > 0, showing label");
        (dimensionLine as any).label.visible = true;
      } else {
        (dimensionLine as any).label.visible = false;
      }
    };
    
    // Check distance periodically while the measurement is being created
    const intervalId = setInterval(checkDistance, 50);
    
    // Clean up the interval after a reasonable time
    setTimeout(() => {
      clearInterval(intervalId);
      console.log("Stopped monitoring dimension line distance");
    }, 10000); // Stop monitoring after 10 seconds
  }
});

lengthMeasurer.list.onItemAdded.add((line) => {
  console.log("Length measurement created");
  
  // Disable raycasting on helper meshes to prevent selection interference
  if ((line as any).object) {
    const obj = (line as any).object;
    // Disable raycasting for the main object and all children
    obj.raycast = () => false;
    obj.traverse((child: any) => {
      if (child.raycast) child.raycast = () => false;
    });
  }
  
  // Always update UI and handle completed measurements
  const distance = line.distance();
  console.log("Length measurement distance:", distance);
  
  if (distance > 0) {
    // Valid completed measurement, focus on it
    const center = new THREE.Vector3();
    line.getCenter(center);
    const radius = distance / 3;
    const sphere = new THREE.Sphere(center, radius);
    world.camera.controls.fitToSphere(sphere, true);
    
    // Make sure the corresponding dimension line label is visible
    const dimensionLines = Array.from(lengthMeasurer.lines);
    const correspondingDimension = dimensionLines.find(
      (dimLine) => (dimLine as any).line === line,
    );
    if (correspondingDimension) {
      console.log(
        "Making dimension line label visible for completed measurement",
      );
      (correspondingDimension as any).label.visible = true;
    }
  }
  
  // Update UI when measurements change
  const contentGrid = document.getElementById(CONTENT_GRID_ID) as any;
  if (contentGrid?.updateComponent?.toolsManagement) {
    contentGrid.updateComponent.toolsManagement();
  }
});

lengthMeasurer.list.onItemDeleted.add(() => {
  console.log("Length measurement deleted");
  const contentGrid = document.getElementById(CONTENT_GRID_ID) as any;
  if (contentGrid?.updateComponent?.toolsManagement) {
    contentGrid.updateComponent.toolsManagement();
  }
});

// Area Measurement Setup - following That Open Company methodology
const areaMeasurer = components.get(OBF.AreaMeasurement);
// Provide a world to create dimensions inside
areaMeasurer.world = world;
areaMeasurer.color = new THREE.Color("#6528d7");
// Disabled by default - only enabled when user activates it
areaMeasurer.enabled = false;

console.log("Area measurer initialized:", {
  world: areaMeasurer.world ? "assigned" : "not assigned",
  enabled: areaMeasurer.enabled,
  color: areaMeasurer.color.getHexString(),
});

areaMeasurer.list.onItemAdded.add((area) => {
  console.log("Area measurement created");
  
  // Disable raycasting on helper meshes to prevent selection interference
  if ((area as any).object) {
    const obj = (area as any).object;
    // Disable raycasting for the main object and all children
    obj.raycast = () => false;
    obj.traverse((child: any) => {
      if (child.raycast) child.raycast = () => false;
    });
  }
  
  if (!area.boundingBox) return;
  const sphere = new THREE.Sphere();
  area.boundingBox.getBoundingSphere(sphere);
  world.camera.controls.fitToSphere(sphere, true);
  
  // Update UI when area measurements change
  const contentGrid = document.getElementById(CONTENT_GRID_ID) as any;
  if (contentGrid?.updateComponent?.toolsManagement) {
    contentGrid.updateComponent.toolsManagement();
  }
});

areaMeasurer.list.onItemDeleted.add(() => {
  console.log("Area measurement deleted");
  const contentGrid = document.getElementById(CONTENT_GRID_ID) as any;
  if (contentGrid?.updateComponent?.toolsManagement) {
    contentGrid.updateComponent.toolsManagement();
  }
});

// Utility function to clear all measurements
function clearAllMeasurements() {
  console.log("🧹 Clearing all measurements");
  
  // Clear length measurements - use forEach to iterate
  lengthMeasurer.list.forEach((line) => {
    if ((line as any).dispose) {
      (line as any).dispose();
    }
  });
  lengthMeasurer.list.clear();
  
  // Clear area measurements - use forEach to iterate
  areaMeasurer.list.forEach((area) => {
    if ((area as any).dispose) {
      (area as any).dispose();
    }
  });
  areaMeasurer.list.clear();
  
  // Clear clipping planes if any exist
  const planeIds = Array.from(clipper.list.keys());
  planeIds.forEach((id) => {
    clipper.delete(world, id);
  });
  
  console.log(
    "✅ Cleared all measurements and",
    planeIds.length,
    "clipping planes",
  );
  
  // Update UI
  const contentGrid = document.getElementById(CONTENT_GRID_ID) as any;
  if (contentGrid?.updateComponent?.toolsManagement) {
    contentGrid.updateComponent.toolsManagement();
  }
}

// That Open Company tool interaction handlers are now managed by UI buttons
// The double-click handlers are set up in viewport.ts when tools are activated

// Unified keyboard shortcuts for That Open Company tools
// Using capture phase to work even when UI elements have focus
window.addEventListener(
  "keydown",
  (event) => {
    if (event.code === "Delete" || event.code === "Backspace") {
      event.preventDefault(); // Prevent browser back navigation

      console.log("Delete key pressed"); // Debug log

      // Try to delete measurements under cursor - try both
      lengthMeasurer.delete();
      areaMeasurer.delete();

      // Also handle clipping planes if clipper is enabled
      if (clipper.enabled) {
        const planeIds = Array.from(clipper.list.keys());
        if (planeIds.length > 0) {
          const lastPlaneId = planeIds[planeIds.length - 1];
          clipper.delete(world, lastPlaneId);
          console.log("Deleted clipping plane:", lastPlaneId);
        }
      }
    }

    if (event.code === "Enter" || event.code === "NumpadEnter") {
      if (areaMeasurer.enabled) {
        areaMeasurer.endCreation();
      }
    }

    // Clear all measurements with Ctrl+C (or Cmd+C on Mac)
    if (event.code === "KeyC" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      clearAllMeasurements();
    }
  },
  true,
); // Enable capture phase to work even when UI elements have focus

// Define what happens when a fragments model has been loaded
fragments.list.onItemSet.add(async ({ value: model }) => {
  console.log(
    "🏗️ Model loaded:",
    model.object.name || "Unnamed Model",
    "| Total models:",
    fragments.list.size,
  );
  
  model.useCamera(world.camera.three);
  model.getClippingPlanesEvent = () => {
    return Array.from(world.renderer!.three.clippingPlanes) || [];
  };
  world.scene.three.add(model.object);
  await fragments.core.update(true);
  
  // Update Tools Management panel when a new model is loaded
  const contentGrid = document.getElementById(CONTENT_GRID_ID) as any;
  if (contentGrid?.updateComponent?.toolsManagement) {
    console.log("📊 Updating Tools Management panel - models now active");
    contentGrid.updateComponent.toolsManagement();
  }
});

// Handle when models are removed
fragments.list.onItemDeleted.add(() => {
  console.log("🗑️ Model removed | Remaining models:", fragments.list.size);
  
  const contentGrid = document.getElementById(CONTENT_GRID_ID) as any;
  if (contentGrid?.updateComponent?.toolsManagement) {
    console.log("📊 Updating Tools Management panel - checking model count");
    contentGrid.updateComponent.toolsManagement();
  }
});

// Viewport Layouts
const [viewportSettings] = BUI.Component.create(viewportSettingsTemplate, {
  components,
  world,
});

viewport.append(viewportSettings);

const [viewportGrid] = BUI.Component.create(TEMPLATES.viewportGridTemplate, {
  components,
  world,
});

viewport.append(viewportGrid);

// Content Grid Setup
const viewportCardTemplate = () => BUI.html`
  <div class="dashboard-card" style="padding: 0px;">
    ${viewport}
  </div>
`;

const [contentGrid] = BUI.Component.create<
  BUI.Grid<TEMPLATES.ContentGridLayouts, TEMPLATES.ContentGridElements>,
  TEMPLATES.ContentGridState
>(TEMPLATES.contentGridTemplate, {
  components,
  world,
  id: CONTENT_GRID_ID,
  viewportTemplate: viewportCardTemplate,
});

const setInitialLayout = () => {
  if (window.location.hash) {
    const hash = window.location.hash.slice(
      1,
    ) as TEMPLATES.ContentGridLayouts[number];
    if (Object.keys(contentGrid.layouts).includes(hash)) {
      contentGrid.layout = hash;
    } else {
      contentGrid.layout = "Viewer";
      window.location.hash = "Viewer";
    }
  } else {
    window.location.hash = "Viewer";
    contentGrid.layout = "Viewer";
  }
};

setInitialLayout();

contentGrid.addEventListener("layoutchange", () => {
  window.location.hash = contentGrid.layout as string;
});

const contentGridIcons: Record<TEMPLATES.ContentGridLayouts[number], string> = {
  Viewer: appIcons.MODEL,
  Quality: appIcons.QUALITY,
};

// App Grid Setup
type AppLayouts = ["App"];

type Sidebar = {
  name: "sidebar";
  state: TEMPLATES.GridSidebarState;
};

type ContentGrid = { name: "contentGrid"; state: TEMPLATES.ContentGridState };

type AppGridElements = [Sidebar, ContentGrid];

const app = document.getElementById("app") as BUI.Grid<
  AppLayouts,
  AppGridElements
>;

app.elements = {
  sidebar: {
    template: TEMPLATES.gridSidebarTemplate,
    initialState: {
      grid: contentGrid,
      compact: true,
      layoutIcons: contentGridIcons,
    },
  },
  contentGrid,
};

contentGrid.addEventListener("layoutchange", () =>
  app.updateComponent.sidebar(),
);

app.layouts = {
  App: {
    template: `
      "sidebar contentGrid" 1fr
      /auto 1fr
    `,
  },
};

app.layout = "App";
