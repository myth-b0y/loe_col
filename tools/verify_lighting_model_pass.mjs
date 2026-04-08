import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/lighting-model-pass");
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

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await waitForScene(page, "main-menu");

  await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeSession.acceptMission("ember-watch");
    window.__loeSession.setSelectedMission("ember-watch");
    window.__loeGame.scene.start("mission", { missionId: "ember-watch" });
  });
  await waitForScene(page, "mission");
  await page.waitForTimeout(250);

  const missionState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.clearEnemies();
    mission.clearBullets();
    mission.spawnEnemy("rusher", mission.player.x + 180, mission.player.y);
    mission.spawnBullet(mission.player.x, mission.player.y, mission.aimVector.clone().normalize(), 0, 0, 6, "player", 0x7ee1ff);
    mission.spawnCombatLight(mission.player.x + 26, mission.player.y, 0x7fe3ff, 0.5, 180);
    mission.spawnShieldSpark(mission.player.x + 44, mission.player.y + 8, 0x6cdcff, 0.45);
    mission.updateLightingState();
    return {
      playerLightVisible: mission.playerLight?.visible ?? null,
      companionLightsVisible: mission.companions.map((companion) => companion.light.visible),
      enemyLightsVisible: mission.enemies.map((enemy) => enemy.light.visible),
      transientShadowLights: mission.transientShadowLights?.size ?? null,
      shadowSourceCount: mission.missionShadowSources.length,
      stageLightCount: mission.stageLights.length,
      pickupCount: mission.worldPickups.length,
    };
  });
  await page.screenshot({ path: path.join(outputDir, "mission.png"), fullPage: true });

  await page.evaluate(() => {
    window.__loeGame.scene.stop("mission");
    window.__loeGame.scene.start("hub");
  });
  await waitForScene(page, "hub");
  await page.waitForTimeout(250);

  const hubState = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.updateHubLighting();
    return {
      playerLightVisible: hub.playerLight?.visible ?? null,
      crewLightsVisible: hub.crew.map((companion) => companion.light.visible),
      ambientLights: hub.ambientLights.length,
      stationLightCount: hub.stations.length,
      shadowSourceCount: hub.hubShadowSources.length,
    };
  });
  await page.screenshot({ path: path.join(outputDir, "hub.png"), fullPage: true });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify({ missionState, hubState }, null, 2),
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
