import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/space-faction-pass");
const URL = "http://127.0.0.1:4173/?renderer=canvas";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function getState(page) {
  const raw = await page.evaluate(() => window.render_game_to_text?.() ?? "{}");
  return JSON.parse(raw);
}

async function waitForScene(page, sceneKey, timeoutMs = 8000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const state = await getState(page);
    if (state.activeScene === sceneKey) {
      return state;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for scene '${sceneKey}'`);
}

async function capture(page, filename) {
  await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: false });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];

page.on("pageerror", (error) => {
  consoleErrors.push({ type: "pageerror", message: error.message, stack: error.stack });
});
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push({ type: "console", message: message.text() });
  }
});

try {
  await ensureDir(OUTPUT_DIR);
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__loeGame) && typeof window.render_game_to_text === "function");

  await page.evaluate(() => {
    window.localStorage.clear();
    window.__loeSession?.startNewGame?.(0);
    window.__loeGame?.scene.start("hub");
  });

  await waitForScene(page, "hub");
  await capture(page, "hub-start.png");

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub.player.setPosition(640, 176);
    hub.updateNearestStation?.();
    hub.updateInteractionTarget?.();
    hub.updatePrompt?.();
  });
  await page.keyboard.press("e");
  await page.waitForTimeout(250);

  const pilotPanel = await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    return {
      title: hub?.panelTitle?.text ?? "",
      actionLabel: hub?.panelAction?.label?.text ?? "",
    };
  });
  assert(pilotPanel.title === "Pilot Seat", `Unexpected pilot seat title '${pilotPanel.title}'`);
  assert(pilotPanel.actionLabel === "Launch Into Space", `Unexpected launch label '${pilotPanel.actionLabel}'`);

  await page.evaluate(() => {
    const hub = window.__loeGame?.scene.keys.hub;
    hub?.launchIntoSpace?.(null);
  });

  const spaceState = await waitForScene(page, "space");
  await page.waitForTimeout(300);
  await capture(page, "space-start.png");

  const spawnSummary = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const ships = [...space.factionShips];
    const sectorCounts = ships.reduce((acc, ship) => {
      if (!acc[ship.sectorId]) {
        acc[ship.sectorId] = { empire: 0, pirate: 0, republic: 0, smuggler: 0 };
      }
      acc[ship.sectorId][ship.factionId] += 1;
      return acc;
    }, {});
    return {
      factionCounts: space.getDebugSnapshot().factionCounts,
      sectorCounts,
      shipCount: ships.length,
    };
  });

  assert(spawnSummary.factionCounts.empire > 0, "Empire ships did not spawn");
  assert(spawnSummary.factionCounts.pirate > 0, "Pirate ships did not spawn");
  assert(spawnSummary.factionCounts.republic > 0, "Republic ships did not spawn");
  assert(spawnSummary.factionCounts.smuggler > 0, "Smuggler ships did not spawn");
  assert(Object.keys(spawnSummary.sectorCounts).length >= 4, "Sector-based ship spawning is too sparse");

  const behaviorCheck = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const empire = space.factionShips.find((ship) => ship.factionId === "empire");
    const republic = space.factionShips.find((ship) => ship.factionId === "republic");
    const pirate = space.factionShips.find((ship) => ship.factionId === "pirate");
    const smuggler = space.factionShips.find((ship) => ship.factionId === "smuggler");
    const playerX = space.shipRoot.x;
    const playerY = space.shipRoot.y;

    const parkFar = (ship, xOffset, yOffset) => {
      ship.root.x = playerX + xOffset;
      ship.root.y = playerY + yOffset;
      ship.velocity.set(0, 0);
    };

    parkFar(empire, 2200, 0);
    parkFar(republic, 2600, 0);
    parkFar(pirate, -2200, 0);
    parkFar(smuggler, 0, 2200);

    empire.root.x = playerX + 340;
    empire.root.y = playerY;
    const empireTarget = space.selectShipTarget(empire)?.kind ?? null;

    parkFar(empire, 2200, 0);
    republic.root.x = playerX + 340;
    republic.root.y = playerY;
    const republicTarget = space.selectShipTarget(republic)?.kind ?? null;
    const republicHullBefore = republic.hp;
    space.damageFactionShip(republic, 1, { kind: "player" }, republic.root.x);
    const republicHullAfter = republic.hp;
    const republicProvoked = republic.provokedByPlayer;

    parkFar(republic, 2600, 0);
    pirate.root.x = playerX - 340;
    pirate.root.y = playerY;
    const pirateTarget = space.selectShipTarget(pirate)?.kind ?? null;

    parkFar(pirate, -2200, 0);
    smuggler.root.x = playerX;
    smuggler.root.y = playerY + 320;
    smuggler.provokedByPlayer = false;
    smuggler.provokedByShips.clear();
    smuggler.aggressionTimer = 0;
    const smugglerBefore = space.selectShipTarget(smuggler)?.kind ?? null;

    space.damageFactionShip(smuggler, 1, { kind: "player" }, smuggler.root.x);
    const smugglerAfter = space.selectShipTarget(smuggler)?.kind ?? null;

    return {
      empireTarget,
      republicTarget,
      republicHullBefore,
      republicHullAfter,
      republicProvoked,
      pirateTarget,
      smugglerBefore,
      smugglerAfter,
      smugglerProvoked: smuggler.provokedByPlayer,
      empireVsRepublic: space.isShipHostileToShip(empire, republic),
      republicVsEmpire: space.isShipHostileToShip(republic, empire),
      pirateVsSmuggler: space.isShipHostileToShip(pirate, smuggler),
    };
  });

  assert(behaviorCheck.empireTarget === "player", "Empire should treat the player as hostile");
  assert(behaviorCheck.republicTarget !== "player", "Republic should not attack the player by default");
  assert(behaviorCheck.republicHullAfter === behaviorCheck.republicHullBefore, "Republic ships should not take player damage");
  assert(!behaviorCheck.republicProvoked, "Republic ships should not become provoked by player attacks");
  assert(behaviorCheck.pirateTarget === "player", "Pirates should treat the player as hostile");
  assert(behaviorCheck.empireVsRepublic, "Empire should be hostile to Republic ships");
  assert(behaviorCheck.republicVsEmpire, "Republic should be hostile to Empire ships");
  assert(behaviorCheck.pirateVsSmuggler, "Pirates should be hostile to smugglers");
  assert(behaviorCheck.smugglerBefore === null, "Smugglers should be neutral before being attacked");
  assert(behaviorCheck.smugglerProvoked && behaviorCheck.smugglerAfter === "player", "Smuggler did not retaliate after being attacked");

  const combatCheck = await page.evaluate(async () => {
    const space = window.__loeGame?.scene.keys.space;
    const empire = space.factionShips.find((ship) => ship.factionId === "empire");
    const republic = space.factionShips.find((ship) => ship.factionId === "republic");
    const playerX = space.shipRoot.x;
    const playerY = space.shipRoot.y;
    empire.root.x = playerX + 1200;
    empire.root.y = playerY;
    empire.velocity.set(0, 0);
    republic.root.x = playerX + 1480;
    republic.root.y = playerY;
    republic.velocity.set(0, 0);
    const empireHullBefore = empire.hp;
    const republicHullBefore = republic.hp;
    await new Promise((resolve) => setTimeout(resolve, 2200));
    return {
      empireHullBefore,
      republicHullAfter: republic.hp,
      empireHullAfter: empire.hp,
      factionShotCount: space.shots.filter((shot) => shot.ownerKind === "faction").length,
      destroyedFactionShips: space.getDebugSnapshot().destroyedFactionShips,
    };
  });

  assert(
    combatCheck.factionShotCount > 0
      || combatCheck.empireHullAfter < combatCheck.empireHullBefore
      || combatCheck.republicHullAfter < combatCheck.empireHullBefore
      || combatCheck.destroyedFactionShips > 0,
    "Faction ships did not engage in readable combat",
  );

  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space.damagePlayerShip(99, "pirate");
  });
  const gameOverState = await waitForScene(page, "game-over");
  await capture(page, "space-game-over.png");
  assert(gameOverState.snapshot.mode === "space", "Space death did not route into the normal game-over scene");

  await page.mouse.click(640, 294);
  await waitForScene(page, "space");
  await page.waitForTimeout(250);
  await capture(page, "space-continue.png");

  await page.mouse.click(1170, 44);
  await waitForScene(page, "hub");

  const summary = {
    spawnSummary,
    behaviorCheck,
    combatCheck,
    gameOver: gameOverState.snapshot,
    consoleErrors,
    initialSpaceSnapshot: spaceState.snapshot,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await page.close();
  await browser.close();
}



