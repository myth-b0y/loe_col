import "./style.css";

import { createGame } from "./game/createGame";
import { GAME_WINDOW_TITLE } from "./game/core/buildInfo";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app mount node.");
}

document.title = GAME_WINDOW_TITLE;

createGame("app");

