import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/loot-effects-pass");
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
  await page.goto("http://127.0.0.1:4173/?renderer=canvas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await waitForScene(page, "main-menu");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await waitForScene(page, "main-menu");

  const titleState = await page.evaluate(() => {
    const scene = window.__loeGame.scene.keys["main-menu"];
    const findText = (label) => scene.children.list.find((entry) => entry.text === label);
    return {
      ipY: findText("LoE")?.y ?? null,
      seriesY: findText("Pocket Legends:")?.y ?? null,
      titleY: findText("The Circle of Light")?.y ?? null,
      taglineY: findText("Age of Legends tactical action RPG prototype")?.y ?? null,
      buildLabel: scene.getDebugSnapshot().version,
    };
  });

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
    mission.worldPickups = [];
    mission.missionCreditsEarned = 0;
    mission.missionMaterialsEarned = { alloy: 0, shardDust: 0, filament: 0 };
    mission.missionItemsEarned = [];

    mission.recordEnemyDrop("hexer", mission.player.x + 120, mission.player.y);
    const beforePickup = mission.getDebugSnapshot();

    const creditPickup = mission.worldPickups.find((pickup) => pickup.kind === "credits");
    if (creditPickup) {
      mission.player.x = creditPickup.baseX;
      mission.player.y = creditPickup.baseY;
      mission.updateWorldPickups(0.16);
    }

    const interactPickup = mission.worldPickups.find((pickup) => pickup.kind !== "credits");
    if (interactPickup) {
      mission.player.x = interactPickup.baseX;
      mission.player.y = interactPickup.baseY;
      mission.tryMissionInteract();
    }

    mission.touchMode = true;
    mission.updateHudState();
    const touchInteractState = {
      visible: Boolean(mission.interactButton?.container.visible),
      label: mission.interactButton?.label.text ?? null,
    };
    mission.touchMode = false;
    mission.updateHudState();

    mission.spawnBossLootDrops(mission.player.x + 96, mission.player.y + 12);
    const bossDropState = mission.getDebugSnapshot();

    const lootItem = mission.worldPickups.find((pickup) => pickup.kind === "item");
    if (lootItem) {
      mission.player.x = lootItem.baseX;
      mission.player.y = lootItem.baseY;
      mission.tryMissionInteract();
    }

    return {
      beforePickup,
      touchInteractState,
      bossDropState,
      afterInteract: mission.getDebugSnapshot(),
      sfx: window.__loeSfx.getDebugState(),
    };
  });

  await page.screenshot({ path: path.join(outputDir, "mission-pickups.png"), fullPage: true });
  await page.evaluate(() => {
    window.__loeGame.scene.keys.mission.finishMission();
  });

  await waitForScene(page, "mission-result");
  await page.waitForTimeout(250);
  const resultState = await page.evaluate(() => window.__loeGame.scene.keys["mission-result"].getDebugSnapshot());
  await page.screenshot({ path: path.join(outputDir, "mission-result.png"), fullPage: true });

  fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify({ titleState, missionState, resultState }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
