/*
 * Loader class is responsible for loading 3D models, textures, and audio files.
 * */
// src/views/chat/loader/index.ts

import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { AudioLoader, DefaultLoadingManager, TextureLoader, FileLoader, WebGLRenderer } from "three";
import { ON_LOAD_PROGRESS } from "../Constants";
import Emitter from "../emitter";

interface LoaderParams {
  emitter: Emitter;
  renderer: WebGLRenderer;
}

export default class Loader {
  private emitter: Emitter;

  gltf_loader: GLTFLoader;
  fbx_loader: FBXLoader;
  draco_loader: DRACOLoader;
  texture_loader: TextureLoader;
  audio_loader: AudioLoader;
  file_loader: FileLoader;
  rgb_loader: RGBELoader;
  exr_loader: EXRLoader;

  constructor({ emitter, renderer }: LoaderParams) {
    this.emitter = emitter;
    this.gltf_loader = new GLTFLoader();
    this.fbx_loader = new FBXLoader();
    this.texture_loader = new TextureLoader();
    this.audio_loader = new AudioLoader();
    this.file_loader = new FileLoader();
    this.rgb_loader = new RGBELoader();
    this.exr_loader = new EXRLoader();
    this.draco_loader = new DRACOLoader();
    this.draco_loader.setDecoderPath("lib/three/examples/jsm/libs/draco/gltf/");
    this.draco_loader.setDecoderConfig({ type: "js" });
    this.gltf_loader.setDRACOLoader(this.draco_loader);
    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath("lib/three/examples/jsm/libs/basis/");
    if (renderer) ktx2Loader.detectSupport(renderer);
    this.gltf_loader.setKTX2Loader(ktx2Loader);
    this.gltf_loader.setMeshoptDecoder(MeshoptDecoder);

    DefaultLoadingManager.onProgress = (url, loaded, total) => {
      this.emitter.$emit(ON_LOAD_PROGRESS, { url, loaded, total });
    };
  }
}
