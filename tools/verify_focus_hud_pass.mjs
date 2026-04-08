import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/focus-hud-pass");
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
  await page.waitForTimeout(700);
  await waitForScene(page, "main-menu");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await waitForScene(page, "main-menu");

  const saveDeleteState = await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeSession.saveToDisk(0);
    const menu = window.__loeGame.scene.keys["main-menu"];
    menu.saveSlotsOverlay.show("load");
    menu.saveSlotsOverlay.promptDelete(0);
    const promptVisible = menu.saveSlotsOverlay.confirmPanel.visible;
    const promptText = menu.saveSlotsOverlay.confirmBody.text;
    menu.saveSlotsOverlay.confirmDelete();

    return {
      promptVisible,
      promptText,
      slotAfterDelete: window.__loeSession.getSaveSlots()[0],
      overlayStatus: menu.saveSlotsOverlay.statusText.text,
    };
  });
  await page.screenshot({
    path: path.join(outputDir, "save-delete.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeSession.acceptMission("outpost-breach");
    window.__loeSession.setSelectedMission("outpost-breach");
    window.__loeGame.scene.start("hub");
  });
  await waitForScene(page, "hub");
  await page.waitForTimeout(250);

  await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.refreshMissionState();
    hub.deployAcceptedMission();
  });
  await waitForScene(page, "mission");
  await page.waitForTimeout(400);

  const missionState = await page.evaluate(async () => {
    const mission = window.__loeGame.scene.keys.mission;
    const firstName = mission.companions[0]?.hud?.nameText?.y ?? null;
    const firstHp = mission.companions[0]?.hud?.hpValueText?.y ?? null;
    const firstShield = mission.companions[0]?.hud?.shieldValueText?.y ?? null;
    const firstEffects = mission.companions[0]?.hud?.effectText?.y ?? null;

    const playerX = mission.player.x;
    const playerY = mission.player.y;
    mission.clearEnemies();
    mission.spawnEnemy("rusher", playerX + 240, playerY + 10);
    mission.spawnEnemy("shooter", playerX + 84, playerY - 6);
    mission.cycleTargetLock();
    const nearestTarget = mission.selectedTarget
      ? {
          kind: mission.selectedTarget.kind,
          distance: Math.round(
            Math.hypot(mission.selectedTarget.sprite.x - playerX, mission.selectedTarget.sprite.y - playerY),
          ),
        }
      : null;

    mission.openPauseMenu();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const pause = window.__loeGame.scene.keys.pause;
    await pause.toggleFullscreen();
    const fullscreenActive = Boolean(document.fullscreenElement);
    pause.resumeGame();
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      targetKinds: mission.enemies.map((enemy) => enemy.kind),
      nearestTarget,
      fullscreenActive,
      pointerLocked: document.pointerLockElement === window.__loeGame.canvas,
      playerHud: {
        shieldY: mission.shieldValueText.y,
        effectsY: mission.playerEffectText.y,
      },
      companionHud: {
        firstName,
        firstHp,
        firstShield,
        firstEffects,
        secondName: mission.companions[1]?.hud?.nameText?.y ?? null,
      },
      tracker: mission.progressDots.map((dot, index) => ({
        index,
        fillColor: dot.fillColor,
        stageType: mission.mission.stages[index].type,
      })),
    };
  });

  await page.screenshot({
    path: path.join(outputDir, "mission-hud.png"),
    fullPage: true,
  });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify(
      {
        saveDeleteState,
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
