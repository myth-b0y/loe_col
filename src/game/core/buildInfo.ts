import packageJson from "../../../package.json";

const PACKAGE_VERSION = packageJson.version;

export const GAME_CODE = "loe_col";
export const GAME_VERSION = `v${PACKAGE_VERSION}`;
export const GAME_BUILD = `pl_tcol_${GAME_VERSION}`;
export const GAME_MILESTONE = "Mission activity contextual cleanup pass";
export const GAME_SERIES = "Pocket Legends:";
export const GAME_TITLE = "The Circle of Light";
export const GAME_IP = "LoE";
export const GAME_WINDOW_TITLE = `${GAME_SERIES} ${GAME_TITLE} ${GAME_BUILD}`;
