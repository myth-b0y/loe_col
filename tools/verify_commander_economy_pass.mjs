import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/commander-economy-pass");
const URL = process.env.LOE_VERIFY_URL ?? "http://127.0.0.1:4173/?renderer=canvas";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function waitForGameBootstrap(page, timeoutMs = 30000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const ready = await page.evaluate(() => Boolean(window.__loeGame) && typeof window.render_game_to_text === "function");
    if (ready) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error("Timed out waiting for game bootstrap");
}

async function waitForScene(page, sceneKey, timeoutMs = 10000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text?.() ?? "{}"));
    if (state.activeScene === sceneKey) {
      return state;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for scene '${sceneKey}'`);
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await ensureDir(OUTPUT_DIR);
  await page.goto(URL, { waitUntil: "networkidle" });
  await waitForGameBootstrap(page);

  await page.evaluate(() => {
    window.localStorage.clear();
    window.__loeSession?.startNewGame?.(0);
    window.__loeGame?.scene.stop("hub");
    window.__loeGame?.scene.start("space");
    return true;
  });
  await waitForScene(page, "space");
  await page.waitForTimeout(400);

  const result = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const session = window.__loeSession;
    if (!space || !session) {
      return { error: "Space scene/session unavailable" };
    }

    const playerRaceId = session.saveData.profile.raceId;
    const playerHomeworld = space.galaxyDefinition.homeworlds.find((homeworld) => homeworld.raceId === playerRaceId) ?? null;
    const homeSystemId = playerHomeworld?.systemId ?? null;
    const homeStockpileBefore = homeSystemId
      ? space.forceState.systemStockpiles.find((stockpile) => stockpile.systemId === homeSystemId) ?? null
      : null;
    const productionBefore = space.getDebugSnapshot().production;

    for (let step = 0; step < 240; step += 1) {
      space.updateForceProduction?.(250);
      space.updateFactionShips?.(0.25);
      space.updateFieldObjects?.(0.25);
      space.resolveFactionShipCollisions?.();
    }

    const productionAfter = space.getDebugSnapshot().production;
    const activeMinerShips = space.factionShips.filter((ship) => ship.shipRole === "miner-ship");
    const nodeTypes = Array.from(new Set(productionAfter.resourceNodes.map((node) => node.resourceType)));
    const depletedNodeCount = productionAfter.resourceNodes.filter((node) => node.remainingYield <= 0).length;
    const minerPoolCount = productionAfter.pools.filter((pool) => pool.activeMinerCount > 0).length;
    const homeStockpileAfter = homeSystemId
      ? productionAfter.systemStockpiles.find((stockpile) => stockpile.systemId === homeSystemId) ?? null
      : null;

    return {
      playerRaceId,
      homeSystemId,
      minerCaps: {
        zone: productionAfter.zoneMinerPoolCap,
        prime: productionAfter.primeWorldMinerPoolCap,
      },
      totalActiveMinersBefore: productionBefore.totalActiveMiners,
      totalActiveMinersAfter: productionAfter.totalActiveMiners,
      minerPoolCount,
      activeMinerShipsNearPlayer: activeMinerShips.length,
      nodeTypeSet: nodeTypes,
      totalResourceNodes: productionAfter.resourceNodes.length,
      depletedNodeCount,
      homeStockpileBefore,
      homeStockpileAfter,
      stockpileChanged: JSON.stringify(homeStockpileBefore?.resources ?? {}) !== JSON.stringify(homeStockpileAfter?.resources ?? {}),
      anyWarshipProductionQueued: productionAfter.pools.some((pool) => Boolean(pool.productionAssetId)),
      anyMinerProductionQueued: productionAfter.pools.some((pool) => Boolean(pool.minerProductionAssetId)),
      sampleMinerShips: activeMinerShips.slice(0, 4).map((ship) => ({
        id: ship.id,
        miningState: ship.miningState,
        cargo: ship.cargo,
        targetResourceNodeId: ship.targetResourceNodeId,
      })),
    };
  });

  assert(result && !result.error, `Verifier setup failed: ${JSON.stringify(result)}`);
  assert(result.minerCaps.zone === 5 && result.minerCaps.prime === 8,
    `Miner caps should be zone=5 and prime=8: ${JSON.stringify(result.minerCaps)}`);
  assert(result.totalResourceNodes > 0, `Resource nodes should exist: ${JSON.stringify(result)}`);
  assert(result.nodeTypeSet.includes("iron-ore")
    && result.nodeTypeSet.includes("aetherium-ore")
    && result.nodeTypeSet.includes("starforged-alloy")
    && result.nodeTypeSet.includes("scrap-ship-parts"),
    `Resource node set should include iron, aetherium, starforged, and scrap: ${JSON.stringify(result.nodeTypeSet)}`);
  assert(result.totalActiveMinersAfter > result.totalActiveMinersBefore,
    `Miner production should increase active miners over time: ${JSON.stringify({ before: result.totalActiveMinersBefore, after: result.totalActiveMinersAfter })}`);
  assert(result.minerPoolCount > 0, `At least one pool should own active miners: ${JSON.stringify(result)}`);
  assert(result.activeMinerShipsNearPlayer > 0,
    `Nearby space should visibly contain miner ships after the sim window: ${JSON.stringify(result.sampleMinerShips)}`);
  assert(result.depletedNodeCount > 0 || result.stockpileChanged,
    `Economy sim should either deplete nodes or change the home stockpile: ${JSON.stringify(result)}`);
  assert(result.anyWarshipProductionQueued || result.anyMinerProductionQueued,
    `Commander economy should use production queues during the sim window: ${JSON.stringify({ anyWarshipProductionQueued: result.anyWarshipProductionQueued, anyMinerProductionQueued: result.anyMinerProductionQueued })}`);

  await fs.writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(result, null, 2));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "commander-economy.png"), fullPage: false });
} finally {
  await browser.close();
}
