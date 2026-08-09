import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import AppErrorBoundary from "./AppErrorBoundary";
import { initializeNativeShell } from "./native";
import { PwaChrome } from "./pwa";
import "./index.css";
import "@xyflow/react/dist/style.css";

initializeNativeShell();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <PwaChrome />
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </HashRouter>
  </React.StrictMode>,
);
