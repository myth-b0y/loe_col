import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/refresh-tactics-pass");
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

  const missionRefreshState = await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeSession.completeMission("ember-watch", { credits: 1, xp: 1, item: "A", itemId: undefined });
    window.__loeSession.completeMission("outpost-breach", { credits: 1, xp: 1, item: "B", itemId: undefined });
    window.__loeSession.completeMission("nightglass-abyss", { credits: 1, xp: 1, item: "C", itemId: undefined });
    window.__loeGame.scene.start("hub");
    const hub = window.__loeGame.scene.keys.hub;
    hub.missionBoardOverlay.show();
    const before = {
      availableCount: hub.missionBoardOverlay.getAvailableContracts().length,
      refreshVisible: hub.missionBoardOverlay.refreshButton.container.visible,
      statusText: hub.missionBoardOverlay.statusText.text,
    };
    window.__loeSession.refreshMissionBoard();
    hub.missionBoardOverlay.refresh();
    const after = {
      availableCount: hub.missionBoardOverlay.getAvailableContracts().length,
      firstDetail: hub.missionBoardOverlay.detailTitle.text,
    };

    return { before, after };
  });

  await waitForScene(page, "hub");
  await page.waitForTimeout(250);

  await page.evaluate(() => {
    window.__loeSession.acceptMission("nightglass-abyss");
    window.__loeSession.setSelectedMission("nightglass-abyss");
    const hub = window.__loeGame.scene.keys.hub;
    hub.refreshMissionState();
    hub.deployAcceptedMission();
  });
  await waitForScene(page, "mission");
  await page.waitForTimeout(250);

  const missionState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;

    mission.clearEnemies();
    mission.touchMode = true;
    mission.aimVector.set(-1, 0);
    mission.spawnEnemy("rusher", mission.player.x + 220, mission.player.y + 12);
    const formationDirection = mission.getFormationPressureDirection();
    mission.updateCompanions(0.18);

    mission.clearEnemies();
    mission.spawnEnemy("hexer", mission.player.x + 260, mission.player.y - 20);
    const hexer = mission.enemies.find((enemy) => enemy.kind === "hexer");
    hexer.attackCooldown = 0;
    mission.updateEnemies(0.12);
    const hexBullet = mission.bullets.find((bullet) => bullet.debuffKind === "hex");

    mission.clearBullets();
    mission.clearEnemies();
    mission.loadStage(0);
    const firstCover = mission.coverSpots[0];
    if (firstCover) {
      mission.spawnBullet(
        firstCover.bounds.left - 26,
        firstCover.bounds.centerY,
        mission.aimVector.clone().set(1, 0),
        260,
        8,
        6,
        "enemy",
        0xffffff,
      );
      mission.updateBullets(0.25);
    }

    return {
      formationDirection,
      baseAim: { x: mission.aimVector.x, y: mission.aimVector.y },
      hexerMove: hexer?.lastMoveLabel ?? null,
      hexBulletCreated: Boolean(hexBullet),
      coverCount: mission.coverSpots.length,
      bulletsAfterCover: mission.bullets.length,
      firstHallGroups: mission.hallwayZones[0]?.data?.enemies ?? [],
      titleText: window.document.title,
    };
  });
  await page.screenshot({
    path: path.join(outputDir, "refresh-tactics-pass.png"),
    fullPage: true,
  });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify(
      {
        missionRefreshState,
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
