import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import type { ElementSelection } from "./itp-model";

// Common structural IFC types for quality inspection
export const STRUCTURAL_TYPES = {
  PILE: "IfcPile",
  FOOTING: "IfcFooting",
  COLUMN: "IfcColumn",
  BEAM: "IfcBeam",
  SLAB: "IfcSlab",
  WALL: "IfcWall",
  FOUNDATION: "IfcFoundation",
  DEEP_FOUNDATION: "IfcDeepFoundation",
} as const;

export type StructuralType =
  (typeof STRUCTURAL_TYPES)[keyof typeof STRUCTURAL_TYPES];

/**
 * Get all structural elements of specified types
 * Note: For now, this returns empty array until ItemsFinder API is clarified
 * Users can manually select elements in the 3D viewer
 */
export async function getStructuralElements(
  _components: OBC.Components,
  types: StructuralType[] = Object.values(STRUCTURAL_TYPES),
): Promise<ElementSelection[]> {
  // For now, return empty array - users can manually select
  // This can be enhanced later when we confirm ItemsFinder API
  console.log("Structural element auto-selection not implemented yet");
  console.log("Please manually select elements in the 3D viewer");
  console.log("Looking for types:", types);
  return [];
}

/**
 * Get elements of a specific structural type
 */
export async function getPileElements(
  components: OBC.Components,
): Promise<ElementSelection[]> {
  return getStructuralElements(components, [STRUCTURAL_TYPES.PILE]);
}

export async function getColumnElements(
  components: OBC.Components,
): Promise<ElementSelection[]> {
  return getStructuralElements(components, [STRUCTURAL_TYPES.COLUMN]);
}

export async function getFootingElements(
  components: OBC.Components,
): Promise<ElementSelection[]> {
  return getStructuralElements(components, [STRUCTURAL_TYPES.FOOTING]);
}

/**
 * Highlight structural elements in the viewer
 */
export async function highlightStructuralElements(
  components: OBC.Components,
  elements: ElementSelection[],
  styleName = "structural-highlight",
) {
  const highlighter = components.get(OBF.Highlighter);

  // Ensure style exists
  if (!highlighter.styles.get(styleName)) {
    highlighter.styles.set(styleName, {
      color: new THREE.Color(0x00aaff),
      opacity: 0.8,
      renderedFaces: 1,
      transparent: true,
    });
  }

  // Convert to ModelIdMap format
  const modelIdMap: Record<string, Set<number>> = {};
  for (const element of elements) {
    if (!modelIdMap[element.modelId]) {
      modelIdMap[element.modelId] = new Set();
    }
    modelIdMap[element.modelId].add(element.expressID);
  }

  await highlighter.highlightByID(styleName, modelIdMap as any, false);
}

/**
 * Select structural elements in the highlighter
 */
export async function selectStructuralElements(
  components: OBC.Components,
  elements: ElementSelection[],
) {
  const highlighter = components.get(OBF.Highlighter);

  // Convert to ModelIdMap format for selection
  const modelIdMap: Record<string, Set<number>> = {};
  for (const element of elements) {
    if (!modelIdMap[element.modelId]) {
      modelIdMap[element.modelId] = new Set();
    }
    modelIdMap[element.modelId].add(element.expressID);
  }

  // Clear current selection and select the structural elements
  await highlighter.clear("select");
  await highlighter.highlightByID("select", modelIdMap as any, false);
}
