import type { ZnawcaDesktopApi } from "../preload/contracts";

declare global {
  interface Window {
    znawca?: ZnawcaDesktopApi;
  }
}

export {};
