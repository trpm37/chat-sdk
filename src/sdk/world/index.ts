/*
 * World
 * */
// src/views/chat/world/index.ts

import * as THREE from "three";
import Emitter from "../emitter";
import Loader from "../loader";
import Control from "../control";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Environment from "../environment";
import Character from "../character";
import Audio from "../audio";
import * as Constants from "../Constants";
import Stats from "three/examples/jsm/libs/stats.module.js";
// import { useChatStore } from "@/stores/modules/chat";
// const chatStore = useChatStore(); //数据

export default class World {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  clock: THREE.Clock;
  orbit_controls: OrbitControls;

  emitter: Emitter;
  control: Control | undefined;
  loader: Loader | undefined;

  environment: Environment | undefined;
  character: Character | undefined;
  audio: Audio | undefined;
  stats: any;
  log: boolean = false;
  webgl: any;

  chatStore:any;

  constructor(params:any) {
    this.chatStore = params.data || {};
    this.emitter = new Emitter();
  }

  init(callback) {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.camera = new THREE.PerspectiveCamera();
    this.clock = new THREE.Clock();
    this.orbit_controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit_controls.target.set(0, 0, 0);
    this.orbit_controls.maxPolarAngle = Math.PI / 2; // - Math.PI / 14;
    this.orbit_controls.minPolarAngle = Math.PI / 2;
    this.orbit_controls.maxDistance = 40;
    this.orbit_controls.minDistance = 0.1;
    this.orbit_controls.enableRotate = true;
    this.orbit_controls.enablePan = false;
    this.orbit_controls.enableZoom = false;

    this._initScene();
    this._initCamera();
    this._initRenderer();
    this._initResponsiveResize();

    this.control = new Control({
      emitter: this.emitter
    });

    this.loader = new Loader({
      emitter: this.emitter,
      renderer: this.renderer
    });

    this.environment = new Environment({
      scene: this.scene,
      camera: this.camera,
      loader: this.loader,
      emitter: this.emitter,
      data: this.chatStore.robot.human_config
    });

    this.audio = new Audio({
      scene: this.scene,
      camera: this.camera,
      loader: this.loader,
      emitter: this.emitter
    });

    this.character = new Character({
      scene: this.scene,
      camera: this.camera,
      orbit_controls: this.orbit_controls,
      control: this.control,
      loader: this.loader,
      emitter: this.emitter,
      data: this.chatStore.robot.human_config,
      audio: this.audio,
      env: this.environment
    });
    this.log = window.location.href.indexOf("log=1") > 0;
    this.emitter.$on(Constants.ON_INTERSECT_TRIGGER, data => {
      if (this.log) console.log("ON_INTERSECT_TRIGGER ", data[0], this.character?.isTriggerStop);
      if (data[0] == "onended") {
        this.character?.bsAudioStop();
        if (this.character?.audioEndCallback && !this.character?.isTriggerStop && this.character?.isPcmFinish)
          this.character?.audioEndCallback();
        this.character?.setTriggerStop(false);
      } else if (data[0] == "code") {
        this.audio?.process_audio(Constants.TEST_PCM);
      } else if (data[0] == "click") {
        if (callback) callback(); // 数字人点击回调
      } else {
        if (data[0]) {
          this.audio?.playAudio();
        } else {
          this.audio?.stopAudio();
        }
      }
    });
  }

  setVolume(value) {
    this.audio?.positional_audio.volume(value);
  }

  render() {
    // let last = Date.now();
    // let ticks = 0;
    this.renderer.setAnimationLoop(() => {
      // ticks += 1;
      //每30帧统计一次帧率
      // if (ticks >= 30 && this.character.mixer) {
      //   const now = Date.now();
      //   const diff = now - last;
      //   const fps = Math.round(1000 / (diff / ticks));
      //   last = now;
      //   ticks = 0;
      //   this.character.mixer.timeScale = 60 / fps;
      //   console.log("刷新帧率数值 ", fps, this.clock.getDelta());
      // }
      this.renderer.render(this.scene, this.camera);
      const delta_time = Math.min(0.05, this.clock.getDelta());

      // 需等待场景加载完毕后更新character，避免初始加载时多余的性能消耗和人物碰撞错误处理
      if (this.environment?.is_load_finished && this.environment.collider) {
        this.character?.update(delta_time, this.environment.collider, this.audio?.analyser);
        this.environment?.csmUpdate(delta_time);
      }
      if (this.stats) {
        this.stats.update();
      }
      this.orbit_controls.update();
    });
  }

  private _initScene() {
    this.scene.background = new THREE.Color(0x9ea1a3);
  }

  private _initCamera() {
    this.camera.fov = 55;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.near = 0.1;
    this.camera.far = 10000;
    this.camera.position.set(0, 0, -3.2);
    this.camera.updateProjectionMatrix();
  }

  private _initRenderer() {
    this.renderer.shadowMap.enabled = true;
    // this.renderer.shadowMap.type = VSMShadowMap;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.setSize(window.innerWidth * 1.5, window.innerHeight * 1.5);
    document.querySelector("#webgl")?.appendChild(this.renderer.domElement);
    this.webgl = document.getElementById("webgl");
    const mt = 50 / (window.innerWidth / window.innerHeight);
    this.webgl.style.marginTop = -mt + "%";
    this.stats = new Stats();
    if (window.location.href.indexOf("log=1") > 0) {
      document.querySelector("#webgl")?.appendChild(this.stats.dom);
    }
  }

  private _initResponsiveResize() {
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      const mt = 50 / (window.innerWidth / window.innerHeight);
      this.webgl.style.marginTop = -mt + "%";
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth * 1.5, window.innerHeight * 1.5);
      this.renderer.setPixelRatio(window.devicePixelRatio);
    });
  }
}
