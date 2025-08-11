export const CONTENT_GRID_ID = "app-content";
export const CONTENT_GRID_GAP = "1rem";
export const SMALL_COLUMN_WIDTH = "22rem";
export const MEDIUM_COLUMN_WIDTH = "25rem";

export const appIcons = {
  ADD: "mdi:plus",
  SELECT: "solar:cursor-bold",
  CLIPPING: "fluent:cut-16-filled",
  SHOW: "mdi:eye",
  HIDE: "mdi:eye-off",
  LEFT: "tabler:chevron-compact-left",
  RIGHT: "tabler:chevron-compact-right",
  SETTINGS: "solar:settings-bold",
  COLORIZE: "famicons:color-fill",
  EXPAND: "eva:expand-fill",
  EXPORT: "ph:export-fill",
  TASK: "material-symbols:task",
  CAMERA: "solar:camera-bold",
  FOCUS: "ri:focus-mode",
  TRANSPARENT: "mdi:ghost",
  ISOLATE: "mdi:selection-ellipse",
  RULER: "solar:ruler-bold",
  MODEL: "mage:box-3d-fill",
  LAYOUT: "tabler:layout-filled",
  QUALITY: "material-symbols:engineering",
};

export const tooltips = {
  FOCUS: {
    TITLE: "Items Focusing",
    TEXT: "Move the camera to focus the selected items. If no items are selected, all models will be focused.",
  },
  HIDE: {
    TITLE: "Hide Selection",
    TEXT: "Hide the currently selected items.",
  },
  ISOLATE: {
    TITLE: "Isolate Selection",
    TEXT: "Hide everything expect the currently selected items.",
  },
  GHOST: {
    TITLE: "Ghost Mode",
    TEXT: "Set all models transparent, so selections and colors can be seen better.",
  },
  SHOW_ALL: {
    TITLE: "Show All Items",
    TEXT: "Reset the visibility of all hidden items, so they become visible again.",
  },
  MEASUREMENTS: {
    TITLE: "Measurement Tools",
    TEXT: "Double-click to create measurements. Use Delete key to remove the last measurement. Access Length and Area tools from the dropdown.",
  },
  LENGTH_MEASURE: {
    TITLE: "Length Measurement",
    TEXT: "Double-click two points to measure distance. Press Delete to remove the last measurement.",
  },
  AREA_MEASURE: {
    TITLE: "Area Measurement",
    TEXT: "Double-click to start drawing, continue clicking to add points, press Enter to finish. Press Delete to remove the last area measurement.",
  },
  CLIPPING: {
    TITLE: "Clipping Planes",
    TEXT: "Double-click to create clipping planes that section through your model. Use Delete key to remove the last plane. Access delete options from the dropdown.",
  },
};
