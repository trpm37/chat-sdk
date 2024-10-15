import World from "./world/index";
import axios from "axios";
import { wake_up_config as mo_wake_up_config, human_config as mo_human_config } from "@/config/defaultValue";
import { ON_LOAD_PROGRESS } from "./Constants";

export class oohelpChatSDK {
  box: any;
  id: any;
  chatStore: any;
  world: any;
  world_init_callback: any;
  world_progress_callback: any;
  constructor(params: any) {
    this.box = params.box || null;
    this.id = params.id || "";
    this.chatStore = params.data || {};
    this.world = null;
    this.world_init_callback = params.world_init_callback || null;
    this.world_progress_callback = params.world_progress_callback || null;
  }
  async init() {
    await this.getDetail();
    // 3d引擎初始化
    this.world = new World({ box: this.box, data: this.chatStore });
    if (this.world_progress_callback) {
      this.world.emitter.$on(ON_LOAD_PROGRESS, this.world_progress_callback);
    }
    this.world.init(() => {
      console.log("--sdk--", "初始化");
      if (this.world_init_callback) {
        this.world_init_callback();
      }
    });
    this.world.render();
  }
  //获取详情
  async getDetail() {
    // loading = true;
    let reData: any = null;
    let url = "https://api.oohelp.cn/api/v1/chat/topics/" + this.id;
    let res = await axios({
      method: "GET",
      url: url
    });
    console.log("--sdk--", "获取详情", url, res, mo_wake_up_config, mo_human_config);
    // loading = false;
    if (res && res.data && res.data.code == 200) {
      reData = res.data.data;
      let { human_config, wake_up_config } = reData.robot;
      //页面标题
      if (reData.robot_name) {
        document.title = reData.robot_name;
      }
      if (human_config) {
        let { people, voice, animation, customMenu } = human_config;
        if (!people) {
          human_config.people = mo_human_config.people;
        }
        if (!voice) {
          human_config.voice = mo_human_config.voice;
        }
        if (!animation) {
          human_config.animation = mo_human_config.animation;
        }
        if (!customMenu) {
          human_config.customMenu = mo_human_config.customMenu;
        }
        reData.robot.human_config = human_config;
      } else {
        reData.robot.human_config = mo_human_config;
      }
      // 唤醒配置
      if (wake_up_config) {
        let { welcome, awake, isTouchAwake, everyNeedAwake } = wake_up_config;
        wake_up_config.isTouchAwake = isTouchAwake == undefined ? mo_wake_up_config.isTouchAwake : isTouchAwake;
        wake_up_config.everyNeedAwake = everyNeedAwake == undefined ? mo_wake_up_config.everyNeedAwake : everyNeedAwake;
        if (!welcome) {
          wake_up_config.welcome = mo_wake_up_config.welcome;
        }
        if (!awake) {
          wake_up_config.awake = mo_wake_up_config.awake;
        } else {
          let { keyword, reply } = awake;
          if (!keyword) {
            wake_up_config.awake.keyword = mo_wake_up_config.awake.keyword;
          }
          if (!reply) {
            wake_up_config.awake.reply = mo_wake_up_config.awake.reply;
          }
        }
        reData.robot.wake_up_config = wake_up_config;
      } else {
        reData.robot.wake_up_config = mo_wake_up_config;
      }
      this.chatStore = reData;
      console.log("--sdk--", this.chatStore);
    }
    return reData;
  }
}
