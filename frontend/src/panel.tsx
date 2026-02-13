import React from "react";
import ReactDOM from "react-dom/client";
import { VisualizationPanel } from "./components/VisualizationPanel";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("panel-root")!).render(
  <React.StrictMode>
    <VisualizationPanel />
  </React.StrictMode>
);