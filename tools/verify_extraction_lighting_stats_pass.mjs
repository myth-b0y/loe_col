import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/extraction-lighting-stats-pass");
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
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://127.0.0.1:4173/?renderer=canvas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await waitForScene(page, "main-menu");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await waitForScene(page, "main-menu");

  const firstMission = await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeSession.acceptMission("ember-watch");
    window.__loeSession.setSelectedMission("ember-watch");
    window.__loeGame.scene.start("mission", { missionId: "ember-watch" });
    return {
      credits: window.__loeSession.saveData.profile.credits,
      cargoCount: window.__loeSession.saveData.loadout.cargo.filter(Boolean).length,
      materials: { ...window.__loeSession.saveData.loadout.crafting },
    };
  });

  await waitForScene(page, "mission");
  await page.waitForTimeout(250);

  const pickupAndInventoryState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.clearEnemies();
    mission.clearBullets();
    mission.worldPickups = [];
    mission.missionCreditsEarned = 0;
    mission.missionMaterialsEarned = { alloy: 0, shardDust: 0, filament: 0 };
    mission.missionItemsEarned = [];

    mission.spawnBossLootDrops(mission.player.x + 88, mission.player.y + 4);
    const pickup = mission.worldPickups.find((entry) => entry.kind === "item");
    if (pickup) {
      mission.player.x = pickup.baseX;
      mission.player.y = pickup.baseY;
      mission.tryMissionInteract();
    }
    mission.inventoryOverlay?.show?.();
    mission.updateHudState();

    return {
      pickupBannerVisible: mission.pickupBannerText?.visible ?? false,
      pickupBannerText: mission.pickupBannerText?.text ?? null,
      missionItemsEarned: mission.missionItemsEarned.map((item) => item.name),
      inventoryStats: mission.inventoryOverlay?.statsText?.text ?? null,
      currencyLines: mission.inventoryOverlay?.currencyText?.text ?? null,
    };
  });

  await page.screenshot({ path: path.join(outputDir, "mission-lighting-and-banner.png"), fullPage: true });

  const extractionState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.extractMissionLootToShip();
    window.__loeGame.scene.stop("mission");
    window.__loeGame.scene.start("hub");
    return true;
  });

  await waitForScene(page, "hub");
  await page.waitForTimeout(250);

  const afterExtraction = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    return {
      extractionState: Boolean(hub),
      credits: window.__loeSession.saveData.profile.credits,
      cargoCount: window.__loeSession.saveData.loadout.cargo.filter(Boolean).length,
      materials: { ...window.__loeSession.saveData.loadout.crafting },
      rewardText: hub.rewardText?.text ?? null,
      rewardVisible: hub.rewardText?.visible ?? false,
    };
  });

  await page.screenshot({ path: path.join(outputDir, "hub-after-extraction.png"), fullPage: true });

  const secondMissionStart = await page.evaluate(() => {
    window.__loeSession.acceptMission("outpost-breach");
    window.__loeSession.setSelectedMission("outpost-breach");
    window.__loeGame.scene.start("mission", { missionId: "outpost-breach" });
    return {
      cargoCount: window.__loeSession.saveData.loadout.cargo.filter(Boolean).length,
    };
  });

  await waitForScene(page, "mission");
  await page.waitForTimeout(250);

  const deathLossState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.clearEnemies();
    mission.clearBullets();
    mission.worldPickups = [];
    mission.missionCreditsEarned = 0;
    mission.missionMaterialsEarned = { alloy: 0, shardDust: 0, filament: 0 };
    mission.missionItemsEarned = [];

    mission.spawnBossLootDrops(mission.player.x + 88, mission.player.y + 4);
    const pickup = mission.worldPickups.find((entry) => entry.kind === "item");
    if (pickup) {
      mission.player.x = pickup.baseX;
      mission.player.y = pickup.baseY;
      mission.tryMissionInteract();
    }

    const missionLootBeforeDeath = {
      pickedItems: mission.missionItemsEarned.map((item) => item.name),
      pickupBannerText: mission.pickupBannerText?.text ?? null,
    };

    mission.scene.start("game-over", { missionId: "outpost-breach" });
    return missionLootBeforeDeath;
  });

  await waitForScene(page, "game-over");
  await page.waitForTimeout(150);

  await page.evaluate(() => {
    window.__loeGame.scene.keys["game-over"].returnToShip();
  });

  await waitForScene(page, "hub");
  await page.waitForTimeout(250);

  const afterDeathReturn = await page.evaluate(() => ({
    credits: window.__loeSession.saveData.profile.credits,
    cargoCount: window.__loeSession.saveData.loadout.cargo.filter(Boolean).length,
    materials: { ...window.__loeSession.saveData.loadout.crafting },
  }));

  await page.screenshot({ path: path.join(outputDir, "hub-after-death-return.png"), fullPage: true });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify(
      {
        firstMission,
        pickupAndInventoryState,
        extractionState,
        afterExtraction,
        secondMissionStart,
        deathLossState,
        afterDeathReturn,
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
