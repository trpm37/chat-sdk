/*
 * utlity functions for type assertion
 * */
// src/views/chat/utils/index.ts

import { BufferGeometry, Mesh, type NormalBufferAttributes } from "three";

import { MeshBVH } from "three-mesh-bvh";

export type BVHGeometry = BufferGeometry<NormalBufferAttributes> & { boundsTree: MeshBVH };

export function isMesh(obj: unknown): obj is Mesh {
  return typeof obj === "object" && obj !== null && "isMesh" in obj;
}

export function isBVHGeometry(obj: unknown): obj is BVHGeometry {
  return typeof obj === "object" && obj !== null && "boundsTree" in obj;
}
