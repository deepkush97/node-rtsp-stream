import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { EventEmitter } from "tsee";
import { Mpeg1MuxerEvents, Mpeg1MuxerOptions } from "./types";

export class Mpeg1Muxer extends EventEmitter<Mpeg1MuxerEvents> {
  private _ffmpegOptions: any;
  private _streamUrl: string;
  private _additionalFlags: string[];
  private _ffmpegPath: string;
  private _inputStreamStarted: boolean;

  private _childProcess?: ChildProcessWithoutNullStreams;
  private _spawnOptions: string[];
  constructor({ ffmpegOptions, streamUrl, ffmpegPath }: Mpeg1MuxerOptions) {
    super();
    this._streamUrl = streamUrl;
    this._ffmpegOptions = ffmpegOptions;
    this._additionalFlags = [];
    this._ffmpegPath = ffmpegPath;
    this._inputStreamStarted = false;
    let key = "";
    if (this._ffmpegOptions) {
      for (key in this._ffmpegOptions) {
        this._additionalFlags.push(key);
        if (String(this._ffmpegOptions[key]) !== "") {
          this._additionalFlags.push(String(this._ffmpegOptions[key]));
        }
      }
    }
    this._spawnOptions = [
      "-rtsp_transport",
      "tcp",
      "-i",
      this._streamUrl,
      "-f",
      "mpegts",
      "-codec:v",
      "mpeg1video",
      // additional ffmpeg options go here
      ...this._additionalFlags,
      "-",
    ];
  }

  public start = () => {
    this._childProcess = spawn(this._ffmpegPath, this._spawnOptions, {
      detached: false,
    });
    this._inputStreamStarted = true;
    this._childProcess.stdout.on("data", (data: any) => {
      this.emit("mpeg1data", data);
    });
    this._childProcess.stderr.on("data", (data: any) => {
      this.emit("ffmpegStderr", data);
    });
    this._childProcess.on("exit", (code, signal) => {
      if (code === 1) {
        console.error(`RTSP stream exited ${signal} with error`);
        this.emit("exitWithError", `RTSP stream exited ${signal} with error`);
      }
    });
  };

  public stop() {
    try {
      if (this._inputStreamStarted && this._childProcess) {
        this.removeAllListeners();
        this._childProcess.removeAllListeners();
        this._childProcess.kill("SIGKILL");
      }
    } catch (error) {
      console.error(error);
    }
  }
}
