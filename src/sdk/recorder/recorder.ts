import RecordRTC, { StereoAudioRecorder } from "recordrtc";

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

    bitRate: 128000, //比特率
    sampleRate: 48000, //录音时采样率,表示每秒钟采样的次数 16000 44100 48000
    desiredSampRate: 16000, //录音后的目标采样率,表示每秒钟采样的次数 16000
    bufferSize: 4096, //表示音频缓冲区的大小 语音识别建议1024 、2048
    timeSlice: 100, //表示每隔多少毫秒触发一次 ondataavailable 事件  100  ~~(4096 / 48)

    itn: false, //逆文本标准化(ITN) false true
    hotWords: '{"阿里巴巴":20,"hello world":40}', //热词

    sampleBuf: new Int16Array(), //采样数据
    sendBuf: null, //发送数据
    rec_msgCallback: null, //录音信息回调

    stream: null, //音频流
    rec: null, //录音对象
    rec_status: 0, //录音状态 0未录音 1打开中 2录音中 3停止中 4已停止
    rec_text: "", //录音文本
    offline_text: "" //for offline
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
    //录音
    await recorderObj.record_start({ logTxt: `打开录音 ---> 初始化init, ${Date()}` });
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
    console.log("socket message: " + jsonMsg["text"], jsonMsg, "结果: ", recorderObj.data.rec_text);
    if (recorderObj.data.rec_msgCallback) {
      recorderObj.data.rec_msgCallback({ data: jsonMsg, txt: rec_text, all_txt: recorderObj.data.rec_text });
    }
  },
  //录音初始化
  record_init: async () => {
    let reData: any = { status: 0, info: "", data: null };

    // 检查浏览器是否支持 mediaDevices getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      reData = { status: 0, info: "浏览器不支持 mediaDevices" };
      return reData;
    }

    try {
      // 请求获取音频流
      let mediaParams = {
        audio: {
          noiseSuppression: true, // 启用噪音抑制
          echoCancellation: true // 启用回声消除
        },
        video: false
      };
      let stream = await navigator.mediaDevices.getUserMedia(mediaParams).catch(function (err) {
        console.error("获取音频流失败：", err);
      });
      if (stream) {
        recorderObj.data.mikeOpen = 1;
        // console.log("音频访问权限获取成功:navigator.mediaDevices.getUserMedia");
        recorderObj.data.stream = stream;
        reData = { status: 1, data: stream };

        let mimeType = "audio/webm; codecs=pcm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/webm; codecs=opus";
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/webm";
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/wav";
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/mp3";
        }

        let temp_var = 1; //临时变量无意义后面可以删除
        let record_params = {
          type: "audio",
          mimeType,
          recorderType: StereoAudioRecorder,
          audioBitsPerSecond: recorderObj.data.bitRate,
          sampleRate: recorderObj.data.sampleRate,
          desiredSampRate: recorderObj.data.desiredSampRate,
          bufferSize: recorderObj.data.bufferSize,
          timeSlice: recorderObj.data.timeSlice,
          checkForInactiveTracks: true,
          numberOfAudioChannels: 1,
          disableLogs: true,
          initCallback: function () {
            console.log("录音器已准备好，可以执行其他操作");
          },
          ondataavailable: function (blob: any) {
            //这里的 blob 使用的是 desiredSampRate
            // console.log("ondataavailable", recorderObj.data.rec.getState());
            if (temp_var == 1) {
              temp_var++;
              console.log(blob);
            }
            if (blob) {
              // 将 Blob 转换为 ArrayBuffer
              recorderObj
                .blobToArrayBuffer(blob)
                .then(arrayBuffer => {
                  const int16Array_data = new Int16Array(arrayBuffer);
                  // console.log("Int16Array:", int16Array_data);
                  recorderObj.process(int16Array_data);
                })
                .catch(error => {
                  console.log(error);
                });
            }
          },
          onStateChanged: function (state) {
            console.log("onStateChanged", state);
          }
        };
        console.log(record_params);
        recorderObj.data.rec = new RecordRTC(stream, record_params);
      }
    } catch (err) {
      console.log("访问权限获取失败", err);
      reData = { status: 0, info: err };
    }

    return reData;
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

    //socket 连接成功
    if (recorderObj.data.socketObj.socket_status == 0) {
      //录音初始化
      await recorderObj.record_init();
      //发送 socket消息开始
      recorderObj.data.socketObj.send_start({});
      //录音开始
      recorderObj.data.rec.startRecording();
    }

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
      return new Promise(function (resolve) {
        recorderObj.data.rec.stopRecording((audioURL: any) => {
          const blob = recorderObj.data.rec.getBlob();
          console.log(audioURL, blob);

          // recorderObj.data.rec.getDataURL(function(dataURL) { });

          recorderObj.data.stream.getTracks().forEach(track => track.stop());
          resolve(1);
        });
      });
    };

    await recStop();

    recorderObj.data.rec_status = 4;
    console.log("录音关闭  成功");
  },
  //录音中
  process: function (params: any) {
    // console.log("process 录音中", recorderObj.data.rec_status);
    if ([2].includes(recorderObj.data.rec_status)) {
      recorderObj.data.sampleBuf = Int16Array.from([...recorderObj.data.sampleBuf, ...params]);
      let chunk_size: any = 960; // for asr chunk_size [5, 10, 5]
      // console.log(bufferDuration / 1000 + "s");
      while (recorderObj.data.sampleBuf.length >= chunk_size) {
        recorderObj.data.sendBuf = recorderObj.data.sampleBuf.slice(0, chunk_size);
        recorderObj.data.sampleBuf = recorderObj.data.sampleBuf.slice(chunk_size, recorderObj.data.sampleBuf.length);
        // console.log("----record_process----", recorderObj.data.sendBuf);
        recorderObj.data.socketObj.send(recorderObj.data.sendBuf);
      }
    }
  },
  // 将 Blob 转换为 ArrayBuffer
  //ArrayBuffer 提供了一个基本的容器，用于存储原始的二进制数据。它本身不提供对这些数据的操作，而是通过视图（如 Int16Array、Float32Array）来读取和操作。
  //ArrayBuffer 的长度在创建时确定，并且不能改变。它的大小是以字节为单位的。
  //对于 ArrayBuffer，可以创建不同的视图（例如 Uint8Array、Int16Array），这些视图允许以不同的方式解释和操作 ArrayBuffer 中的二进制数据。
  blobToArrayBuffer: function (blob: any) {
    // console.log(blob, "------");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (event: any) {
        // console.log(event, "******");
        resolve(event.target.result);
      };
      reader.onerror = function () {
        reject("将 Blob 转换为 ArrayBuffer 失败");
      };
      reader.readAsArrayBuffer(blob);
    });
  }
};

export default recorderObj;
