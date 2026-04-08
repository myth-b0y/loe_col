import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/qol-role-pass");
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

  await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeGame.scene.start("hub");
  });
  await waitForScene(page, "hub");
  await page.waitForTimeout(300);

  const terminalState = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.openStation("mission");
    const initialVisible = hub.missionBoardOverlay.cards
      .filter((card) => card.frame.visible)
      .map((card) => card.contractId);

    window.__loeSession.acceptMission("ember-watch");
    window.__loeSession.setSelectedMission("ember-watch");
    window.__loeSession.startMission("ember-watch");
    window.__loeSession.completeMission("ember-watch", {
      xp: 150,
      credits: 180,
      item: "Relay Core Mk I",
      itemId: "relay-core-mk1",
    });
    hub.refreshMissionState();
    hub.missionBoardOverlay.refresh();

    return {
      initialVisible,
      afterCompleteVisible: hub.missionBoardOverlay.cards
        .filter((card) => card.frame.visible)
        .map((card) => card.contractId),
      completed: window.__loeSession.getCompletedMissionIds(),
      statusText: hub.missionBoardOverlay.statusText.text,
    };
  });
  await page.screenshot({
    path: path.join(outputDir, "mission-terminal.png"),
    fullPage: true,
  });

  const deployState = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.openDeployOverlay();
    hub.toggleDeployInfo("sera");
    const roleCounts = hub.deployRosterCards
      .map((card) => card.companion.role)
      .reduce((counts, role) => {
        counts[role] = (counts[role] ?? 0) + 1;
        return counts;
      }, {});

    return {
      infoVisible: hub.deployInfoPanel?.visible ?? false,
      infoTitle: hub.deployInfoTitle?.text ?? null,
      infoBody: hub.deployInfoBody?.text ?? null,
      roleCounts,
      emberRole: hub.deployRosterCards.find((card) => card.companionId === "ember")?.companion.role ?? null,
    };
  });
  await page.screenshot({
    path: path.join(outputDir, "deploy-info.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    window.__loeSession.acceptMission("outpost-breach");
    window.__loeSession.setSelectedMission("outpost-breach");
    window.__loeSession.setSquadAssignments([
      { companionId: "ember", slotId: "front-left" },
      { companionId: "lyra", slotId: "back-left" },
      { companionId: "orin", slotId: "back-right" },
    ]);
    hub.refreshMissionState();
    hub.deployAcceptedMission();
  });
  await waitForScene(page, "mission");
  await page.waitForTimeout(400);

  const missionState = await page.evaluate(async () => {
    const mission = window.__loeGame.scene.keys.mission;
    const lyra = mission.companions.find((companion) => companion.id === "lyra");
    const orin = mission.companions.find((companion) => companion.id === "orin");
    const ember = mission.companions.find((companion) => companion.id === "ember");

    mission.playerHp = 62;
    mission.playerShield = 18;
    lyra.cooldown = 0;
    mission.useTideMedicAbility(lyra);
    const afterLyra = {
      hp: mission.playerHp,
      shield: mission.playerShield,
      cooldown: lyra.cooldown,
    };

    orin.cooldown = 0;
    mission.playerFocusBuff = 0;
    mission.useAstralWeaverAbility(orin);
    const afterOrin = {
      playerFocusBuff: mission.playerFocusBuff,
      cooldown: orin.cooldown,
    };

    const playerX = mission.player.x;
    const playerY = mission.player.y;
    mission.spawnEnemy("rusher", playerX + 4, playerY);
    mission.spawnEnemy("shooter", playerX + 6, playerY + 2);
    if (ember) {
      ember.sprite.x = playerX + 3;
      ember.sprite.y = playerY + 1;
      ember.cooldown = 0;
    }

    const beforeSeparation = {
      emberToPlayer: ember ? Math.hypot(ember.sprite.x - mission.player.x, ember.sprite.y - mission.player.y) : null,
      enemyDistances: mission.enemies.slice(-2).map((enemy) => Math.hypot(enemy.sprite.x - mission.player.x, enemy.sprite.y - mission.player.y)),
    };

    mission.applySoftActorSeparation();

    if (ember) {
      const target = mission.enemies[0];
      mission.useBulwarkAbility(ember, target);
    }

    const pausePromise = new Promise((resolve) => {
      mission.openPauseMenu();
      setTimeout(resolve, 50);
    });
    await pausePromise;

    const pause = window.__loeGame.scene.keys.pause;
    let fullscreenActive = false;
    try {
      await pause.toggleFullscreen();
      fullscreenActive = Boolean(document.fullscreenElement);
    } catch {
      fullscreenActive = false;
    }

    pause.resumeGame();

    return {
      afterLyra,
      afterOrin,
      emberRole: ember?.kitId ?? null,
      playerGuardBuff: mission.playerGuardBuff,
      beforeSeparation,
      afterSeparation: {
        emberToPlayer: ember ? Math.hypot(ember.sprite.x - mission.player.x, ember.sprite.y - mission.player.y) : null,
        enemyDistances: mission.enemies.slice(-2).map((enemy) => Math.hypot(enemy.sprite.x - mission.player.x, enemy.sprite.y - mission.player.y)),
      },
      fullscreenActive,
      pointerLockElement: document.pointerLockElement === window.__loeGame.canvas,
    };
  });

  await page.screenshot({
    path: path.join(outputDir, "mission-combat.png"),
    fullPage: true,
  });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify(
      {
        terminalState,
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
