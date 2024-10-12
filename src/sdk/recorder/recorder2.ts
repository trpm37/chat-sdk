import Recorder from "./recorder-core";

class WebSocket_module {
  socket: WebSocket | null;
  socket_url: string;
  socket_status: number;
  mode: string;
  itn: boolean;
  hotWords: string;
  state_callback: any;
  msg_callback: any;
  msg_status: number;

  constructor(params: any) {
    let { socket_url, mode, hotWords, state_callback, msg_callback } = params;
    this.socket = null;
    this.socket_url = socket_url || "wss://io.wasee.com:10096/";
    this.socket_status = -1; // -1未连接 0成功 1停止 2失败
    this.mode = mode || "2pass";
    this.itn = false;
    this.hotWords = hotWords || "";
    this.state_callback = state_callback || null;
    this.msg_callback = msg_callback || null;
    this.msg_status = 0; //消息状态 0发送消息 1消息开始 2消息结束中 3消息结束成功
  }

  // 连接
  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.socket_url.match(/wss:\S*|ws:\S*/)) {
        console.log("请检查wss地址正确性");
        reject("请检查wss地址正确性");
      } else {
        if ("WebSocket" in window) {
          this.socket = new WebSocket(this.socket_url);
          this.socket.onopen = (e: any) => {
            console.log("-----socket 连接成功-----", e);
            this.openHandle();
            resolve(e);
          };
          this.socket.onmessage = (e: any) => {
            // console.log("-----socket 信息-----");
            this.msgHandle(e);
          };
          this.socket.onclose = (e: any) => {
            console.log("-----socket 关闭-----", e);
            this.stateHandle(1);
          };
          this.socket.onerror = (e: any) => {
            console.log("-----socket 错误-----", e);
            this.stateHandle(2);
          };
        } else {
          console.log("当前浏览器不支持 WebSocket");
          reject("当前浏览器不支持 WebSocket");
        }
      }
    });
  }

  // 关闭连接
  close(): void {
    if (this.socket) {
      this.socket_status = 1;
      this.socket.close();
    }
  }
  // 发送信息 开始
  send_start(params: { data: any }): void {
    let sendParams = {
      chunk_size: [5, 10, 5],
      wav_name: "h5",
      is_speaking: true,
      chunk_interval: 10,
      itn: this.itn,
      mode: this.mode,
      ...params.data
    };
    if (this.hotWords) {
      sendParams.hotWords = this.hotWords;
    }
    if (this.socket && this.socket.readyState == WebSocket.OPEN) {
      this.msg_status = 1;
      this.socket.send(JSON.stringify(sendParams));
      console.log("socket消息开始", sendParams);
    }
  }
  // 发送信息 结束
  send_end(params: { data: any }): Promise<any> {
    let sendParams = {
      chunk_size: [5, 10, 5],
      wav_name: "h5",
      is_speaking: false,
      chunk_interval: 10,
      mode: this.mode,
      ...params.data
    };
    console.log("socket消息结束", sendParams);
    this.msg_status = 2;
    this.send(JSON.stringify(sendParams));

    console.log("消息结束回调开始", this.msg_status);
    return new Promise<any>(resolve => {
      let sta = () => {
        // console.log("消息结束回调", this.msg_status);
        if (this.msg_status == 3) {
          console.log("消息结束回调成功", this.msg_status);
          resolve(1);
        } else {
          setTimeout(() => {
            sta();
          }, 10);
        }
      };
      sta();
    });
  }
  // 发送信息
  send(params: string): void {
    // console.log("socket 发送信息");
    if (this.socket && this.socket.readyState == WebSocket.OPEN) {
      // console.log("-----socket 发送信息");
      this.socket.send(params);
    }
  }
  // 打开回调
  private openHandle(): void {
    this.stateHandle(0);
  }
  // 状态回调
  private stateHandle(state: number): void {
    this.socket_status = state;

    if (this.state_callback && typeof this.state_callback == "function") {
      this.state_callback(state);
    }
  }
  // 信息回调
  private msgHandle(params: any): void {
    // console.log("socket message: ", params);
    let jsonMsg = JSON.parse(params.data);
    let is_final = jsonMsg["is_final"];
    if (is_final) {
      this.msg_status = 3;
      // console.log("消息结束", this.msg_status);
    }
    if (this.msg_callback && typeof this.msg_callback == "function") {
      this.msg_callback(jsonMsg);
    }
  }
  //纠正
  handleWithTimestamp(tmptext: any, tmptime: any): any {
    // console.log("tmptext: " + tmptext);
    // console.log("tmptime: " + tmptime);
    if (tmptime == null || tmptime == "undefined" || tmptext.length <= 0) {
      return tmptext;
    }
    console.log("66666666");
    tmptext = tmptext.replace(/。|？|，|、|\?|\.|\ /g, ","); // in case there are a lot of "。"
    let words = tmptext.split(","); // split to chinese sentence or english words
    let jsontime = JSON.parse(tmptime); //JSON.parse(tmptime.replace(/\]\]\[\[/g, "],[")); // in case there are a lot segments by VAD
    let char_index = 0; // index for timestamp
    let text_withtime = "";
    for (let i = 0; i < words.length; i++) {
      if (words[i] == "undefined" || words[i].length <= 0) {
        continue;
      }
      console.log("words==", words[i]);
      console.log("words: " + words[i] + ",time=" + jsontime[char_index][0] / 1000);
      if (/^[a-zA-Z]+$/.test(words[i])) {
        // if it is english
        text_withtime = text_withtime + jsontime[char_index][0] / 1000 + ":" + words[i] + "\n";
        char_index = char_index + 1; //for english, timestamp unit is about a word
      } else {
        // if it is chinese
        text_withtime = text_withtime + jsontime[char_index][0] / 1000 + ":" + words[i] + "\n";
        char_index = char_index + words[i].length; //for chinese, timestamp unit is about a char
      }
    }
    return text_withtime;
  }
}

//----------录音--------
let recorderObj: any = {
  data: {
    mikeOpen: 0, //麦克风是否打开0未打开1打开
    socketObj: null,
    way: "mic", //选择录音模式 mic file
    file_ext: "", //文件格式
    mode: "2pass", //asr模型模式: 2pass online offline
    sampleRate: 16000, //采样率
    bitRate: 16, //比特率
    itn: false, //逆文本标准化(ITN) false true
    hotWords: '{"阿里巴巴":20,"hello world":40}', //热词
    rec: null, //录音对象
    stream: null, //音频流
    bufferSize: 4096, //表示音频缓冲区的大小。必须是以下值之一：256, 512, 1024, 2048, 4096, 8192, 或 16384。这个值决定了每次处理多少帧的音频数据。缓冲区越大，延迟越高，但计算负荷越低。通常，4096 是一个常见的选择。
    sampleBuf: new Int16Array(), //采样数据
    sendBuf: null, //发送数据
    audioContext: {
      obj: null,
      node: null
    },
    mediaRecorder: {
      obj: null
    },
    rec_status: 0, //录音状态 0未录音 1打开中 2录音中 3停止中 4已停止
    rec_text: "", //录音文本
    offline_text: "", //for offline
    rec_msgCallback: null //录音信息回调
  },
  // init
  init: async function (params: any) {
    let { socket_url = "", mode = recorderObj.data.mode, hotWords = "", rec_msgCallback } = params;
    if (rec_msgCallback) {
      recorderObj.data.rec_msgCallback = rec_msgCallback;
    }
    //socket 初始化
    let socketParams: any = {
      socket_url,
      mode,
      hotWords,
      state_callback: recorderObj.socket_state,
      msg_callback: recorderObj.socket_msg
    };
    recorderObj.data.socketObj = new WebSocket_module(socketParams);
    //录音初始化
    await recorderObj.record_init();
  },
  //socket 连接
  socket_connect: async function () {
    console.log("正在连接asr服务器，请等待...");
    recorderObj.data.rec_text = recorderObj.data.offline_text = "";
    await recorderObj.data.socketObj.connect().catch((rej: any) => {
      console.log(rej);
    });
  },
  //socket 状态回调
  socket_state: function (state: any) {
    if (state == 0) {
      //on open
      console.log("连接成功!请点击开始");
    } else if (state == 1) {
      //recorderObj.record_stop();
    } else if (state == 2) {
      recorderObj.record_stop({ logTxt: `关闭录音 ---> socket 状态2, ${Date()}` });
      console.log("连接失败,请检查asr地址和端口。再连接");
    }
  },
  //socket 信息回调
  socket_msg: function (params: any) {
    // console.log("socket message: ", params);
    let jsonMsg = params;
    let rec_text = "" + jsonMsg["text"];
    let asrModel = jsonMsg["mode"];
    // let is_final = jsonMsg["is_final"];
    let timestamp = jsonMsg["timestamp"];
    // console.log("socket message: ", asrModel, "|", rec_text);
    if (asrModel == "2pass-offline" || asrModel == "offline") {
      // console.log(11111);
      recorderObj.data.offline_text =
        recorderObj.data.offline_text + recorderObj.data.socketObj.handleWithTimestamp(rec_text, timestamp);
      recorderObj.data.rec_text = recorderObj.data.offline_text;
    } else {
      // console.log(222222222);
      recorderObj.data.rec_text = recorderObj.data.rec_text + rec_text;
    }
    console.log("socket message 结果: ", recorderObj.data.rec_text);
    console.log("socket message: " + jsonMsg["text"], jsonMsg, "结果: ", recorderObj.data.rec_text);
    if (recorderObj.data.rec_msgCallback) {
      recorderObj.data.rec_msgCallback({ data: jsonMsg, txt: rec_text, all_txt: recorderObj.data.rec_text });
    }
  },
  //录音初始化
  record_init: async () => {
    recorderObj.data.rec = new Recorder({
      type: "pcm",
      bitRate: 16,
      sampleRate: 16000,
      onProcess: recorderObj.process
    });
  },
  // 录音打开
  record_start: async function (params?: any) {
    if (params) {
      //防止ts报错
    }
    let log_params = {
      logTxt: params.logTxt,
      socket_status: recorderObj.data.socketObj.socket_status,
      rec_status: recorderObj.data.rec_status
    };
    if (![0, 4].includes(recorderObj.data.rec_status)) {
      return;
    }
    console.log("录音打开", log_params);
    recorderObj.data.rec_status = 1;
    recorderObj.data.rec_text = recorderObj.data.offline_text = "";
    recorderObj.data.sampleBuf = new Int16Array();
    recorderObj.data.sendBuf = null;

    //socket 连接
    if (recorderObj.data.socketObj.socket_status != 0) {
      await recorderObj.socket_connect();
    }

    let recStart = async () => {
      return new Promise(function (resolve) {
        //socket 连接成功
        if (recorderObj.data.socketObj.socket_status == 0) {
          recorderObj.data.rec.open(function () {
            //发送 socket消息开始
            recorderObj.data.socketObj.send_start({});
            // 录音开始
            recorderObj.data.rec.start();

            resolve(1);
          });
        }
      });
    };

    await recStart();

    recorderObj.data.rec_status = 2;
    console.log("录音打开  成功");
  },
  // 录音关闭
  record_stop: async function (params?: any) {
    if (params) {
      //防止ts报错
    }
    let log_params = {
      logTxt: params.logTxt,
      socket_status: recorderObj.data.socketObj.socket_status,
      rec_status: recorderObj.data.rec_status
    };
    if (![2].includes(recorderObj.data.rec_status)) {
      return;
    }
    console.log("录音关闭", log_params);
    recorderObj.data.rec_status = 3;
    //判定是否还有音频数据
    // console.log("判定是否还有音频数据", recorderObj.data.sampleBuf.length);
    if (recorderObj.data.sampleBuf.length > 0) {
      recorderObj.data.socketObj.send(recorderObj.data.sampleBuf);
    }
    //发送 socket 消息结束
    await recorderObj.data.socketObj.send_end({});

    recorderObj.data.rec_text = recorderObj.data.offline_text = "";
    recorderObj.data.sampleBuf = new Int16Array();
    recorderObj.data.sendBuf = null;

    //socket 关闭
    // recorderObj.data.socketObj.close();

    //录音关闭
    let recStop = async () => {
      return new Promise(function (resolve, reject) {
        //录音关闭
        recorderObj.data.rec.stop(
          function (blob, duration?) {
            console.log(blob, duration);
            resolve(1);
          },
          function (errMsg) {
            console.log("errMsg: " + errMsg);
            reject(errMsg);
          }
        );
      });
    };

    await recStop();

    recorderObj.data.rec_status = 4;
    console.log("录音关闭  成功");
  },
  //录音中
  process: function (buffer: any, powerLevel: any, bufferDuration: any, bufferSampleRate: any, newBufferIdx: any, asyncEnd: any) {
    // console.log("process 录音中", recorderObj.data.rec_status);
    if (powerLevel || bufferDuration || newBufferIdx || asyncEnd) {
      //为了防止ts报错
    }
    if ([2].includes(recorderObj.data.rec_status)) {
      let data_48k = buffer[buffer.length - 1];
      let array_48k = new Array(data_48k);
      // console.log(Recorder.SampleData);
      let data_16k = Recorder.SampleData(array_48k, bufferSampleRate, 16000).data;

      recorderObj.data.sampleBuf = Int16Array.from([...recorderObj.data.sampleBuf, ...data_16k]);
      // console.log(data_16k, recorderObj.data.sampleBuf);
      let chunk_size: any = 960; // for asr chunk_size [5, 10, 5]
      // console.log(bufferDuration / 1000 + "s");
      while (recorderObj.data.sampleBuf.length >= chunk_size) {
        recorderObj.data.sendBuf = recorderObj.data.sampleBuf.slice(0, chunk_size);
        recorderObj.data.sampleBuf = recorderObj.data.sampleBuf.slice(chunk_size, recorderObj.data.sampleBuf.length);
        // console.log("----sendBuf----", recorderObj.data.sendBuf);
        recorderObj.data.socketObj.send(recorderObj.data.sendBuf);
      }
    }
  }
};

export default recorderObj;
