import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/combat-behavior-pass");
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
      { companionId: "lyra", slotId: "back-left" },
      { companionId: "orin", slotId: "back-right" },
    ]);
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

  const summary = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    const rook = mission.companions.find((companion) => companion.id === "rook");
    const lyra = mission.companions.find((companion) => companion.id === "lyra");
    const orin = mission.companions.find((companion) => companion.id === "orin");

    const hudLayout = {
      firstNameY: mission.companions[0]?.hud?.nameText?.y ?? null,
      firstEffectsY: mission.companions[0]?.hud?.effectText?.y ?? null,
      secondNameY: mission.companions[1]?.hud?.nameText?.y ?? null,
      thirdNameY: mission.companions[2]?.hud?.nameText?.y ?? null,
    };

    mission.playerHp = 44;
    mission.playerShield = 12;
    lyra.cooldown = 0;
    const shieldBeforeHeal = mission.playerShield;
    mission.useTideMedicAbility(lyra, {
      side: "player",
      x: mission.player.x,
      y: mission.player.y,
      score: 99,
    });
    const afterLyra = {
      hp: mission.playerHp,
      shield: mission.playerShield,
      shieldChanged: mission.playerShield !== shieldBeforeHeal,
      lyraThreat: lyra.threat,
    };

    orin.cooldown = 0;
    const shieldBeforeBuff = mission.playerShield;
    mission.useAstralWeaverAbility(orin, {
      side: "player",
      x: mission.player.x,
      y: mission.player.y,
      score: 99,
    });
    const afterOrin = {
      hp: mission.playerHp,
      shield: mission.playerShield,
      shieldChanged: mission.playerShield !== shieldBeforeBuff,
      focus: mission.playerFocusBuff,
      orinThreat: orin.threat,
    };

    mission.clearEnemies();
    mission.spawnEnemy("rusher", mission.player.x + 170, mission.player.y + 10);
    mission.spawnEnemy("shooter", mission.player.x + 210, mission.player.y - 10);
    const enemy = mission.enemies[0];
    rook.cooldown = 0;
    mission.useShieldAbility(rook, enemy, true);
    const focusTarget = mission.getEnemyFocusTarget(enemy);
    const shieldBeforeAegis = rook.shield;
    const hpBeforeAegis = rook.hp;
    mission.damageCompanion(rook, 40);

    return {
      hudLayout,
      afterLyra,
      afterOrin,
      rookState: {
        tauntTimer: rook.tauntTimer,
        aegisTimer: rook.aegisTimer,
        threat: rook.threat,
        shieldAfterAegisHit: rook.shield,
        hpAfterAegisHit: rook.hp,
        shieldBeforeAegis,
        hpBeforeAegis,
      },
      focusTarget: focusTarget.companion?.id ?? focusTarget.side,
      snapshot: mission.getDebugSnapshot(),
    };
  });

  await page.screenshot({
    path: path.join(outputDir, "mission-combat-behavior.png"),
    fullPage: true,
  });

  fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
