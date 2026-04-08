import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/mission-inventory-pass");
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

  await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeSession.acceptMission("ember-watch");
    window.__loeSession.setSelectedMission("ember-watch");
    window.__loeGame.scene.start("mission", { missionId: "ember-watch" });
  });
  await waitForScene(page, "mission");
  await page.waitForTimeout(250);

  const beforeInventory = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    return {
      inventoryVisible: mission.inventoryOverlay?.isVisible?.() ?? false,
      inventoryButtonLabel: mission.inventoryButton?.label.text ?? null,
    };
  });

  await page.keyboard.press("i");
  await page.waitForTimeout(150);

  const inventoryState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    const overlay = mission.inventoryOverlay;
    return {
      visible: overlay?.isVisible?.() ?? false,
      title: overlay?.title?.text ?? null,
      subtitle: overlay?.subtitle?.text ?? null,
      allowEquip: overlay?.currentSnapshot?.allowEquip ?? null,
      inventoryVisibleInDebug: mission.getDebugSnapshot().inventoryVisible,
    };
  });

  await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.inventoryOverlay?.show?.();
    mission.updateHudState();
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outputDir, "mission-inventory.png"), fullPage: true });

  await page.keyboard.press("i");
  await page.waitForTimeout(100);

  const lootButtonState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.clearEnemies();
    mission.clearBullets();
    mission.worldPickups = [];
    mission.missionItemsEarned = [];
    mission.touchMode = true;

    mission.spawnBossLootDrops(mission.player.x + 72, mission.player.y + 8);
    const pickup = mission.worldPickups.find((entry) => entry.kind === "item");
    if (!pickup) {
      return null;
    }

    mission.player.x = pickup.baseX;
    mission.player.y = pickup.baseY;
    mission.updateHudState();

    const before = {
      attackLabel: mission.attackButton?.label.text ?? null,
      interactVisible: mission.interactButton?.container.visible ?? null,
      worldPickups: mission.worldPickups.length,
      missionItems: mission.missionItemsEarned.length,
    };

    mission.handleAttackButtonPress({ id: 991 });
    mission.updateHudState();

    return {
      before,
      after: {
        attackLabel: mission.attackButton?.label.text ?? null,
        worldPickups: mission.worldPickups.length,
        missionItems: mission.missionItemsEarned.length,
      },
      lootNames: mission.missionItemsEarned.map((item) => item.name),
    };
  });

  await page.keyboard.press("i");
  await page.waitForTimeout(150);

  const missionLootInventoryState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    const overlay = mission.inventoryOverlay;
    return {
      visible: overlay?.isVisible?.() ?? false,
      subtitle: overlay?.subtitle?.text ?? null,
      currencyLines: overlay?.currencyText?.text ?? null,
      cargoLabels: overlay?.cargoCells?.map((cell) => cell.itemLabel.text).filter(Boolean) ?? [],
    };
  });

  await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.inventoryOverlay?.show?.();
    mission.updateHudState();
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outputDir, "mission-loot-overlay.png"), fullPage: true });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify({ beforeInventory, inventoryState, lootButtonState, missionLootInventoryState }, null, 2),
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
