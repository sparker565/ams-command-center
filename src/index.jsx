import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppBuild03 from "./AppBuild03";
import "./styles.css";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <AppBuild03 />
  </StrictMode>
);
