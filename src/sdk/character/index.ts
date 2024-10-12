/*
 * Character
 * */
// src/views/chat/character/index.ts

import {
  Scene,
  PerspectiveCamera,
  AnimationAction,
  AnimationMixer,
  Box3,
  Line3,
  Matrix4,
  Mesh,
  Group,
  Object3D,
  Quaternion,
  Raycaster,
  Vector3,
  BoxGeometry,
  MeshBasicMaterial
} from "three";
import * as THREE from "three";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";

import {
  CHARACTER_URL,
  ON_KEY_DOWN,
  ON_INTERSECT_TRIGGER,
  BSNameMap,
  BSNameMap2,
  BSNameMap3,
  TEST_BS1,
  TEST_BS2,
  TEST_BS3,
  TEST_BS5,
  TEST_BS4,
  TEST_PCM1,
  TEST_PCM2,
  TEST_PCM3,
  TEST_PCM4,
  TEST_PCM5,
  PEOPLE_DATA
} from "../Constants";
import { isBVHGeometry, isMesh } from "../utils/typeAssert";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Control from "../control";
import Emitter from "../emitter";
import Loader from "../loader";
import Audio from "../audio";
import Environment from "../environment";

// 角色相关可选配置项
type OptionalParams = Partial<{
  is_first_person: boolean;
  reset_position: Vector3;
  reset_y: number;
  speed: number;
  jump_height: number;
  gravity: number;
}>;

type PlayerParams = {
  scene: Scene;
  camera: PerspectiveCamera;
  orbit_controls: OrbitControls;
  control: Control;
  loader: Loader;
  emitter: Emitter;
  data: any;
  audio: Audio;
  env: Environment;
} & OptionalParams;

type Actions = "idle" | "walk" | "wave";

// 可选配置项默认值
const default_params: OptionalParams = {
  is_first_person: false,
  reset_position: new Vector3(-10, 2.5, 10),
  reset_y: -25,
  speed: 3,
  jump_height: 12,
  gravity: -30
};

export default class Character {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private orbit_controls: OrbitControls;
  private control: Control;
  private loader: Loader;
  private emitter: Emitter;

  private camera_raycaster: Raycaster = new Raycaster();

  mixer: AnimationMixer | undefined;
  mixer2: AnimationMixer | undefined;
  private cur_action: Actions = "idle";
  private actions: Record<Actions, AnimationAction | undefined> = {
    idle: undefined,
    walk: undefined,
    wave: undefined
  };
  private player!: Group;
  player_shape!: Mesh;
  private capsule_info = {
    radius: 0.5,
    segment: new Line3(new Vector3(), new Vector3(0, -10, 0.0))
  };

  private reset_position: Vector3; // 重生点
  private reset_y: number; // 重生掉落高度
  private is_first_person: boolean; // 是否第一人称
  private gravity: number; // 重力
  private jump_height: number; // 跳跃高度
  private speed: number; // 速度
  private player_is_on_ground = false; // 是否在地面
  private velocity = new Vector3();
  private rotate_quarternion = new Quaternion();
  private rotate_angle = new Vector3(0, 1, 0);
  private last_direction_angle: number | undefined;

  private up_vector = new Vector3(0, 1, 0);
  private temp_vector = new Vector3();
  private temp_vector2 = new Vector3();
  private temp_box = new Box3();
  private temp_mat = new Matrix4();
  private temp_segment = new Line3();
  private readonly handleClick: OmitThisParameter<(event: MouseEvent) => void>;
  private readonly handleAnimFinish: OmitThisParameter<(event: any) => void>;
  private pointer = new THREE.Vector2();
  preAction: any;
  model: any;
  stopJieShuo: any;
  pcmList: any[] = [];
  bsList: any[] = [];
  influences: any;
  teethInfluences: any;
  head: any;
  teeth: any;
  audio: Audio | undefined; // 音频
  env: Environment | undefined; // 背景
  headAnims: any[] = [];
  teethAnims: any[] = [];
  body1Anims: any[] = [];
  body2Anims: any[] = [];
  audioEndCallback: any; // 回答结束回调
  isTriggerStop: boolean = false; // 主动触发停止
  isPcmFinish: boolean = false; // pcm数据是否追加完成
  gui: any;
  log: boolean = false;
  lite1: boolean = false;
  lite2: boolean = false;
  bsNameMap: any;
  isMale: boolean = false;
  headName: any;
  teethName: any;
  detectionModels: any[] = [];

  constructor(params: PlayerParams) {
    params = {
      ...default_params,
      ...params
    };
    this.scene = params.scene;
    this.camera = params.camera;
    this.orbit_controls = params.orbit_controls;
    this.control = params.control;
    this.emitter = params.emitter;
    this.loader = params.loader;
    this.audio = params.audio;
    this.env = params.env;
    this.is_first_person = params.is_first_person!;
    this.reset_position = params.reset_position!;
    this.reset_y = params.reset_y!;
    this.gravity = params.gravity!;
    this.jump_height = params.jump_height!;
    this.speed = params.speed!;
    this.lite1 = window.location.href.indexOf("lite=1") > 0;
    this.lite2 = window.location.href.indexOf("lite=2") > 0;
    if (this.lite1 || this.lite2) {
      this.bsNameMap = this.lite1 ? BSNameMap2 : BSNameMap3;
      params.data = Object.assign(PEOPLE_DATA, {
        people: {
          id: 20,
          pid: 17,
          url: this.lite1 ? "scene/meta_human/lite_human.glb" : "scene/meta_human/lite_human1.glb"
        }
      });
    } else {
      this.bsNameMap = BSNameMap;
    }
    this._createPlayer(params.data);
    this.emitter.$on(ON_KEY_DOWN, this._onKeyDown.bind(this));
    this.handleClick = this.onClick.bind(this);
    document.addEventListener("click", this.handleClick);
    this.handleAnimFinish = this.finishCallback.bind(this);
    this.log = window.location.href.indexOf("log=1") > 0;
  }

  // 数字人点击回调
  onClick(event: MouseEvent) {
    this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.camera_raycaster.setFromCamera(this.pointer, this.camera);
    this.camera_raycaster.near = 0.1;
    this.camera_raycaster.far = 5;
    if (this.log) console.log("数字人点击回调 ", this.detectionModels);
    const intersects = this.camera_raycaster.intersectObjects(this.scene.children);
    if (intersects.length) {
      this.emitter.$emit(ON_INTERSECT_TRIGGER, "click");
      if (this.log) console.log("intersects ", intersects[0].object.name, intersects);
      // document.documentElement.requestFullscreen();
    }
  }

  update(delta_time: number, scene_collider: Mesh | null, analyser: any) {
    this.mixer?.update(delta_time);
    this.mixer2?.update(delta_time);
    if (0 && analyser && this.head && this.teeth && this.actions["emo"] && !this.actions["emo"].isRunning()) {
      analyser.getFrequencyData();
      const v = analyser.data[15] / 255;
      // console.log(v);
      const v_ = v < 0.1 ? 0.1 : v - 0.1;
      this.influences[this.head.morphTargetDictionary.mouthFunnel] = v_ / 1;
      this.influences[this.head.morphTargetDictionary.mouthPucker] = 0;
      this.influences[this.head.morphTargetDictionary.mouthShrugLower] = 0.3;
      this.influences[this.head.morphTargetDictionary.mouthShrugUpper] = v_ / 2;
      this.influences[this.head.morphTargetDictionary.jawOpen] = (v_ / 2) * 2;
      this.influences[this.head.morphTargetDictionary.mouthClose] = 0.1;
      if (this.teeth) this.teethInfluences[this.teeth.morphTargetDictionary.jawOpen] = (v_ / 2) * 2;
    }
    if (!scene_collider || !this.player) return;

    // this._updateControls();

    // this._updatePlayer(delta_time);

    // this._checkCapsuleCollision(delta_time, scene_collider);

    // this._updatePlayerShape();

    // this.camera.position.sub(this.orbit_controls.target);
    // this.orbit_controls.target.copy(this.player.position);
    // this.camera.position.add(this.player.position);

    // this._checkCameraCollision([scene_collider]);

    // this._checkReset();
  }

  fullScreen() {
    document.documentElement.requestFullscreen();
  }

  pcmBS(pcm?: any, bs?: any, isActionFinish?: any, action?: any, action2?: any) {
    if (this.log) console.log("pcmBS ", isActionFinish, action, action2);
    this.isPcmFinish = !pcm;
    if (!pcm) return;
    this.isTriggerStop = false;
    // if (!pcm && this.bsList.length > 0) {
    //   this.headAnims.splice(0, this.headAnims.length);
    //   this.teethAnims.splice(0, this.teethAnims.length);
    //   this.body1Anims.splice(0, this.body1Anims.length);
    //   this.body2Anims.splice(0, this.body2Anims.length);
    //   console.log("pcmBS 问答结束 ", this.bsList);
    //   const arr = [...this.bsList[0]];
    //   for (let h = 1; h < this.bsList.length; h++) {
    //     const dur = arr[arr.length - 1].time;
    //     const bs = this.bsList[h];
    //     for (let i = 0; i < bs.length; i++) {
    //       const a = Object.assign({}, bs[i]);
    //       a.time = a.time + dur;
    //       arr.push(a);
    //     }
    //   }
    //   this.bsEmo(arr);
    //   if (!this.headAnims[0].isRunning()) {
    //     this.headAnims[0].reset().play();
    //     this.teethAnims[0].reset().play();
    //     this.body1Anims[0].reset().play();
    //     this.body2Anims[0].reset().play();
    //   }
    //   this.audio?.process_audio(this.pcmList[0]);
    //   this.seqAudio();
    //   this.bsList.splice(0, this.bsList.length);
    //   return;
    // }
    // if (pcm) this.pcmList.push(pcm);
    // if (bs) this.bsList.push(bs);
    this.bsEmo(bs);
    if (!this.headAnims[0].isRunning()) {
      this.headAnims[0].reset().play();
      this.teethAnims[0].reset().play();
      this.body1Anims[0].reset().play();
      this.body2Anims[0].reset().play();
      let actionName = "PlayOne-explanation_001";
      if (isActionFinish) {
        actionName = action || "PlayOne-explanation_005";
      }
      this.playAction({ animationName: actionName, animationName2: action2, isActionFinish: isActionFinish });
    }
    this.audio?.process_audio(pcm);
  }

  seqAudio() {
    if (this.pcmList.length > 1) {
      setTimeout(() => {
        this.pcmList.splice(0, 1);
        this.audio?.process_audio(this.pcmList[0]);
        this.seqAudio();
      }, 10);
    } else {
      this.pcmList.splice(0, this.pcmList.length);
    }
  }

  // 回答结束回调
  addAudioEndCallback(audioEndCallback) {
    this.audioEndCallback = audioEndCallback;
  }

  // 代码驱动口型测试
  codeTest() {
    this.emitter.$emit(ON_INTERSECT_TRIGGER, "code");
  }

  // BS数据测试
  bsTest() {
    this.playAction({ animationName: "PlayOne-explanation_001" });
    this.audio?.player.stop();
    setTimeout(() => {
      this.headAnims.splice(0, this.headAnims.length);
      this.teethAnims.splice(0, this.teethAnims.length);
      this.body1Anims.splice(0, this.body1Anims.length);
      this.body2Anims.splice(0, this.body2Anims.length);
      // const arr = [...TEST_BS1];
      // arr.splice(arr.length - 5, 4);
      // console.log(arr);
      // const dur = arr[arr.length - 1].time;
      // for (let i = 0; i < TEST_BS2.length; i++) {
      //   const a = Object.assign({}, TEST_BS2[i]);
      //   a.time = a.time + dur;
      //   arr.push(a);
      // }
      // const dur2 = arr[arr.length - 1].time;
      // for (let i = 0; i < TEST_BS3.length; i++) {
      //   const a = Object.assign({}, TEST_BS3[i]);
      //   a.time = a.time + dur2;
      //   arr.push(a);
      // }
      // const dur3 = arr[arr.length - 1].time;
      // for (let i = 0; i < TEST_BS4.length; i++) {
      //   const a = Object.assign({}, TEST_BS4[i]);
      //   a.time = a.time + dur3;
      //   arr.push(a);
      // }
      // const dur4 = arr[arr.length - 1].time;
      // for (let i = 0; i < TEST_BS5.length; i++) {
      //   const a = Object.assign({}, TEST_BS5[i]);
      //   a.time = a.time + dur4;
      //   arr.push(a);
      // }
      // console.log(arr);
      this.bsEmo(TEST_BS1);
      this.bsEmo(TEST_BS2);
      this.bsEmo(TEST_BS3);
      this.bsEmo(TEST_BS4);
      this.bsEmo(TEST_BS5);
      if (!this.headAnims[0].isRunning()) {
        this.headAnims[0].reset().play();
        this.teethAnims[0].reset().play();
        this.body1Anims[0].reset().play();
        this.body2Anims[0].reset().play();
      }
      this.audio?.process_audio(TEST_PCM1);
      this.audio?.process_audio(TEST_PCM2);
      this.audio?.process_audio(TEST_PCM3);
      this.audio?.process_audio(TEST_PCM4);
      this.audio?.process_audio(TEST_PCM5);
      this.audio?.player.continue();
    }, 100);

    // this.emitter.$emit(ON_INTERSECT_TRIGGER, "code");
    // this.emitter.$emit(ON_INTERSECT_TRIGGER, this.actions["emo"].isRunning());
  }

  // BS动画停止
  bsStop() {
    this.isTriggerStop = true;
    this.bsAudioStop();
  }

  setTriggerStop(flag) {
    this.isTriggerStop = flag;
  }

  bsAudioStop() {
    if (this.teethAnims.length > 0 && this.teethAnims[0].isRunning()) {
      this.headAnims[0].fadeOut(0.5);
      this.teethAnims[0].stop();
      this.body1Anims[0].fadeOut(0.5);
      this.body2Anims[0].fadeOut(0.5);
      this.headAnims.splice(0, this.headAnims.length);
      this.teethAnims.splice(0, this.teethAnims.length);
      this.body1Anims.splice(0, this.body1Anims.length);
      this.body2Anims.splice(0, this.body2Anims.length);
    }
    // this.audio?.player.pause();
    this.audio?.player.stop();
    if (this.preAction && this.preAction.data.isActionFinish == 1) return;
    this.playAction({ animationName: "PlayOne-standby_001" });
  }

  changePeople(data: any) {
    if (!this.head) return;
    this.head = undefined;
    this.player.traverse(item => {
      if (isMesh(item)) {
        item.geometry.dispose();
        item.material.dispose();
      }
    });
    if (this.player) this.player.removeFromParent();
    console.log("changePeople ", Object.assign(PEOPLE_DATA, data));
    this._createPlayer(Object.assign(PEOPLE_DATA, data));
  }

  // 添加角色模型&人物动画
  private async _createPlayer(data) {
    this.isMale = data.people.pid == 18;
    try {
      const anims: any = [];
      if (!this.lite2) {
        for (let i = 0; i < data.animation.length; i++) {
          let animName = data.animation[i].url;
          if (this.isMale && animName.indexOf("_male.anim") == -1) {
            const index = animName.indexOf(".anim");
            animName = animName.substring(0, index) + "_male" + animName.substring(index);
          }
          const animData = await this.loader.file_loader.loadAsync(animName);
          if (animData.indexOf("<html") == -1) {
            const animJson = JSON.parse(animData);
            anims.push(animJson);
          }
          if (this.log) console.log("animName ", animName);
        }
      }
      this.model = await this.loader.gltf_loader.loadAsync(data ? data.people.url : CHARACTER_URL);
      this.player = this.model.scene;
      this.player.position.set(0, -1.45, 0);
      this.player.rotation.y = Math.PI;
      for (let h = 0; h < anims.length; h++) {
        const anim: any = anims[h];
        const tracks = anim.tracks;
        const len = tracks.length;
        for (let i = 0; i < len; i++) {
          if (tracks[i].name.indexOf(".quaternion") > -1) {
            tracks[i] = new THREE.QuaternionKeyframeTrack(tracks[i].name, tracks[i].times, tracks[i].values);
          } else {
            tracks[i] = new THREE.VectorKeyframeTrack(tracks[i].name, tracks[i].times, tracks[i].values);
          }
        }
        this.player.animations[h] = anim;
      }
      if (this.lite1) {
        this.player.rotation.y = 0;
        this.env?.spotLight.position.set(-2, 1.3, -5);
        this.orbit_controls.maxPolarAngle = Math.PI / 2 - Math.PI / 14;
        this.orbit_controls.minPolarAngle = Math.PI / 2 - Math.PI / 14;
      } else if (this.lite2) {
        this.player.scale.set(1.5, 1.5, 1.5);
        this.env?.spotLight.position.set(-2, 1.3, -5);
        this.player.animations = this.model.animations;
      }
      const box = new THREE.Box3().setFromObject(this.player);
      let boxPos = box.getCenter(new THREE.Vector3());
      let boxSize = box.getSize(new THREE.Vector3());
      boxSize.z = 1;
      const geometry = new THREE.BoxGeometry(Number(boxSize.x), Number(boxSize.y), Number(boxSize.z));
      const material = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.copy(boxPos);
      cube.name = "npcBox";
      cube.renderOrder = 1;
      this.scene.add(cube);
      this.detectionModels.push(cube);
      this.detectionModels.push(this.player);
      this.mixer = new AnimationMixer(this.player);
      this.mixer.addEventListener("finished", this.handleAnimFinish);
      this.mixer2 = new AnimationMixer(this.player);
      this.mixer2.addEventListener("finished", this.handleAnimFinish);
      if (this.log) console.log("模型", data, this.model, this.player.animations);
      this.actions = {
        idle: undefined,
        walk: undefined,
        wave: undefined
      };
      for (let i = 0; i < this.player.animations.length; i++) {
        const clip = this.player.animations[i];
        const action = this.mixer2.clipAction(clip);
        this.actions[clip.name] = action;
      }
      // console.log(this.model.animations, this.player.animations);
      this.playAction({ animationName: "PlayOne-thinking_001" });
      this.playAction({ animationName: "PlayOne-standby_001" });

      this.teeth = this.player.getObjectByName("grid");
      if (!this.teeth) this.teeth = this.player.getObjectByName("Wolf3D_Teeth");
      if (!this.teeth || !this.teeth.morphTargetInfluences) this.teeth = this.player.getObjectByName("grid_2");
      this.teethName = this.teeth.name;
      this.teethInfluences = this.teeth.morphTargetInfluences;
      this.head = this.player.getObjectByName("grid_1");
      if (!this.head) this.head = this.player.getObjectByName("Wolf3D_Head");
      if (!this.head || !this.head.morphTargetInfluences) this.head = this.player.getObjectByName("grid_3");
      this.headName = this.head.name;
      this.influences = this.head.morphTargetInfluences;
      if (this.log) {
        const api = { state: "PlayOne-standby_001" };
        const states = [
          "PlayOne-standby_001",
          "PlayOne-thinking_001",
          "PlayOne-listening_001",
          "PlayOne-explanation_001",
          "PlayOne-explanation_002",
          "PlayOne-explanation_003",
          "PlayOne-explanation_004",
          "PlayOne-explanation_005",
          "PlayOne-interaction_001",
          "PlayOne-Ruchang",
          "PlayOne-Lichang",
          "PlayOne-Idle001",
          "PlayOne-Idle002",
          "PlayOne-Idle003",
          "PlayOne-Huandengpian"
        ];
        if (this.gui) this.gui.close();
        this.gui = new GUI();
        this.gui
          .add(api, "state")
          .options(states)
          .onChange(() => {
            this.playAction({ animationName: api.state });
          });

        this.gui.add(this, "fullScreen").name("全屏");
        this.gui.add(this, "codeTest");
        this.gui.add(this, "bsTest");
        this.gui.add(this, "bsStop");
        this.gui.add(this.env?.spotLight.position, "z", -10.0, 10.0).name("灯光");
        this.gui.add(this, "changePeople").name("切换形象");
        this.gui.add(this.env, "changeScene").name("切换场景");

        this.teeth = this.player.getObjectByName("grid");
        if (!this.teeth) this.teeth = this.player.getObjectByName("Wolf3D_Teeth");
        if (!this.teeth || !this.teeth.morphTargetInfluences) this.teeth = this.player.getObjectByName("grid_2");
        this.teethName = this.teeth.name;
        this.teethInfluences = this.teeth.morphTargetInfluences;
        this.gui
          .add(this.teethInfluences, 34, 0, 1, 0.01)
          .name(this.teethName + ".jawOpen")
          .listen(this.teethInfluences);
        this.gui
          .add(this.influences, 34, 0, 1, 0.01)
          .name(this.headName + ".jawOpen")
          .listen(this.influences);
        this.gui
          .add(this.teethInfluences, 16, 0, 1, 0.01)
          .name(this.teethName + ".mouthShrugUpper")
          .listen(this.teethInfluences);

        // const grid_2 = this.player.getObjectByName("grid_2").morphTargetInfluences;
        // this.gui.add(grid_2, 34, 0, 1, 0.01).name("grid_2.jawOpen").listen(grid_2);
        // const grid_3 = this.player.getObjectByName("grid_3").morphTargetInfluences;
        // this.gui.add(grid_3, 34, 0, 1, 0.01).name("grid_3.jawOpen").listen(grid_2);

        // for (const [key, value] of Object.entries(this.head.morphTargetDictionary)) {
        //   console.log(key, this.influences[value]);
        //   this.gui.add(this.influences, value, 0, 1, 0.01).name(key).listen(this.influences);
        // }
      }
      // this.player.children[0].position.set(0, -15, 0);
      // this.player.scale.addScalar(100);
      this.player.traverse(item => {
        if (isMesh(item)) {
          item.castShadow = true;
          this.detectionModels.push(item);
        }
        if (this.log && item.morphTargetDictionary) {
          console.log(item.name, isMesh(item), item);
        }
      });

      this.scene.add(this.player);
      this.player.visible = false;
      setTimeout(() => {
        this.player.visible = true;
        if (data.callback) data.callback();
      }, 10);
      // this._createPlayerShape();
      // console.log("Player assets loaded.");
      // this.reset();
    } catch (error) {
      console.error("Error loading player assets:", error);
    }
  }

  // BS数据转成动画
  bsEmo(bsData) {
    const tracks: THREE.KeyframeTrack[] = []; // 关键帧动画数据集
    const tracks2: THREE.KeyframeTrack[] = [];
    const tracks3: THREE.KeyframeTrack[] = [];
    const tracks4: THREE.KeyframeTrack[] = [];
    const morphs = {}; // 每个BS按时间轴顺序变化的权重值

    const timeAxis: number[] = []; // 时间轴，取结尾时间
    // 因为模型的BS数量以及命名不一定与接口数据完全重合，所以我们自己做了一个映射关系
    // BSNameMap 模型中BS名称与接口BS名称对应关系
    // BSIndexMap 模型中BS名称在变形动画权重数组中的下标对应关系
    Object.keys(this.bsNameMap).forEach(key => {
      morphs[key] = [];
    });
    bsData.forEach((ele, index) => {
      timeAxis.push(ele.time); // push到时间轴中
      // 按时间节点给BS权重赋值
      Object.keys(morphs).forEach(key => {
        // 如果能从接口数据中取到BS权重，则push给当前BS
        if (ele["blendshapes"][key]) {
          morphs[key].push(ele["blendshapes"][key] / (this.lite2 ? 1 : 1.5));
        } else {
          // 如果取不到则沿用上一个时间节点的数据或者设置为默认权重0
          morphs[key].push(morphs[key][index - 1] || 0);
        }
      });
    });
    // console.log(morphs);

    // 根据morphs来生成每个BS按时间轴变化的关键帧动画
    Object.keys(morphs).forEach(key => {
      // 控制BS权重值按时间轴timeAxis进行变化
      const track = new THREE.KeyframeTrack(
        `${this.headName}.morphTargetInfluences[${this.bsNameMap[key]}]`,
        timeAxis,
        morphs[key]
      );
      tracks.push(track);
      const track2 = new THREE.KeyframeTrack(
        `${this.teethName}.morphTargetInfluences[${this.bsNameMap[key]}]`,
        timeAxis,
        morphs[key]
      );
      if (key == "jawOpen") {
        track.values = track.values.map(num => num * 2);
        track2.values = track2.values.map(num => num * 2);
      }
      tracks2.push(track2);
      if (!this.lite1) {
        const track3 = new THREE.KeyframeTrack(
          `${"grid_2"}.morphTargetInfluences[${this.bsNameMap[key]}]`,
          timeAxis,
          morphs[key]
        );
        tracks3.push(track3);
        const track4 = new THREE.KeyframeTrack(
          `${"grid_3"}.morphTargetInfluences[${this.bsNameMap[key]}]`,
          timeAxis,
          morphs[key]
        );
        tracks4.push(track4);
      }
    });

    // 创建一个剪辑clip对象，命名"default"
    // 这个剪辑对象可以用来播放，播放后的动作就是当前解析的这句话的面部表情动作
    const clip = new THREE.AnimationClip("head", timeAxis[timeAxis.length - 1], tracks);
    // console.log(clip);
    const clip2 = new THREE.AnimationClip("teeth", timeAxis[timeAxis.length - 1], tracks2);
    const clip3 = new THREE.AnimationClip("body1", timeAxis[timeAxis.length - 1], tracks3);
    const clip4 = new THREE.AnimationClip("body2", timeAxis[timeAxis.length - 1], tracks4);

    const emoAction = this.mixer.clipAction(clip);
    emoAction.loop = THREE.LoopOnce;
    emoAction.clampWhenFinished = false;
    // emoAction.reset().play();
    // this.actions["emo"] = emoAction;

    const emoAction2 = this.mixer.clipAction(clip2);
    emoAction2.loop = THREE.LoopOnce;
    emoAction2.clampWhenFinished = false;
    // emoAction2.reset().play();
    // this.actions["emo2"] = emoAction2;
    this.headAnims.push(emoAction);
    this.teethAnims.push(emoAction2);
    const emoAction3 = this.mixer.clipAction(clip3);
    const emoAction4 = this.mixer.clipAction(clip4);
    emoAction3.loop = THREE.LoopOnce;
    emoAction4.loop = THREE.LoopOnce;
    this.body1Anims.push(emoAction3);
    this.body2Anims.push(emoAction4);
    if (this.log) console.log("headAnims ", this.headAnims, this.teethAnims);
  }

  async loadAction(animName) {
    const animData = await this.loader.file_loader.loadAsync("scene/animation/" + animName + ".anim");
    const anim = JSON.parse(animData);
    const tracks = anim.tracks;
    const len = tracks.length;
    for (let i = 0; i < len; i++) {
      if (tracks[i].name.indexOf(".quaternion") > -1) {
        tracks[i] = new THREE.QuaternionKeyframeTrack(tracks[i].name, tracks[i].times, tracks[i].values);
      } else {
        tracks[i] = new THREE.VectorKeyframeTrack(tracks[i].name, tracks[i].times, tracks[i].values);
      }
    }
    const action = this.mixer2.clipAction(anim);
    this.actions[anim.name] = action;
    return action;
  }

  async playAction(data: any) {
    if (this.lite2) {
      switch (data.animationName) {
        case "PlayOne-standby_001":
          data.animationName = "PlayOne-Idle";
          break;
        case "PlayOne-thinking_001":
          data.animationName = "PlayOne-Think_";
          break;
        case "PlayOne-listening_001":
          data.animationName = "PlayOne-Listen";
          break;
        case "PlayOne-explanation_001":
          data.animationName = "PlayOne-Explain1";
          break;
      }
    }
    if (this.log) console.log("playAction ", data, this.isMale);
    if (!data.animationName) return;
    if (data.animationName == "PlayOne-standby_001" || data.animationName == "PlayOne-Idle") {
      this.orbit_controls.maxAzimuthAngle = Math.PI + Math.PI / 8;
      this.orbit_controls.minAzimuthAngle = Math.PI - Math.PI / 8;
      const preData = this.preAction ? this.preAction.data : undefined;
      if (preData && data.animationName == preData.animationName) return;
    }
    try {
      if (this.mixer2) {
        let action = this.actions[data.animationName + (this.isMale ? "_male" : "")];
        if (!action) action = await this.loadAction(data.animationName + (this.isMale ? "_male" : ""));
        action.data = data;
        if (data.animationName.startsWith("PlayOne")) {
          if (this.preAction) {
            if (data.animationName.startsWith("PlayOne-explanation_") || data.animationName.startsWith("PlayOne-Explain")) {
              this.preAction.stop();
            } else {
              this.preAction.fadeOut(0.2);
            }
          }
          this.preAction = action;
        } else {
          action.stop();
        }
        if (
          data.isActionFinish != 1 &&
          ["PlayOne-Idle", "PlayOne-standby_001", "PlayOne-listening_001", "PlayOne-thinking_001"].includes(data.animationName)
        ) {
          action.setLoop(THREE.LoopRepeat);
        } else {
          action.setLoop(THREE.LoopOnce);
        }
        action.reset().play();
        // action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.1).play();
        // if (this.handleAnimFinish && !this.stopJieShuo) {
        //   this.mixer.addEventListener("finished", this.handleAnimFinish);
        // }
      }
    } catch (error) {
      console.log("playActionCatch ", error, data);
    }
  }

  finishCallback(event: any) {
    if (this.log) console.log("finishCallback ", event.action._clip.name, event.action.data);
    if (event.action._clip.name == "head" && this.headAnims.length > 1) {
      this.mixer.uncacheAction(this.headAnims[0].getClip());
      this.mixer.uncacheAction(this.teethAnims[0].getClip());
      this.headAnims.splice(0, 1);
      this.teethAnims.splice(0, 1);
      this.body1Anims.splice(0, 1);
      this.body2Anims.splice(0, 1);
      this.headAnims[0].reset().play();
      this.teethAnims[0].reset().play();
      this.body1Anims[0].reset().play();
      this.body2Anims[0].reset().play();
      // console.log(this.headAnims);
    }
    if (!event.action.data) return;
    if (event.action.data.callback) event.action.data.callback(event.action.data.animationName);
    if (event.action.data.isActionFinish == 1) {
      this.preAction.stop();
      if (event.action.data.animationName.indexOf("PlayOne-Hi") > -1) {
        this.playAction({ animationName: event.action.data.animationName2, isActionFinish: 1 });
      } else {
        this.playAction({ animationName: this.lite2 ? "PlayOne-Idle" : "PlayOne-standby_001" });
      }
      return;
    }
    let name = event.action.data.animationName.replace("_male", "");
    switch (name) {
      case "PlayOne-explanation_001":
        name = "PlayOne-explanation_002";
        break;
      case "PlayOne-explanation_002":
        name = "PlayOne-explanation_003";
        break;
      case "PlayOne-explanation_003":
        name = "PlayOne-explanation_004";
        break;
      case "PlayOne-explanation_004":
        name = "PlayOne-explanation_005";
        break;
      case "PlayOne-explanation_005":
        name = "PlayOne-explanation_001";
        break;
      case "PlayOne-Explain1":
        name = "PlayOne-Explain2";
        break;
      case "PlayOne-Explain2":
        name = "PlayOne-Explain3";
        break;
      case "PlayOne-Explain3":
        name = "PlayOne-Explain4";
        break;
      case "PlayOne-Explain5":
        name = "PlayOne-Explain1";
        break;
    }
    if (!this.stopJieShuo && (name.startsWith("PlayOne-explanation_") || name.startsWith("PlayOne-Explain"))) {
      this.playAction({ animationName: name });
    }
  }

  /*
   * 创建角色包围盒
   * */
  private _createPlayerShape() {
    this.player_shape = new Mesh(
      new BoxGeometry(0.8, 1.7, 0.8),
      new MeshBasicMaterial({
        color: 0xff9900,
        wireframe: true
      })
    );

    this.player_shape.visible = true;

    this.scene.add(this.player_shape);
  }

  /*
   * 更新角色包围盒当前位置
   * */
  private _updatePlayerShape() {
    if (this.player_shape && this.player) {
      this.player_shape.position.copy(this.player.position.clone());
      this.player_shape.translateY(-0.5);
    }
  }

  private _onKeyDown([key_code]: [keycode: string]) {
    if (key_code === "Space") {
      this._characterJump();
    }
    if (key_code === "KeyV") {
      this._switchPersonView();
    }
  }

  private _updateControls() {
    if (this.is_first_person) {
      this.orbit_controls.maxPolarAngle = Math.PI;
      this.orbit_controls.minDistance = 1e-4;
      this.orbit_controls.maxDistance = 1e-4;
    } else {
      // this.orbit_controls.maxPolarAngle = Math.PI / 2;
      this.orbit_controls.minDistance = 2;
      this.orbit_controls.maxDistance = 5;
    }
  }

  /*
   * 更新角色移动、方位朝向、动作
   * */
  private _updatePlayer(delta_time: number) {
    if (this.player_is_on_ground) {
      this.velocity.y = delta_time * this.gravity;
    } else {
      this.velocity.y += delta_time * this.gravity;
    }
    this.player.position.addScaledVector(this.velocity, delta_time);

    this._updateDirection();

    this._updateAction(delta_time);

    // 控制移动
    const angle = this.orbit_controls.getAzimuthalAngle();
    if (this.control.key_status["KeyW"]) {
      this.temp_vector.set(0, 0, -1).applyAxisAngle(this.up_vector, angle);
      this.player.position.addScaledVector(this.temp_vector, this.speed * delta_time);
    }

    if (this.control.key_status["KeyS"]) {
      this.temp_vector.set(0, 0, 1).applyAxisAngle(this.up_vector, angle);
      this.player.position.addScaledVector(this.temp_vector, this.speed * delta_time);
    }

    if (this.control.key_status["KeyA"]) {
      this.temp_vector.set(-1, 0, 0).applyAxisAngle(this.up_vector, angle);
      this.player.position.addScaledVector(this.temp_vector, this.speed * delta_time);
    }

    if (this.control.key_status["KeyD"]) {
      this.temp_vector.set(1, 0, 0).applyAxisAngle(this.up_vector, angle);
      this.player.position.addScaledVector(this.temp_vector, this.speed * delta_time);
    }

    this.player.updateMatrixWorld();
  }

  /*
   * 控制角色方向
   * */
  private _updateDirection() {
    if (
      !this.control.key_status["KeyW"] &&
      !this.control.key_status["KeyS"] &&
      !this.control.key_status["KeyA"] &&
      !this.control.key_status["KeyD"] &&
      !this.control.key_status["Space"]
    ) {
      return;
    }

    const quaternion_helper = this.player.quaternion.clone();

    let direction_offset = typeof this.last_direction_angle === "number" ? this.last_direction_angle : Math.PI; // w

    if (this.control.key_status["KeyS"]) {
      if (this.control.key_status["KeyA"] && this.control.key_status["KeyD"]) {
        direction_offset = -Math.PI / 4 + Math.PI / 4; // s+a+d
      } else if (this.control.key_status["KeyA"]) {
        direction_offset = -Math.PI / 4; // s+a
      } else if (this.control.key_status["KeyD"]) {
        direction_offset = Math.PI / 4; // s+d
      } else {
        direction_offset = -Math.PI / 4 + Math.PI / 4; // s
      }
    } else if (this.control.key_status["KeyW"]) {
      if (this.control.key_status["KeyA"] && this.control.key_status["KeyD"]) {
        // w+a+d
        direction_offset = Math.PI;
      } else if (this.control.key_status["KeyA"]) {
        direction_offset = -Math.PI / 4 - Math.PI / 2; // w+a
      } else if (this.control.key_status["KeyD"]) {
        direction_offset = Math.PI / 4 + Math.PI / 2; // w+d
      } else {
        direction_offset = Math.PI;
      }
    } else if (this.control.key_status["KeyA"]) {
      direction_offset = -Math.PI / 2; // a
    } else if (this.control.key_status["KeyD"]) {
      direction_offset = Math.PI / 2; // d
    }
    this.last_direction_angle = direction_offset;

    // calculate towards camera direction
    const angle_y_camera_direction = Math.atan2(
      this.camera.position.x - this.player.position.x,
      this.camera.position.z - this.player.position.z
    );

    // rotate model
    this.rotate_quarternion.setFromAxisAngle(this.rotate_angle, angle_y_camera_direction + direction_offset);
    quaternion_helper.rotateTowards(this.rotate_quarternion, 0.4);
    this.player.quaternion.slerp(quaternion_helper, 0.6);
  }

  /*
   * 控制角色动作
   * */
  private _updateAction(delta_time: number) {
    this.mixer?.update(delta_time);

    let next_action: Actions;
    if (
      this.player_is_on_ground &&
      (this.control.key_status["KeyW"] ||
        this.control.key_status["KeyS"] ||
        this.control.key_status["KeyA"] ||
        this.control.key_status["KeyD"])
    ) {
      next_action = "walk";
    } else if (this.player_is_on_ground) {
      next_action = "idle";
    } else {
      next_action = "wave";
    }

    if (next_action !== this.cur_action) {
      this.actions[this.cur_action]?.fadeOut(0.1);
      this.actions[next_action]?.reset().play().fadeIn(0.5);
      this.cur_action = next_action;
    }
  }

  /*
   * 计算角色（胶囊体）与场景的碰撞
   * */
  private _checkCapsuleCollision(delta_time: number, scene_collider: Mesh) {
    // 根据碰撞来调整player位置
    const capsule_info = this.capsule_info;
    this.temp_box.makeEmpty();
    this.temp_mat.copy(scene_collider.matrixWorld).invert();
    this.temp_segment.copy(capsule_info.segment);

    // 获取胶囊体在对撞机局部空间中的位置
    this.temp_segment.start.applyMatrix4(this.player.matrixWorld).applyMatrix4(this.temp_mat);
    this.temp_segment.end.applyMatrix4(this.player.matrixWorld).applyMatrix4(this.temp_mat);

    // 获取胶囊体的轴对齐边界框
    this.temp_box.expandByPoint(this.temp_segment.start);
    this.temp_box.expandByPoint(this.temp_segment.end);

    this.temp_box.min.addScalar(-capsule_info.radius);
    this.temp_box.max.addScalar(capsule_info.radius);

    if (isBVHGeometry(scene_collider.geometry)) {
      scene_collider.geometry.boundsTree.shapecast({
        intersectsBounds: box => box.intersectsBox(this.temp_box),
        intersectsTriangle: tri => {
          // 检查场景是否与胶囊相交，并调整
          const tri_point = this.temp_vector;
          const capsule_point = this.temp_vector2;

          const distance = tri.closestPointToSegment(this.temp_segment, tri_point, capsule_point);
          if (distance < capsule_info.radius) {
            const depth = capsule_info.radius - distance;
            const direction = capsule_point.sub(tri_point).normalize();

            this.temp_segment.start.addScaledVector(direction, depth);
            this.temp_segment.end.addScaledVector(direction, depth);
          }
        }
      });
    }

    // 检查后得到胶囊体对撞机的调整位置
    // 场景碰撞并移动它. capsule_info.segment.start被假定为玩家模型的原点。
    const new_position = this.temp_vector;
    new_position.copy(this.temp_segment.start).applyMatrix4(scene_collider.matrixWorld);

    // 检查对撞机移动了多少
    const delta_vector = this.temp_vector2;
    delta_vector.subVectors(new_position, this.player.position);

    // 如果player主要是垂直调整，我们认为这是在我们应该考虑的地面上
    this.player_is_on_ground = delta_vector.y > Math.abs(delta_time * this.velocity.y * 0.25);

    const offset = Math.max(0.0, delta_vector.length() - 1e-5);
    delta_vector.normalize().multiplyScalar(offset);

    // 调整player模型位置
    this.player.position.add(delta_vector);

    if (!this.player_is_on_ground) {
      delta_vector.normalize();
      this.velocity.addScaledVector(delta_vector, -delta_vector.dot(this.velocity));
    } else {
      this.velocity.set(0, 0, 0);
    }
  }

  /*
   * 相机碰撞检测优化
   * */
  private _checkCameraCollision(colliders: Object3D[]) {
    if (!this.is_first_person) {
      const ray_direction = new Vector3();
      ray_direction.subVectors(this.camera.position, this.player.position).normalize();
      this.camera_raycaster.set(this.player.position, ray_direction);
      const intersects = this.camera_raycaster.intersectObjects(colliders);
      if (intersects.length) {
        // 找到碰撞点后还需要往前偏移一点，不然还是可能会看到穿模
        const offset = new Vector3(); // 定义一个向前移动的偏移量
        offset.copy(ray_direction).multiplyScalar(-0.5); // 计算偏移量，这里的distance是想要向前移动的距离
        const new_position = new Vector3().addVectors(intersects[0].point, offset); // 计算新的相机位置
        this.camera.position.copy(new_position);

        this.orbit_controls.minDistance = 0;
      } else {
        this.orbit_controls.minDistance = 2;
      }
    }
  }

  /*
   * 掉落地图检测
   * */
  private _checkReset() {
    if (this.player.position.y < this.reset_y) {
      this.reset();
    }
  }

  reset() {
    this.velocity.set(0, 0, 0);
    this.player.position.copy(this.reset_position);
    this.camera.position.sub(this.orbit_controls.target);
    this.orbit_controls.target.copy(this.player.position);
    this.camera.position.add(this.player.position);
    this.orbit_controls.update();
  }

  /*
   * 切换视角
   * */
  private _switchPersonView() {
    this.is_first_person = !this.is_first_person;
    if (!this.is_first_person) {
      this.player.visible = true;
      this.camera.position.sub(this.orbit_controls.target).normalize().multiplyScalar(5).add(this.orbit_controls.target);
    } else {
      this.player.visible = false;
    }
  }

  /*
   * 角色跳跃
   * */
  private _characterJump() {
    if (this.player_is_on_ground) {
      this.velocity.y = this.jump_height;
      this.player_is_on_ground = false;
    }
  }
}
