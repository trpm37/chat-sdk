/*
 * Environment
 * */
// src/views/chat/environment/index.ts

import Loader from "../loader";
import {
  COLLISION_SCENE_URL,
  ON_LOAD_SCENE_FINISH,
  SCENE_BACKGROUND_TEXTURE,
  WATER_NORMAL1_TEXTURE,
  WATER_NORMAL2_TEXTURE
} from "../Constants";
import {
  Scene,
  AmbientLight,
  DirectionalLight,
  SpotLight,
  Camera,
  EquirectangularReflectionMapping,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  PlaneGeometry,
  Vector2,
  AnimationMixer
} from "three";
import * as THREE from "three";
import { CSM } from "three/examples/jsm/csm/CSM";
import { Water } from "three/examples/jsm/objects/Water2";
import { BVHGeometry, isMesh } from "../utils/typeAssert";
import { MeshBVH, StaticGeometryGenerator, type MeshBVHOptions } from "three-mesh-bvh";
import Emitter from "../emitter";

interface EnvironmentParams {
  scene: Scene;
  camera: Camera;
  loader: Loader;
  emitter: Emitter;
  data: any;
}

export default class Environment {
  private scene: Scene;
  private camera: Camera;
  private loader: Loader;
  private emitter: Emitter;

  private collision_scene: Group | undefined;
  collider: Mesh | undefined;
  is_load_finished = false;
  direction_light: any;
  spotLight: any;
  csm: any;
  sceneMixer: AnimationMixer | undefined;
  envData: any;

  constructor({ scene, camera, loader, emitter, data }: EnvironmentParams) {
    this.scene = scene;
    this.camera = camera;
    this.loader = loader;
    this.emitter = emitter;
    this._loadEnvironment(data);
  }

  csmUpdate(delta_time: number) {
    // this.csm.update();
    if (this.sceneMixer) this.sceneMixer.update(delta_time);
  }
  /*
   * 加载场景全部物体
   * */
  private async _loadEnvironment(data: any) {
    try {
      // await this._loadCollisionScene();
      // this._initSceneOtherEffects();
      // this._createWater();
      this.scene.add(new THREE.AmbientLight(0xffffff, 1));
      this.direction_light = new DirectionalLight(0xffffff, 1);
      this.direction_light.position.set(-1, 0.8, -2);
      const targetObject = new THREE.Object3D();
      targetObject.position.set(0, 0, 0);
      this.scene.add(targetObject);
      this.direction_light.target = targetObject;
      // direction_light.lookAt(this.scene.position);
      this.direction_light.castShadow = true;
      this.direction_light.shadow.camera.near = 0.01;
      this.direction_light.shadow.camera.far = 50;
      this.direction_light.shadow.camera.right = 3 * 0.2;
      this.direction_light.shadow.camera.left = -3 * 0.2;
      this.direction_light.shadow.camera.top = 3 * 1;
      this.direction_light.shadow.camera.bottom = -3 * 1;
      this.direction_light.shadow.mapSize.width = 512 * 1;
      this.direction_light.shadow.mapSize.height = 512 * 1;
      // direction_light.shadow.radius = 2;
      // direction_light.shadow.bias = -0.00006;
      // this.scene.add(this.direction_light);
      // const helper = new THREE.DirectionalLightHelper(this.direction_light, 5);
      // this.scene.add(helper);

      this.spotLight = new SpotLight(0xffffff, 44);
      this.spotLight.angle = Math.PI / 3;
      this.spotLight.penumbra = 0.3;
      this.spotLight.position.set(-2, 0.3, -5);
      this.spotLight.castShadow = true;
      this.spotLight.shadow.camera.near = 1;
      this.spotLight.shadow.camera.far = 30;
      this.spotLight.shadow.mapSize.width = 1512;
      this.spotLight.shadow.mapSize.height = 1512;
      this.scene.add(this.spotLight);
      // const spotLightHelper = new THREE.SpotLightHelper(this.spotLight);
      // this.scene.add(spotLightHelper);
      const params = {
        fade: false,
        far: 1000,
        mode: "practical",
        lightX: -1,
        lightY: -1,
        lightZ: -1,
        margin: 100,
        lightFar: 5000,
        lightNear: 1,
        autoUpdateHelper: true
      };
      params;
      CSM;
      // this.csm = new CSM({
      //   lightIntensity: 1,
      //   maxFar: params.far,
      //   cascades: 4,
      //   mode: params.mode,
      //   parent: this.scene,
      //   shadowMapSize: 1024,
      //   lightDirection: new THREE.Vector3(params.lightX, params.lightY, params.lightZ).normalize(),
      //   camera: this.camera
      // });

      this.changeScene(data.environment);

      // const texture = this.loader.rgb_loader.load("static/chat/img/dhuman1.hdr");
      const texture = this.loader.exr_loader.load("static/chat/img/forest.exr");
      texture.mapping = EquirectangularReflectionMapping;
      this.scene.environment = texture;

      this.collider = 1;
      this.is_load_finished = true;
      this.emitter.$emit(ON_LOAD_SCENE_FINISH);
    } catch (e) {
      console.log(e);
    }
  }

  changeScene(environment: any) {
    this.envData = environment;
    // 没有设置背景图
    if (
      !environment ||
      !environment.url ||
      environment.url.indexOf("default") > -1 ||
      (environment.from == 1 && !environment.url2)
    ) {
      this.dispose();
      const floorMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
      this.collision_scene = new Mesh(new PlaneGeometry(100, 100, 8, 8), floorMaterial);
      this.collision_scene.rotation.y = Math.PI;
      this.collision_scene.position.z = 1.5;
      this.collision_scene.receiveShadow = true;
      this.scene.add(this.collision_scene);
      return;
    }
    // 图片背景 from=1自定义图片
    if (environment.url.indexOf(".jpg") > -1 || environment.url.indexOf(".png") > -1 || environment.from == 1) {
      this.dispose();
      const texture = this.loader.texture_loader.load(environment.from == 1 ? environment.url2 : environment.url);
      this.scene.background = texture;
      return;
    }
    // 视频背景
    if (environment.url.indexOf(".mp4") > -1) {
      this.videoScene();
      return;
    }
    // 模型动画背景
    this.loader.gltf_loader.load(environment.url, gltf => {
      console.log("背景 ", gltf.animations);
      this.sceneMixer = new AnimationMixer(gltf.scene);
      for (let i = 0; i < gltf.animations.length; i++) {
        const action = this.sceneMixer.clipAction(gltf.animations[i]);
        action.reset().play();
      }
      gltf.scene.position.set(0, -1.52, 0);
      gltf.scene.rotation.set(0, Math.PI, 0);
      gltf.scene.traverse(item => {
        item.castShadow = false;
        item.receiveShadow = true;
        if (item.name == "boli") {
          item.material.transparent = true;
          item.material.opacity = 0.36;
          item.material.color = new THREE.Color("#12B1DD");
        }
      });
      this.dispose();
      this.collision_scene = gltf.scene;
      this.scene.add(this.collision_scene);
    });
  }

  videoScene() {
    if (
      !this.envData ||
      this.envData.url.indexOf(".mp4") == -1 ||
      (this.envData.from == 1 && this.envData.url2.indexOf(".mp4") == -1)
    )
      return;
    this.dispose();
    this.scene.background = null;
    const video: any = document.querySelector(".videoScene");
    video.src = this.envData.from == 1 ? this.envData.url2 : this.envData.url; // 设置视频地址
    video.autoplay = true; //要设置播放
    video.loop = true; //循环播放
    video.playsInline = true;
    video.play();
  }

  dispose() {
    if (this.collision_scene) {
      this.collision_scene.traverse(item => {
        if (isMesh(item)) {
          item.geometry.dispose();
          item.material.dispose();
        }
      });
      this.collision_scene.removeFromParent();
      this.collision_scene = null;
      this.scene.background = null;
    }
    this.scene.background = new THREE.Color(0x9ea1a3);
    const video: any = document.querySelector(".videoScene");
    if (!video.paused) {
      video.pause();
    }
  }

  /*
   * 加载地图并绑定碰撞
   * */
  private _loadCollisionScene(): Promise<void> {
    return new Promise(resolve => {
      this.loader.gltf_loader.load(COLLISION_SCENE_URL, gltf => {
        this.collision_scene = gltf.scene;

        this.collision_scene.updateMatrixWorld(true);

        this.collision_scene.traverse(item => {
          item.castShadow = true;
          item.receiveShadow = true;
        });

        const static_generator = new StaticGeometryGenerator(this.collision_scene);
        static_generator.attributes = ["position"];

        const generate_geometry = static_generator.generate() as BVHGeometry;
        generate_geometry.boundsTree = new MeshBVH(generate_geometry, { lazyGeneration: false } as MeshBVHOptions);

        this.collider = new Mesh(generate_geometry);
        this.scene.add(this.collision_scene);

        resolve();
      });
    });
  }

  /*
   * 创建环境灯光、场景贴图、场景雾
   * */
  private _initSceneOtherEffects() {
    const direction_light = new DirectionalLight(0xffffff, 1);
    direction_light.position.set(-5, 25, -1);
    direction_light.castShadow = true;
    direction_light.shadow.camera.near = 0.01;
    direction_light.shadow.camera.far = 500;
    direction_light.shadow.camera.right = 30;
    direction_light.shadow.camera.left = -30;
    direction_light.shadow.camera.top = 30;
    direction_light.shadow.camera.bottom = -30;
    direction_light.shadow.mapSize.width = 1024;
    direction_light.shadow.mapSize.height = 1024;
    direction_light.shadow.radius = 2;
    direction_light.shadow.bias = -0.00006;
    this.scene.add(direction_light);

    const fill_light = new HemisphereLight(0xffffff, 0xe49959, 1);
    fill_light.position.set(2, 1, 1);
    this.scene.add(fill_light);

    this.scene.add(new AmbientLight(0xffffff, 1));

    this.scene.fog = new Fog(0xcccccc, 10, 900);

    const texture = this.loader.texture_loader.load(SCENE_BACKGROUND_TEXTURE);
    texture.mapping = EquirectangularReflectionMapping;
    this.scene.background = texture;
  }

  /*
   * 创建户外水池
   * */
  private _createWater() {
    const water = new Water(new PlaneGeometry(8.5, 38, 1024, 1024), {
      color: 0xffffff,
      scale: 0.3,
      flowDirection: new Vector2(3, 1),
      textureHeight: 1024,
      textureWidth: 1024,
      flowSpeed: 0.001,
      reflectivity: 0.05,
      normalMap0: this.loader.texture_loader.load(WATER_NORMAL1_TEXTURE),
      normalMap1: this.loader.texture_loader.load(WATER_NORMAL2_TEXTURE)
    });
    water.position.set(-1, 0, -30.5);
    water.rotation.x = -(Math.PI / 2);
    this.scene.add(water);
  }
}
