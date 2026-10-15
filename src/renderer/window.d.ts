import type { ZnawcaDesktopApi } from "../contracts/desktop-api";

declare global {
  interface Window {
    znawca?: ZnawcaDesktopApi;
  }
}

export {};
