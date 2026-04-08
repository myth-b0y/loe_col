import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/boss-enemy-pass");
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

  await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeSession.setSquadAssignments([
      { companionId: "rook", slotId: "front-left" },
      { companionId: "sera", slotId: "right" },
      { companionId: "lyra", slotId: "back-left" },
    ]);
    window.__loeSession.acceptMission("nightglass-abyss");
    window.__loeSession.setSelectedMission("nightglass-abyss");
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
  await page.waitForTimeout(450);

  const summary = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    const hudSpacing = {
      firstNameY: mission.companions[0]?.hud?.nameText?.y ?? null,
      firstHpY: mission.companions[0]?.hud?.hpValueText?.y ?? null,
      secondNameY: mission.companions[1]?.hud?.nameText?.y ?? null,
      thirdNameY: mission.companions[2]?.hud?.nameText?.y ?? null,
    };

    mission.clearEnemies();
    const playerX = mission.player.x;
    const playerY = mission.player.y;
    mission.spawnEnemy("rusher", playerX + 190, playerY + 16);
    mission.spawnEnemy("shooter", playerX + 260, playerY - 18);
    const rusher = mission.enemies.find((enemy) => enemy.kind === "rusher");
    const shooter = mission.enemies.find((enemy) => enemy.kind === "shooter");
    rusher.attackCooldown = 0;
    shooter.attackCooldown = 0;
    const bulletsBeforeVolley = mission.bullets.length;
    mission.updateEnemies(0.12);
    const windupState = {
      rusherMove: rusher.lastMoveLabel,
      rusherState: rusher.moveState,
    };
    mission.updateEnemies(0.28);
    const enemyMoves = {
      rusherMove: rusher.lastMoveLabel,
      rusherState: rusher.moveState,
      shooterMove: shooter.lastMoveLabel,
      bulletsSpawned: mission.bullets.length - bulletsBeforeVolley,
    };

    mission.clearEnemies();
    mission.loadStage(mission.mission.stages.length - 1);
    const bossStage = mission.currentStage;
    const bossSpawnX = mission.playArea.centerX;
    const bossSpawnY = mission.playArea.centerY - 40;
    mission.spawnEnemy("boss", bossSpawnX, bossSpawnY);
    const boss = mission.enemies[0];
    const bossStart = {
      name: boss.displayName,
      title: mission.bossTitle.text,
      phase: boss.bossPhase + 1,
      bossKind: boss.bossKind,
    };

    boss.specialCooldown = 0;
    mission.updateEnemies(0.1);
    const phaseOneMove = boss.lastMoveLabel;

    boss.moveState = "idle";
    boss.moveTimer = 0;
    boss.shield = 0;
    mission.damageEnemy(boss, boss.hp + 9999);
    const phaseTwoState = {
      phase: boss.bossPhase + 1,
      title: mission.bossTitle.text,
      fillColor: mission.bossFill.fillColor,
    };

    boss.moveState = "idle";
    boss.moveTimer = 0;
    boss.specialCooldown = 0;
    mission.updateEnemies(0.1);
    const phaseTwoMove = boss.lastMoveLabel;

    boss.moveState = "idle";
    boss.moveTimer = 0;
    boss.shield = 0;
    mission.damageEnemy(boss, boss.hp + 9999);
    const phaseThreeState = {
      phase: boss.bossPhase + 1,
      title: mission.bossTitle.text,
      fillColor: mission.bossFill.fillColor,
    };

    boss.moveState = "idle";
    boss.moveTimer = 0;
    boss.specialCooldown = 0;
    mission.updateEnemies(0.1);
    const phaseThreeMove = boss.lastMoveLabel;

    return {
      hudSpacing,
      windupState,
      enemyMoves,
      bossStageName: bossStage?.name ?? null,
      bossStart,
      phaseOneMove,
      phaseTwoState,
      phaseTwoMove,
      phaseThreeState,
      phaseThreeMove,
      snapshot: mission.getDebugSnapshot(),
    };
  });

  await page.screenshot({
    path: path.join(outputDir, "boss-enemy-pass.png"),
    fullPage: true,
  });

  fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
