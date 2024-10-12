import { defineStore } from "pinia";
import { ChatState } from "../interface";
import piniaPersistConfig from "../helper/persist";

export const useChatStore = defineStore({
  id: "chat-data",
  state: (): ChatState => ({
    info: {}
  }),
  getters: {},
  actions: {
    setInfo(params: any) {
      this.info = Object.assign(this.info, params);
    }
  },
  persist: piniaPersistConfig("chat-data")
});
