
// 默认唤醒
export const wake_up_config = {
  awakeMethod: 0,
  welcome: `您好，我是【小蛙】！一个拥有超强大脑的AI智能体，您可以喊我的名字【小蛙同学】将我唤醒或打断。`, //唤醒引导语
  awake: {
    keyword: ["小蛙同学", "小娃同学", "小哇同学"], //唤醒词
    reply: "我在" //唤醒回复词
  },
  dance: {
    keyword: ["跳个舞吧"],
    reply: "好的"
  },
  set: {
    keyword: ["打开设置"],
    reply: "好的"
  },
  isTouchAwake:0,
  everyNeedAwake:0
};
// 默认数字人
export const human_config = {
  //人物
  people: {
    id: 19,
    pid: 17,
    url: "scene/meta_human/human001.glb",
    cover: "scene/meta_human/human001.png"
  },
  //服装
  clothing: {
    id: 0,
    pid: 0,
    url: "",
    cover: ""
  },
  //场景
  environment: {
    id: 63,
    pid: 62,
    url: "",
    cover: "",
    from: 0,
    img: ""
  },
  //主题
  theme: {
    id: 0,
    pid: 0,
    url: "",
    cover: ""
  },
  //音色
  voice: {
    id: 3,
    url: "scene/voice_actor/BV700_V2_streaming.mp3"
  },
  //动作
  animation: [
    //倾听
    {
      id: 55,
      animation_type: "listening_animation",
      url: "scene/animation/PlayOne-listening_001.anim"
    },
    //思考
    {
      id: 34,
      animation_type: "thinking_animation",
      url: "scene/animation/PlayOne-thinking_001.anim"
    },
    //解说
    {
      id: 30,
      animation_type: "explanation_animation",
      url: "scene/animation/PlayOne-explanation_001.anim"
    },
    {
      id: 31,
      animation_type: "explanation_animation",
      url: "scene/animation/PlayOne-explanation_002.anim"
    },
    {
      id: 51,
      animation_type: "explanation_animation",
      url: "scene/animation/PlayOne-explanation_003.anim"
    },
    {
      id: 52,
      animation_type: "explanation_animation",
      url: "scene/animation/PlayOne-explanation_004.anim"
    },
    {
      id: 53,
      animation_type: "explanation_animation",
      url: "scene/animation/PlayOne-explanation_005.anim"
    },
    //入场
    {
      id: 32,
      animation_type: "entry_animation",
      url: "scene/animation/PlayOne-entry_001.anim"
    },
    //离场
    {
      id: 37,
      animation_type: "exit_animation",
      url: "scene/animation/PlayOne-exit_001.anim"
    },
    //待机
    {
      id: 33,
      animation_type: "standby_animation",
      url: "scene/animation/PlayOne-standby_001.anim"
    },
    //互动
    {
      id: 35,
      animation_type: "interaction_animation",
      url: "scene/animation/PlayOne-interaction_001.anim"
    },
    //演示
    {
      id: 36,
      animation_type: "presentation_animation",
      url: "scene/animation/PlayOne-presentation_001.anim"
    },
    //打招呼
    {
      id: 58,
      animation_type: "other_animation",
      url: "scene/animation/PlayOne-Hi.anim"
    }
  ],
  customMenu: { isShow: 1, title: "导航菜单", list: [] }
};
