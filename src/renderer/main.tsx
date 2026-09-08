import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./app-shell/AppShell";
import "./app-shell/app-shell.css";

const root = document.getElementById("root");
if (!root) throw new Error("Znawca renderer root was not found.");

createRoot(root).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
