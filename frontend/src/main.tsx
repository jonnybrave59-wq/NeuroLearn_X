import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { initializeNativeShell } from "./native";
import { PwaChrome } from "./pwa";
import "./index.css";
import "@xyflow/react/dist/style.css";

initializeNativeShell();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <PwaChrome />
      <App />
    </HashRouter>
  </React.StrictMode>,
);
