import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/cleanup-fx-pass");
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
  await page.waitForTimeout(300);

  const missionState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.clearEnemies();
    mission.clearBullets();
    mission.clearStageObjects();
    mission.player.x = mission.playArea.centerX - 160;
    mission.player.y = mission.playArea.centerY + 18;
    mission.spawnCreditsPickup(mission.player.x + 88, mission.player.y - 28, 14);
    mission.spawnItemPickup(mission.player.x + 132, mission.player.y + 14, {
      kind: "junk",
      templateId: "alloy-scrap",
      instanceId: "verify-alloy-1",
      name: "Alloy Scrap",
      shortLabel: "Alloy Scrap",
      description: "Verification salvage",
      rarity: "Common",
      color: 0x63d77b,
      stackCount: 3,
      maxStack: 25,
    });
    mission.spawnBullet(mission.player.x, mission.player.y, mission.aimVector.clone().normalize(), 0, 0, 6, "player", 0x7ee1ff);
    mission.spawnShieldSpark(mission.player.x + 36, mission.player.y - 8, 0x6cdcff, 0.45);
    mission.spawnStatusSigil(mission.player.x + 8, mission.player.y - 40, 0x8ff7d1, "guard");
    mission.updateLightingState();
    return {
      lightingSupported: Boolean(mission.lightingRig?.supported),
      shadowSourceCount: mission.missionShadowSources.length,
      pickupCount: mission.worldPickups.length,
      transientVisualCount: mission.transientVisuals?.size ?? null,
    };
  });

  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(outputDir, "mission-lighting.png"), fullPage: true });

  await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    const pickup = mission.worldPickups.find((entry) => entry.kind === "item");
    if (pickup) {
      mission.player.x = pickup.baseX;
      mission.player.y = pickup.baseY;
      mission.tryMissionInteract();
    }
    mission.spawnBossLootDrops(mission.player.x + 124, mission.player.y - 4);
    const bossDrop = mission.worldPickups.find((entry) => entry.kind === "item" && entry.item?.kind === "gear");
    if (bossDrop) {
      mission.player.x = bossDrop.baseX;
      mission.player.y = bossDrop.baseY;
      mission.tryMissionInteract();
    }
    mission.extractMissionLootToShip();
    window.__loeGame.scene.stop("mission");
    window.__loeGame.scene.start("hub");
  });
  await waitForScene(page, "hub");
  await page.waitForTimeout(250);

  const inventoryState = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.openStation("loadout");
    const overlay = hub.inventoryOverlay;
    const targetIndex = overlay.currentSnapshot.cargo.findIndex((item) => item?.kind === "gear");
    if (targetIndex < 0) {
      return {
        targetIndex,
        actionVisible: false,
      };
    }
    overlay.onCargoCellClicked(targetIndex);
    const cell = overlay.cargoCells[targetIndex];
    return {
      targetIndex,
      cellX: cell.frame.x,
      cellY: cell.frame.y,
      actionVisible: overlay.actionMenu.visible,
      actionX: overlay.actionMenu.x,
      actionY: overlay.actionMenu.y,
      actionTitle: overlay.actionTitle.text,
      rootDepthCount: overlay.root.length ?? null,
    };
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outputDir, "inventory-popup.png"), fullPage: true });

  const rewardState = await page.evaluate(() => {
    const session = window.__loeSession;
    const cargo = session.getCargoSlots().filter(Boolean);
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const junk = cargo.find((item) => item.kind === "junk");
    const gear = cargo.find((item) => item.kind === "gear");
    const rewardItems = [
      ...(gear ? [clone(gear)] : []),
      ...(junk ? [clone(junk), clone(junk), clone(junk)] : []),
      ...cargo.slice(0, 3).map(clone),
    ];
    window.__loeGame.scene.start("mission-result", {
      missionId: "outpost-breach",
      missionTitle: "Outpost Breach",
      reward: {
        xp: 195,
        credits: 691,
        materials: { alloy: 12, shardDust: 4, filament: 8 },
        items: rewardItems,
      },
    });
    return {
      rewardItemCount: rewardItems.length,
    };
  });
  await waitForScene(page, "mission-result");
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outputDir, "mission-result.png"), fullPage: true });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify({ missionState, inventoryState, rewardState }, null, 2),
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
