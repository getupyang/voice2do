import crypto from "crypto";
import WebSocket from "ws";
import { hasMeaningfulTranscription, normalizeTranscription } from "./transcription";

const APPID = process.env.IFLYTEK_APPID || "";
const API_KEY = process.env.IFLYTEK_API_KEY || "";
const API_SECRET = process.env.IFLYTEK_API_SECRET || "";

const HOST = "iat.xf-yun.com";
const PATH = "/v1";
const BASE_URL = `wss://${HOST}${PATH}`;

// 每帧发送的音频大小（字节）
const FRAME_SIZE = 1280;

function describeIflytekError(code: number, message: string | undefined): string {
  if (code === 11201) {
    return "讯飞语音识别额度不足或日流控超限，请检查讯飞控制台余额、套餐额度和应用服务授权";
  }
  if (code === 11200 || code === 10005) {
    return "讯飞应用未授权或授权已到期，请检查 APPID 是否开通当前语音识别服务";
  }
  if (code === 11202 || code === 11203) {
    return "讯飞语音识别请求过于频繁，请稍后重试";
  }
  return `讯飞 API 错误: code=${code}, message=${message || "未知错误"}`;
}

/**
 * 生成讯飞鉴权 URL
 */
function buildAuthUrl(): string {
  const date = new Date().toUTCString();

  const signatureOrigin = `host: ${HOST}\ndate: ${date}\nGET ${PATH} HTTP/1.1`;
  const signature = crypto
    .createHmac("sha256", API_SECRET)
    .update(signatureOrigin)
    .digest("base64");

  const authorizationOrigin = `api_key="${API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");

  const finalUrl = `${BASE_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(HOST)}`;
  console.log("iFlytek auth - APPID:", APPID, "API_KEY:", API_KEY.substring(0, 6) + "...", "API_SECRET:", API_SECRET.substring(0, 6) + "...");
  return finalUrl;
}

interface IflytekWord {
  w: string;
}

interface IflytekCw {
  cw: IflytekWord[];
}

interface IflytekResult {
  pgs?: string;
  rg?: number[];
  sn: number;
  ws: IflytekCw[];
}

/**
 * 使用讯飞中英识别大模型转写 PCM 音频
 * @param pcmBuffer PCM 格式音频 (16kHz, 16bit, 单声道)
 * @returns 转写文本
 */
export async function transcribeWithIflytek(
  pcmBuffer: Buffer
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = buildAuthUrl();
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("讯飞转写超时"));
    }, 60000);

    // 用于动态修正的结果存储
    const resultMap = new Map<number, string>();

    ws.on("open", () => {
      sendAudioFrames(ws, pcmBuffer);
    });

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const response = JSON.parse(data.toString());
        const code = response.header?.code;
        if (code !== 0) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(describeIflytekError(code, response.header?.message)));
          return;
        }

        const result: IflytekResult | undefined =
          response.payload?.result?.text &&
          JSON.parse(
            Buffer.from(response.payload.result.text, "base64").toString()
          );

        if (result) {
          const text = result.ws.map((w) => w.cw.map((c) => c.w).join("")).join("");

          if (result.pgs === "rpl" && result.rg) {
            // 动态修正：替换指定范围
            for (let i = result.rg[0]; i <= result.rg[1]; i++) {
              resultMap.delete(i);
            }
          }
          resultMap.set(result.sn, text);
        }

        // 检查是否结束
        if (response.header?.status === 2) {
          clearTimeout(timeout);
          ws.close();
          // 按 sn 排序拼接结果
          const sortedKeys = Array.from(resultMap.keys()).sort((a, b) => a - b);
          const finalText = normalizeTranscription(sortedKeys.map((k) => resultMap.get(k)).join(""));
          if (!hasMeaningfulTranscription(finalText)) {
            reject(new Error("讯飞未识别到有效语音文本"));
            return;
          }
          resolve(finalText);
        }
      } catch (e) {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`解析讯飞响应失败: ${e instanceof Error ? e.message : "未知错误"}`));
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      const errDetail = err ? `${err.message || err.toString()} | ${JSON.stringify(err)}` : "unknown";
      reject(new Error(`讯飞 WebSocket 错误: ${errDetail}`));
    });

    ws.on("close", (code, reason) => {
      clearTimeout(timeout);
      // 如果非正常关闭且还没 resolve/reject
      if (code !== 1000 && resultMap.size === 0) {
        reject(new Error(`讯飞 WebSocket 关闭: code=${code}, reason=${reason?.toString()}`));
      }
    });
  });
}

/**
 * 分帧发送音频数据
 */
function sendAudioFrames(ws: WebSocket, pcmBuffer: Buffer): void {
  let offset = 0;
  let seq = 1;
  let status = 0; // 0=首帧

  const sendNext = () => {
    if (ws.readyState !== WebSocket.OPEN) return;

    const end = Math.min(offset + FRAME_SIZE, pcmBuffer.length);
    const chunk = pcmBuffer.subarray(offset, end);
    const isLast = end >= pcmBuffer.length;

    if (isLast) {
      status = 2; // 尾帧
    } else if (offset > 0) {
      status = 1; // 中间帧
    }

    const frame: Record<string, unknown> = {
      header: {
        app_id: APPID,
        status: status,
      },
      payload: {
        audio: {
          encoding: "raw",
          sample_rate: 16000,
          channels: 1,
          bit_depth: 16,
          seq: seq,
          status: status,
          audio: chunk.toString("base64"),
        },
      },
    };

    // 首帧带 parameter
    if (offset === 0) {
      frame.parameter = {
        iat: {
          domain: "slm",
          language: "zh_cn",
          accent: "mandarin",
          eos: 6000,
          dwa: "wpgs",
          result: {
            encoding: "utf8",
            compress: "raw",
            format: "json",
          },
        },
      };
    }

    ws.send(JSON.stringify(frame));

    offset = end;
    seq++;

    if (!isLast) {
      // 每 40ms 发送一帧（模拟实时流）
      setTimeout(sendNext, 40);
    }
  };

  sendNext();
}
