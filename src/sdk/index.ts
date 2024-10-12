import World from "./world/index";
// 将方法暴露给第三方调用
export function MySDK() {
  let world = new World();
  world.init(() => {
    console.log("初始化")
  });
  world.render();
};

// 默认导出整个 SDK 对象
// export default MySDK;
