import ws, { Server } from "ws";
import { IncomingMessage } from "http";
import { EventEmitter } from "tsee";
import { Mpeg1Muxer } from "./Mpeg1Muxer";
import { VideoStreamEvents, VideoStreamOptions } from "./types";
const STREAM_MAGIC_BYTES = "jsmp"; //Must be these 4 bytes

export class VideoStream extends EventEmitter<VideoStreamEvents> {
  private _name: string;
  private _streamUrl: string;
  private _width: number;
  private _height: number;
  private _webSocketPort: number;
  private _inputStreamStarted: boolean;
  private _ffmpegOptions: any;
  private _webSocketServer?: Server;
  private _mpeg1Muxer: Mpeg1Muxer;
  constructor({
    name,
    streamUrl,
    width,
    height,
    webSocketPort,
    ffmpegPath,
    ffmpegOptions,
  }: VideoStreamOptions) {
    super();
    this._name = name;
    this._streamUrl = streamUrl;
    this._width = width;
    this._height = height;
    this._webSocketPort = webSocketPort;
    this._inputStreamStarted = false;
    this._ffmpegOptions = ffmpegOptions;
    this._mpeg1Muxer = new Mpeg1Muxer({
      streamUrl: this._streamUrl,
      ffmpegPath,
      ffmpegOptions: this._ffmpegOptions,
    });
  }

  private broadcast = (data: any) => {
    if (this._webSocketServer) {
      this._webSocketServer.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(data);
        } else {
          console.log(
            "Error: Client from remoteAddress " + client.url + " not connected."
          );
        }
      });
    }
  };

  private onSocketConnection = (socket: ws, request: IncomingMessage) => {
    // Send magic bytes and video size to the newly connected socket
    // struct { char magic[4]; unsigned short width, height;}
    let streamHeader = Buffer.allocUnsafe(8);
    streamHeader.write(STREAM_MAGIC_BYTES);
    streamHeader.writeUInt16BE(this._width, 4);
    streamHeader.writeUInt16BE(this._height, 6);
    socket.send(streamHeader, {
      binary: true,
    });
    this.printLog(false);

    return socket.on("close", (code, message) => {
      this.printLog(true, code, message);
    });
  };

  private printLog = (
    onDisconnect: boolean,
    code?: number,
    message?: string
  ) => {
    if (onDisconnect) {
      console.log(
        `${this._name}: WebSocket Disconnected ( ${this._webSocketServer?.clients.size} total with code ${code}, ${message})`
      );
    } else {
      console.log(
        `${this._name}: New WebSocket Connection ( ${this._webSocketServer?.clients.size} total)`
      );
    }
  };

  public start = () => {
    this._mpeg1Muxer.start();

    this._mpeg1Muxer.on("mpeg1data", (data) => {
      return this.emit("camdata", data);
    });

    let gettingInputData = false;
    let inputData = [];
    let gettingOutputData = false;
    let outputData = [];
    this._mpeg1Muxer.on("ffmpegStderr", (data) => {
      var size;
      data = data.toString();
      if (data.indexOf("Input #") !== -1) {
        gettingInputData = true;
      }
      if (data.indexOf("Output #") !== -1) {
        gettingInputData = false;
        gettingOutputData = true;
      }
      if (data.indexOf("frame") === 0) {
        gettingOutputData = false;
      }
      if (gettingInputData) {
        inputData.push(data.toString());
        size = data.match(/\d+x\d+/);
        if (size != null) {
          size = size[0].split("x");
          if (this._width == null) {
            this._width = parseInt(size[0], 10);
          }
          if (this._height == null) {
            return (this._height = parseInt(size[1], 10));
          }
        }
      }
    });

    this._mpeg1Muxer.on("ffmpegStderr", (data: any) => {
      global.process.stderr.write(data);
    });
    this._mpeg1Muxer.on("exitWithError", (message: string) => {
      this.emit("exitWithError", message);
    });
    this._webSocketServer = new Server({ port: this._webSocketPort });
    this._webSocketServer.on("connection", this.onSocketConnection);
    this.on("camdata", (data) => {
      this.broadcast(data);
    });
  };

  public stop = () => {
    this._mpeg1Muxer.stop();

    if (this._webSocketServer) {
      this._webSocketServer.removeAllListeners();
      this._webSocketServer.close();
    }
  };
}
