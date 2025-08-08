import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import * as TEMPLATES from "..";
import {
  CONTENT_GRID_GAP,
  CONTENT_GRID_ID,
  SMALL_COLUMN_WIDTH,
} from "../../globals";

type Viewer = "viewer";

type Models = {
  name: "models";
  state: TEMPLATES.ModelsPanelState;
};

type ElementData = {
  name: "elementData";
  state: TEMPLATES.ElementsDataPanelState;
};

type Viewpoints = { name: "viewpoints"; state: TEMPLATES.ViewpointsPanelState };

type ToolsManagement = {
  name: "toolsManagement";
  state: TEMPLATES.ToolsManagementPanelState;
};

export type ContentGridElements = [
  Viewer,
  Models,
  ElementData,
  Viewpoints,
  ToolsManagement,
];

export type ContentGridLayouts = ["Viewer"];

export interface ContentGridState {
  components: OBC.Components;
  world?: OBC.World;
  id: string;
  viewportTemplate: BUI.StatelessComponent;
}

// Helper functions for resizing - defined before main template to avoid hoisting issues
const updateGridLayout = (
  gridId: string,
  side: "left" | "right",
  newSize: string,
) => {
  const grid = document.getElementById(gridId) as any;
  if (!grid) return;

  const leftSize =
    side === "left"
      ? newSize
      : localStorage.getItem("grid-left-size") || SMALL_COLUMN_WIDTH;
  const rightSize =
    side === "right"
      ? newSize
      : localStorage.getItem("grid-right-size") || SMALL_COLUMN_WIDTH;

  // Update the grid layout
  grid.layouts = {
    Viewer: {
      template: `
        "models viewer elementData" 1fr
        "viewpoints viewer toolsManagement" 1fr
        /${leftSize} 1fr ${rightSize}
      `,
    },
  };

  // Store the new size
  localStorage.setItem(`grid-${side}-size`, newSize);
};

const setupResizeHandle = (
  handle: HTMLElement,
  gridId: string,
  side: "left" | "right",
) => {
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const diff = side === "left" ? e.clientX - startX : startX - e.clientX;
    const newWidth = Math.max(200, Math.min(600, startWidth + diff));

    updateGridLayout(gridId, side, `${newWidth}px`);
  };

  const handleMouseUp = () => {
    isResizing = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "default";
  };

  handle.addEventListener("mousedown", (e) => {
    isResizing = true;
    startX = e.clientX;

    // Get current width from CSS grid template
    const currentSize =
      side === "left"
        ? localStorage.getItem("grid-left-size") || SMALL_COLUMN_WIDTH
        : localStorage.getItem("grid-right-size") || SMALL_COLUMN_WIDTH;

    startWidth = parseInt(currentSize.replace("px", ""), 10) || 350;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    e.preventDefault();
  });
};

// Add resize functionality
const addResizeHandles = (gridId: string) => {
  // Add CSS for resize handles
  if (!document.querySelector("#resize-handles-style")) {
    const style = document.createElement("style");
    style.id = "resize-handles-style";
    style.textContent = `
      .resizable-grid {
        position: relative;
      }
      
      .resize-handle-vertical {
        position: absolute;
        width: 6px;
        height: 100%;
        background: transparent;
        cursor: col-resize;
        z-index: 1000;
        top: 0;
        transition: background-color 0.2s;
      }
      
      .resize-handle-vertical:hover {
        background: var(--bim-ui_accent-base);
        opacity: 0.7;
      }
      
      .resize-handle-left {
        right: -3px;
      }
      
      .resize-handle-right {
        left: -3px;
      }
      
      .resizable-grid [slot="models"],
      .resizable-grid [slot="viewpoints"] {
        position: relative;
      }
      
      .resizable-grid [slot="elementData"],
      .resizable-grid [slot="toolsManagement"] {
        position: relative;
      }
    `;
    document.head.appendChild(style);
  }

  const gridElement = document.getElementById(gridId);
  if (!gridElement) return;

  // Add resize handles to panels
  const leftPanels = gridElement.querySelectorAll(
    '[slot="models"], [slot="viewpoints"]',
  );
  const rightPanels = gridElement.querySelectorAll(
    '[slot="elementData"], [slot="toolsManagement"]',
  );

  leftPanels.forEach((panel) => {
    if (!panel.querySelector(".resize-handle-vertical")) {
      const handle = document.createElement("div");
      handle.className = "resize-handle-vertical resize-handle-left";
      setupResizeHandle(handle, gridId, "left");
      panel.appendChild(handle);
    }
  });

  rightPanels.forEach((panel) => {
    if (!panel.querySelector(".resize-handle-vertical")) {
      const handle = document.createElement("div");
      handle.className = "resize-handle-vertical resize-handle-right";
      setupResizeHandle(handle, gridId, "right");
      panel.appendChild(handle);
    }
  });
};

export const contentGridTemplate: BUI.StatefullComponent<ContentGridState> = (
  state,
) => {
  const { components, world } = state;

  const onCreated = (e?: Element) => {
    if (!e) return;
    const grid = e as BUI.Grid<ContentGridLayouts, ContentGridElements>;

    grid.elements = {
      models: {
        template: TEMPLATES.modelsPanelTemplate,
        initialState: { components },
      },
      elementData: {
        template: TEMPLATES.elementsDataPanelTemplate,
        initialState: { components },
      },
      viewpoints: {
        template: TEMPLATES.viewpointsPanelTemplate,
        initialState: { components, world },
      },
      toolsManagement: {
        template: TEMPLATES.toolsManagementPanelTemplate,
        initialState: { components, world: world! },
      },
      viewer: state.viewportTemplate,
    };

    // Get stored sizes or use defaults
    const leftSize =
      localStorage.getItem("grid-left-size") || SMALL_COLUMN_WIDTH;
    const rightSize =
      localStorage.getItem("grid-right-size") || SMALL_COLUMN_WIDTH;

    grid.layouts = {
      Viewer: {
        template: `
          "models viewer elementData" 1fr
          "viewpoints viewer toolsManagement" 1fr
          /${leftSize} 1fr ${rightSize}
        `,
      },
    };

    // Initialize resize functionality
    setTimeout(() => addResizeHandles(state.id), 100);
  };

  return BUI.html`
    <bim-grid id=${state.id} class="resizable-grid" style="padding: ${CONTENT_GRID_GAP}; gap: ${CONTENT_GRID_GAP}" ${BUI.ref(onCreated)}></bim-grid>
  `;
};

export const getContentGrid = () => {
  const contentGrid = document.getElementById(CONTENT_GRID_ID) as BUI.Grid<
    ContentGridLayouts,
    ContentGridElements
  > | null;

  return contentGrid;
};
