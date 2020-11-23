export type VideoStreamEvents = {
  camdata: (data: any) => void;
  exitWithError: (message: string) => void;
};

export type Mpeg1MuxerEvents = {
  mpeg1data: (data: any) => void;
  ffmpegStderr: (data: any) => void;
  exitWithError: (message: string) => void;
};

export type Mpeg1MuxerOptions = {
  ffmpegOptions: any;
  ffmpegPath: string;
  streamUrl: string;
};
export type VideoStreamOptions = {
  name: string;
  streamUrl: string;
  width: number;
  height: number;
  webSocketPort: number;
  ffmpegOptions: any;
  ffmpegPath: string;
};
