import type { ElectronAPI } from '../main/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

declare module '*.png' {
  const src: string;
  export default src;
}

export {};
