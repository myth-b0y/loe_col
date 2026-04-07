import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/command-layer-runtime");
fs.mkdirSync(outputDir, { recursive: true });

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(
    (expectedScene) => {
      if (typeof window.render_game_to_text !== "function") {
        return false;
      }
      try {
        const payload = JSON.parse(window.render_game_to_text());
        return payload?.activeScene === expectedScene;
      } catch {
        return false;
      }
    },
    sceneKey,
    { timeout: 10000 },
  );
}

async function getTextState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://127.0.0.1:4173/?renderer=canvas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);

  await waitForScene(page, "main-menu");

  const debugHooks = await page.evaluate(() => ({
    hasGame: Boolean(window.__loeGame),
    hasSession: Boolean(window.__loeSession),
    hasContracts: Boolean(window.__loeContracts),
  }));
  fs.writeFileSync(path.join(outputDir, "debug-hooks.json"), JSON.stringify(debugHooks, null, 2));

  const mainMenuState = await getTextState(page);

  await page.evaluate(async () => {
    window.__loeSession.startNewGame(0);
    window.__loeGame.scene.start("hub");
  });

  await waitForScene(page, "hub");
  await page.waitForTimeout(300);

  const hubInitial = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    return hub.getDebugSnapshot();
  });
  await page.screenshot({
    path: path.join(outputDir, "hub.png"),
    fullPage: true,
  });

  const missionBoardState = await page.evaluate(async () => {
    const hub = window.__loeGame.scene.keys.hub;

    hub.openStation("mission");
    const before = {
      boardVisible: hub.missionBoardOverlay?.isVisible?.() ?? false,
    };

    window.__loeSession.acceptAllMissions(window.__loeContracts.map((contract) => contract.id));
    window.__loeSession.setSelectedMission("nightglass-abyss");
    hub.refreshMissionState();
    hub.openStation("logbook");

    return {
      before,
      acceptedMissionIds: window.__loeSession.getAcceptedMissionIds(),
      selectedMissionId: window.__loeSession.getSelectedMissionId(),
      logbookVisible: hub.logbookOverlay?.isVisible?.() ?? false,
    };
  });
  await page.screenshot({
    path: path.join(outputDir, "logbook.png"),
    fullPage: true,
  });

  const inventoryState = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.openStation("loadout");
    return {
      inventoryVisible: hub.inventoryOverlay?.isVisible?.() ?? false,
      crewCount: hub.crew?.length ?? 0,
    };
  });
  await page.screenshot({
    path: path.join(outputDir, "inventory.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.openDeployOverlay();
  });

  const deployState = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    return hub.getDebugSnapshot();
  });
  await page.screenshot({
    path: path.join(outputDir, "deploy.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.deployAcceptedMission();
  });

  await waitForScene(page, "mission");
  await page.waitForTimeout(400);

  const missionState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    return {
      snapshot: mission.getDebugSnapshot(),
      title: mission.mission?.title ?? null,
      difficulty: mission.mission?.difficulty ?? null,
      stageFlows: mission.mission?.stages?.map((stage) => stage.flow) ?? [],
      stageTypes: mission.mission?.stages?.map((stage) => stage.type) ?? [],
      companionCount: mission.companions?.length ?? 0,
    };
  });

  await page.screenshot({
    path: path.join(outputDir, "mission.png"),
    fullPage: true,
  });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify(
      {
        mainMenuState,
        hubInitial,
        missionBoardState,
        inventoryState,
        deployState,
        missionState,
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
