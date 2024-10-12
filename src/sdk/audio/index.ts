import { Scene, Mesh, MeshBasicMaterial, PlaneGeometry, AudioListener, PerspectiveCamera } from "three";
import * as THREE from "three";
import Loader from "../loader";
import PCMPlayer from "./pcm-player";
import Emitter from "../emitter";
import { ON_INTERSECT_TRIGGER } from "../Constants";

interface AudioParams {
  scene: Scene;
  camera: PerspectiveCamera;
  loader: Loader;
  emitter: Emitter;
}

export default class Audio {
  private scene: Scene;
  private camera: PerspectiveCamera;
  private loader: Loader;
  private emitter: Emitter;

  positional_audio: THREE.PositionalAudio | undefined;
  private audio_mesh: Mesh | undefined;
  is_playing = false;
  analyser: any;
  player: PCMPlayer;

  constructor({ scene, camera, loader, emitter }: AudioParams) {
    this.scene = scene;
    this.camera = camera;
    this.loader = loader;
    this.emitter = emitter;
    this._createAudio();

    // 创建实例
    this.player = new PCMPlayer(this.positional_audio.context, this.positional_audio.gain, {
      inputCodec: "Int16",
      channels: 1,
      sampleRate: 16000,
      flushTime: 300,
      fftSize: 128,
      onstatechange: (node, event, type) => {
        // console.log("onstatechange ", node, event, type);
        if (node || event || type) {
          //ts
        }
      },
      onended: (node, event) => {
        if (this.player.bufferSource_list.length == 0) {
          this.emitter.$emit(ON_INTERSECT_TRIGGER, "onended", node, event);
          // console.log("onended ", node, event);
        }
      }
    });
  }

  process_audio(audio) {
    fetch("data:application/octet-stream;base64," + audio)
      .then(r => r.arrayBuffer())
      .then(buffer => {
        // console.log("process_audio ", buffer);
        if (this.player) this.player.feed(buffer);
      });
  }

  private async _createAudio() {
    this.audio_mesh = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: 0xff0000 }));
    this.audio_mesh.position.set(0, 1, 10);
    this.audio_mesh.rotation.y = Math.PI;
    this.audio_mesh.visible = true;
    // this.scene.add(this.audio_mesh);

    const listener = new AudioListener();

    // this.camera.add(listener);
    this.positional_audio = new THREE.Audio(listener);
    // this.audio_mesh.add(this.positional_audio);

    // const buffer = await this.loader.audio_loader.loadAsync(AUDIO_URL);
    // this.positional_audio.setBuffer(buffer);
    // this.positional_audio.setVolume(0.5);
    // this.positional_audio.setLoop(false);
    const fftSize = 128;
    this.analyser = new THREE.AudioAnalyser(this.positional_audio, fftSize);

    return Promise.resolve();
  }

  playAudio() {
    this.is_playing = true;
    this.positional_audio?.play();
  }
  stopAudio() {
    this.is_playing = false;
    this.positional_audio?.stop();
  }

  togglePlayAudio() {
    if (this.is_playing) {
      this.is_playing = false;
      this.positional_audio?.pause();
    } else {
      this.is_playing = true;
      this.positional_audio?.play();
    }
  }
}
