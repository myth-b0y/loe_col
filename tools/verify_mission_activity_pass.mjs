import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/mission-activity-pass");
const URL = process.env.LOE_VERIFY_URL ?? "http://127.0.0.1:4173/?renderer=canvas";

const TERMINAL_MISSION_IDS = ["test-chain-dispatch"];
const LIVE_MISSION_IDS = [
  "distress-transport",
  "distress-salvage",
  "distress-smuggling",
  "distress-reclaim",
  "distress-pirate-defense",
  "distress-neutral-empire-defense",
];
const PRIME_WORLD_MISSION_IDS = ["prime-assist-reclaim", "world-zone-reclaim"];
const REMOVED_TEMP_IDS = [
  "test-comms-checkin",
  "test-space-battle",
  "test-ground-sweep",
  "test-zone-reclaim",
  "test-kill-target",
  "test-boss-climax",
  "test-smuggling-run",
  "test-escort-distress",
  "test-resource-salvage",
  "test-travel-survey",
];
const RACE_COLORS = {
  olydran: 0xf0f5ff,
  aaruian: 0x4f8dff,
  elsari: 0x8a58ff,
  nevari: 0x49a85c,
  rakkan: 0xff9a3c,
  svarin: 0xe4c83d,
  ashari: 0xd74b56,
};

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

async function waitForScene(page, sceneKey, timeoutMs = 10000) {
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

async function resetToSpace(page, missionId, { source = "terminal" } = {}) {
  await page.evaluate(({ missionId: id, source: missionSource }) => {
    window.localStorage.clear();
    window.__loeSession?.startNewGame?.(0);
    if (missionSource === "live-space") {
      window.__loeSession?.grantLiveMission?.(id);
    } else {
      window.__loeSession?.acceptMission?.(id);
    }
    window.__loeSession?.setSelectedMission?.(id);
    window.__loeGame?.scene.stop("hub");
    window.__loeGame?.scene.stop("space");
    window.__loeGame?.scene.start("space");
  }, { missionId, source });
  await waitForScene(page, "space");
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.updateMissionActivity?.(1 / 60);
    space?.refreshHud?.();
  });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const raw = space?.getDebugSnapshot?.() ?? {};
    const waypoint = raw.activeMissionWaypoint ?? null;
    const activityState = waypoint?.missionId
      ? window.__loeSession?.getMissionActivityState?.(waypoint.missionId)
      : null;
    const targetShipIds = waypoint && activityState?.flags
      ? String(activityState.flags[`${waypoint.stepId}:targetShipIds`] ?? "")
          .split("|")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
    const missionTargetShips = targetShipIds.map((id) => {
      const state = space?.shipStates?.get?.(id) ?? null;
      return state
        ? {
            id,
            factionId: state.factionId,
            originRaceId: state.originRaceId,
            shipRole: state.shipRole,
            hp: state.hp,
            destroyed: state.destroyed,
            groupId: state.groupId,
          }
        : { id, missing: true };
    });
    return {
      selectedMissionId: window.__loeSession?.getSelectedMissionId?.() ?? null,
      acceptedMissionIds: window.__loeSession?.getAcceptedMissionIds?.() ?? [],
      completedMissionIds: window.__loeSession?.getCompletedMissionIds?.() ?? [],
      activityState,
      activeMissionWaypoint: waypoint,
      missionObjects: raw.missionObjects ?? [],
      missionRuntime: raw.missionRuntime ?? {},
      cargo: window.__loeSession?.getCargoSlots?.() ?? [],
      war: raw.war ?? null,
      commsOverlayVisible: raw.commsOverlayVisible ?? false,
      stationOverlayVisible: raw.stationOverlayVisible ?? false,
      missionTargetShips,
      factionShipsRemaining: raw.factionShipsRemaining ?? 0,
    };
  });
}

async function movePlayerToActiveWaypoint(page) {
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const waypoint = space?.getDebugSnapshot?.()?.activeMissionWaypoint;
    if (!space || !waypoint) {
      return;
    }
    space.shipRoot.x = waypoint.x;
    space.shipRoot.y = waypoint.y;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(waypoint.x, waypoint.y);
    space.updateMissionActivity?.(1 / 60);
    space.refreshHud?.();
  });
}

async function completeCurrentComms(page) {
  await movePlayerToActiveWaypoint(page);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.tryCompleteInteractiveMissionStep?.();
    space?.handleMissionCommsContinue?.();
    space?.updateMissionActivity?.(1 / 60);
    space?.refreshHud?.();
  });
}

async function destroyActiveMissionTargetShips(page) {
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const waypoint = space?.getDebugSnapshot?.()?.activeMissionWaypoint;
    const state = waypoint?.missionId ? window.__loeSession?.getMissionActivityState?.(waypoint.missionId) : null;
    const ids = String(state?.flags?.[`${waypoint?.stepId}:targetShipIds`] ?? "")
      .split("|")
      .map((id) => id.trim())
      .filter(Boolean);
    if (waypoint?.targetShipId && !ids.includes(waypoint.targetShipId)) {
      ids.push(waypoint.targetShipId);
    }
    ids.forEach((id) => {
      const activeShip = space?.factionShips?.find?.((ship) => ship.id === id);
      if (activeShip) {
        space.destroyFactionShip?.(activeShip);
        return;
      }
      const ship = space?.shipStates?.get?.(id);
      if (!ship) {
        return;
      }
      ship.hp = 0;
      ship.destroyed = true;
    });
    space?.updateMissionActivity?.(1 / 60);
    space?.refreshHud?.();
  });
}

async function seedEmpireHeldForeignZone(page) {
  return page.evaluate(() => {
    const session = window.__loeSession;
    const galaxy = session?.getGalaxyDefinition?.();
    const war = session?.getFactionWarState?.();
    if (!session || !galaxy || !war?.empireRaceId) {
      return null;
    }
    const sectorRaceById = {
      "olydran-expanse": "olydran",
      "aaruian-reach": "aaruian",
      "elsari-veil": "elsari",
      "nevari-bloom": "nevari",
      "rakkan-drift": "rakkan",
      "svarin-span": "svarin",
      "ashari-crown": "ashari",
    };
    const zone = galaxy.zones.find((candidate) => (
      !candidate.isPrimeWorldZone
      && candidate.currentControllerId !== war.empireRaceId
      && candidate.currentControllerId === sectorRaceById[candidate.coreSectorId ?? candidate.sectorId]
    ));
    if (!zone) {
      return null;
    }
    const originalControllerId = sectorRaceById[zone.coreSectorId ?? zone.sectorId] ?? zone.currentControllerId;
    zone.currentControllerId = war.empireRaceId;
    zone.zoneState = "stable";
    zone.zoneCaptureProgress = 0;
    zone.zoneConflictProgress = 0;
    zone.captureAttackerRaceId = null;
    session.setGalaxyDefinition(galaxy, true);
    const space = window.__loeGame?.scene.keys.space;
    if (space) {
      space.galaxyDefinition = galaxy;
      space.galaxyStateDirty = true;
    }
    return { zoneId: zone.id, originalControllerId, empireRaceId: war.empireRaceId };
  });
}

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
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

  const contractState = await page.evaluate(({ terminalIds, liveIds, primeIds, removedIds }) => {
    const contracts = window.__loeContracts ?? [];
    const byId = Object.fromEntries(contracts.map((contract) => [contract.id, contract]));
    return {
      count: contracts.length,
      terminalIds: contracts.filter((contract) => contract.terminalVisible).map((contract) => contract.id),
      liveIds: contracts.filter((contract) => contract.source?.kind === "live-space").map((contract) => contract.id),
      primeIds: contracts.filter((contract) => contract.source?.kind === "prime-world").map((contract) => contract.id),
      removedPresent: removedIds.filter((id) => Boolean(byId[id])),
      terminalPresent: terminalIds.every((id) => byId[id]?.terminalVisible),
      livePresent: liveIds.every((id) => byId[id]?.source?.kind === "live-space" && !byId[id]?.terminalVisible),
      primePresent: primeIds.every((id) => byId[id]?.source?.kind === "prime-world" && !byId[id]?.terminalVisible),
      chainSteps: byId["test-chain-dispatch"]?.activities?.map((step) => step.type) ?? [],
      smugglingSteps: byId["distress-smuggling"]?.activities?.map((step) => step.type) ?? [],
      salvageSteps: byId["distress-salvage"]?.activities?.map((step) => step.type) ?? [],
      directReclaimStages: window.__loeCreateMissionDefinition?.("world-zone-reclaim", 1)?.stages?.length ?? null,
    };
  }, {
    terminalIds: TERMINAL_MISSION_IDS,
    liveIds: LIVE_MISSION_IDS,
    primeIds: PRIME_WORLD_MISSION_IDS,
    removedIds: REMOVED_TEMP_IDS,
  });

  assert(contractState.count === 9, `Expected 9 world-backed mission contracts, got ${contractState.count}`);
  assert(JSON.stringify(contractState.terminalIds) === JSON.stringify(TERMINAL_MISSION_IDS), `Terminal should only expose linked test mission: ${JSON.stringify(contractState.terminalIds)}`);
  assert(contractState.terminalPresent, `Linked terminal mission missing: ${JSON.stringify(contractState)}`);
  assert(contractState.livePresent, `Live distress mission set mismatch: ${JSON.stringify(contractState.liveIds)}`);
  assert(contractState.primePresent, `Prime/direct mission set mismatch: ${JSON.stringify(contractState.primeIds)}`);
  assert(contractState.removedPresent.length === 0, `Removed temp missions still present: ${contractState.removedPresent.join(", ")}`);
  assert(contractState.chainSteps.join(">") === "travel>comms>comms>comms>space-battle>comms>zone>comms>comms>comms>space-battle>escort>comms", `Linked chain steps changed unexpectedly: ${contractState.chainSteps}`);
  assert(contractState.smugglingSteps.join(">") === "comms>comms", `Smuggling should be pickup/delivery comms, got: ${contractState.smugglingSteps}`);
  assert(contractState.salvageSteps.join(">") === "resource>comms", `Salvage should recover then deliver, got: ${contractState.salvageSteps}`);
  assert(contractState.directReclaimStages === 2, `Direct/simple reclaim should use short ground variant, got ${contractState.directReclaimStages}`);

  await page.evaluate(() => {
    window.localStorage.clear();
    window.__loeSession?.startNewGame?.(0);
    window.__loeSession?.acceptMission?.("test-chain-dispatch");
    window.__loeSession?.setSelectedMission?.(null);
    window.__loeGame?.scene.stop("hub");
    window.__loeGame?.scene.stop("space");
    window.__loeGame?.scene.start("space");
  });
  await waitForScene(page, "space");
  await page.waitForTimeout(250);
  let state = await snapshot(page);
  assert(state.acceptedMissionIds.includes("test-chain-dispatch"), "Accepted linked mission missing before set-course test");
  assert(state.selectedMissionId === null, "Accepted mission should not be selected automatically");
  assert(state.activeMissionWaypoint === null, "Accepted but inactive mission should not show a waypoint");
  await capture(page, "accepted-not-course.png");

  await page.evaluate(() => {
    const session = window.__loeSession;
    const state = session?.getMissionActivityState?.("test-chain-dispatch");
    if (!session || !state) {
      return;
    }
    session.setSelectedMission("test-chain-dispatch");
    session.setMissionActivityState("test-chain-dispatch", {
      ...state,
      stepIndex: 2,
      completedStepIds: ["chain-travel-start", "chain-briefing"],
      flags: {},
    }, true);
    const space = window.__loeGame?.scene.keys.space;
    space?.updateMissionActivity?.(1 / 60);
    space?.refreshHud?.();
  });
  await completeCurrentComms(page);
  state = await snapshot(page);
  assert(state.cargo.some((item) => item?.tag === "mission-cargo:test-chain-dispatch"), "Linked delivery pickup should place a real package in inventory");
  assert(state.activityState?.flags?.cargoItemId, `Linked delivery pickup should store cargo identity: ${JSON.stringify(state.activityState?.flags)}`);
  await completeCurrentComms(page);
  state = await snapshot(page);
  assert(!state.cargo.some((item) => item?.tag === "mission-cargo:test-chain-dispatch"), "Linked delivery dropoff should remove the real package from inventory");

  await resetToSpace(page, "distress-smuggling", { source: "live-space" });
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.setDistressMissionTimingFlags?.("distress-smuggling");
  });
  state = await snapshot(page);
  assert(typeof state.activityState?.flags?.distressRemainingMs === "number" && state.activityState.flags.distressRemainingMs >= 590000, `Timed distress should expose a long remaining timer: ${JSON.stringify(state.activityState?.flags)}`);
  assert(state.activeMissionWaypoint?.kind === "comms", `Smuggling pickup should be a real comms pickup: ${JSON.stringify(state.activeMissionWaypoint)}`);
  assert(state.missionObjects.length === 0, "Smuggling pickup should not spawn salvage/resource objects");
  await completeCurrentComms(page);
  state = await snapshot(page);
  assert(state.cargo.some((item) => item?.tag === "mission-cargo:distress-smuggling"), "Smuggling pickup should place cargo in inventory");
  assert(state.activeMissionWaypoint?.kind === "comms", "Smuggling delivery should remain a comms delivery");
  await completeCurrentComms(page);
  state = await snapshot(page);
  assert(!state.acceptedMissionIds.includes("distress-smuggling"), "Completed live smuggling activity should clear from accepted missions");
  assert(!state.cargo.some((item) => item?.tag === "mission-cargo:distress-smuggling"), "Smuggling cargo should be removed on delivery");

  await resetToSpace(page, "distress-salvage", { source: "live-space" });
  state = await snapshot(page);
  assert(state.missionObjects.some((object) => object.kind === "resource"), "Salvage package should spawn as a recoverable resource");
  assert(state.missionObjects.filter((object) => object.kind === "debris").length >= 3, "Salvage should include a ship debris field");
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const resource = space?.missionObjects?.find((object) => object.kind === "resource");
    if (!space || !resource) {
      return;
    }
    space.shipRoot.x = resource.root.x;
    space.shipRoot.y = resource.root.y;
    space.shipVelocity.set(0, 0);
    space.tryCompleteInteractiveMissionStep?.();
    space.updateMissionActivity?.(1 / 60);
    space.refreshHud?.();
  });
  state = await snapshot(page);
  assert(state.cargo.some((item) => item?.tag === "mission-cargo:distress-salvage"), "Salvage recovery should place a real cargo item in inventory");
  assert(state.missionObjects.filter((object) => object.kind === "debris" && object.lingerUntilDistance).length >= 3, "Salvage debris should linger after the package is gathered");
  await completeCurrentComms(page);
  state = await snapshot(page);
  assert(!state.acceptedMissionIds.includes("distress-salvage"), "Completed live salvage activity should clear from accepted missions");
  assert(!state.cargo.some((item) => item?.tag === "mission-cargo:distress-salvage"), "Salvage cargo should be removed on delivery");

  await resetToSpace(page, "distress-transport", { source: "live-space" });
  state = await snapshot(page);
  assert(state.activeMissionWaypoint, `Transport should first point at the start location: ${JSON.stringify(state.activeMissionWaypoint)}`);
  assert(state.activeMissionWaypoint?.actionLabel === "START ESCORT", "Transport should wait for F/start interaction before spawning");
  assert(!state.missionObjects.some((object) => object.kind === "escort"), "Transport should not spawn before the player starts the escort");
  await movePlayerToActiveWaypoint(page);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.tryCompleteInteractiveMissionStep?.();
    for (let i = 0; i < 180; i += 1) {
      space?.updateMissionActivity?.(1 / 60);
    }
    space?.refreshHud?.();
  });
  state = await snapshot(page);
  const escort = state.missionObjects.find((object) => object.kind === "escort");
  assert(escort?.routeOriginLabel && escort?.routeDestinationLabel, `Escort transport missing real route labels: ${JSON.stringify(state.missionObjects)}`);
  assert(escort?.usesRealShipVisual, "Escort transport should use the real ship renderer");
  assert(escort?.factionId === "homeguard" && escort?.originRaceId && escort.originRaceId !== state.war?.empireRaceId, `Escort transport should use a real non-Empire race identity: ${JSON.stringify(escort)}`);
  assert(escort?.color === RACE_COLORS[escort.originRaceId], `Escort transport color should match its race identity: ${JSON.stringify(escort)}`);
  assert(escort?.routeCheckpointCount >= 3, `Escort route should include internal checkpoints plus destination: ${JSON.stringify(escort)}`);
  assert(escort?.routeStarted, "Escort transport should begin moving after launch delay");
  await capture(page, "transport-started.png");
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const escortObject = space?.missionObjects?.find((object) => object.kind === "escort");
    const checkpoint = escortObject?.routeCheckpoints?.[0];
    if (!space || !escortObject || !checkpoint) {
      return;
    }
    escortObject.root.x = checkpoint.x;
    escortObject.root.y = checkpoint.y;
    space.shipRoot.x = checkpoint.x;
    space.shipRoot.y = checkpoint.y;
    for (let i = 0; i < 260; i += 1) {
      space.updateMissionActivity?.(1 / 60);
    }
  });
  state = await snapshot(page);
  const pirateRaiders = await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    return [...(space?.shipStates?.values?.() ?? [])].filter((ship) => ship.factionId === "pirate" && String(ship.groupId ?? "").includes("distress-transport")).length;
  });
  assert(pirateRaiders > 0, "Escort attackers should spawn as real pirate faction ships, not mission circles");
  assert(!state.missionObjects.some((object) => object.kind === "hostile" || object.kind === "boss"), "Escort raiders should not be fake hostile mission objects");

  await resetToSpace(page, "distress-pirate-defense", { source: "live-space" });
  state = await snapshot(page);
  assert(state.activeMissionWaypoint?.targetShipId, `Pirate defense should waypoint to a real target ship: ${JSON.stringify(state.activeMissionWaypoint)}`);
  assert(state.missionTargetShips.length > 0, "Pirate defense should register target ship ids");
  assert(state.missionTargetShips.every((ship) => ship.factionId === "pirate"), `Pirate defense targets should be real pirate ships: ${JSON.stringify(state.missionTargetShips)}`);
  assert(!state.missionObjects.some((object) => object.kind === "hostile" || object.kind === "boss"), "Pirate defense should not use fake hostile mission objects");
  await destroyActiveMissionTargetShips(page);
  state = await snapshot(page);
  assert(!state.acceptedMissionIds.includes("distress-pirate-defense"), "Pirate defense should complete after real target ships are destroyed");

  await resetToSpace(page, "distress-neutral-empire-defense", { source: "live-space" });
  const neutralDefenseZone = await seedEmpireHeldForeignZone(page);
  assert(neutralDefenseZone, "Could not seed a real foreign Empire-held zone for neutral defense verification");
  await page.evaluate((zoneId) => {
    const session = window.__loeSession;
    session?.grantLiveMission?.("distress-neutral-empire-defense");
    session?.setSelectedMission?.("distress-neutral-empire-defense");
    const state = session?.getMissionActivityState?.("distress-neutral-empire-defense");
    if (session && state) {
      session.setMissionActivityState("distress-neutral-empire-defense", {
        ...state,
        flags: {
          ...state.flags,
          targetZoneId: zoneId,
        },
      }, true);
    }
    const space = window.__loeGame?.scene.keys.space;
    space?.updateMissionActivity?.(1 / 60);
    space?.refreshHud?.();
  }, neutralDefenseZone.zoneId);
  state = await snapshot(page);
  assert(state.activeMissionWaypoint?.targetShipId, `Neutral defense should target a real Empire ship: ${JSON.stringify(state)}`);
  const neutralTargetShip = await page.evaluate((targetShipId) => {
    const space = window.__loeGame?.scene.keys.space;
    const activeShip = space?.factionShips?.find?.((ship) => ship.id === targetShipId);
    const storedShip = space?.shipStates?.get?.(targetShipId);
    const ship = activeShip ?? storedShip;
    return ship ? { id: ship.id, factionId: ship.factionId, originRaceId: ship.originRaceId } : null;
  }, state.activeMissionWaypoint.targetShipId);
  assert(neutralTargetShip?.factionId === "empire" && neutralTargetShip?.originRaceId, `Neutral defense target should use this save's Empire identity: ${JSON.stringify(neutralTargetShip)}`);
  await destroyActiveMissionTargetShips(page);
  state = await snapshot(page);
  assert(!state.acceptedMissionIds.includes("distress-neutral-empire-defense"), "Neutral defense should complete after real Empire ships are destroyed");

  await resetToSpace(page, "distress-reclaim", { source: "live-space" });
  state = await snapshot(page);
  assert(state.activityState && typeof state.activityState.flags?.distressRemainingMs !== "number", `State-based reclaim distress should not use a timer: ${JSON.stringify(state.activityState?.flags)}`);
  const seededZone = await seedEmpireHeldForeignZone(page);
  assert(seededZone, "Could not seed a real foreign Empire-held zone for reclaim verification");
  await page.evaluate((zoneId) => {
    const state = window.__loeSession?.getMissionActivityState?.("distress-reclaim");
    if (!state) {
      return;
    }
    window.__loeSession?.setMissionActivityState?.("distress-reclaim", {
      ...state,
      flags: {
        ...state.flags,
        targetZoneId: zoneId,
        reclaimZoneId: zoneId,
      },
    }, true);
  }, seededZone.zoneId);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.updateMissionActivity?.(1 / 60);
    space?.refreshHud?.();
  });
  state = await snapshot(page);
  assert(state.activeMissionWaypoint?.kind === "zone", `Reclaim should point at the real zone being stabilized: ${JSON.stringify(state.activeMissionWaypoint)}`);
  assert(state.missionTargetShips.length > 0, "Reclaim should bind real Empire ships to the zone objective");
  assert(state.missionTargetShips.every((ship) => ship.factionId === "empire"), `Reclaim target ships should be Empire-controlled: ${JSON.stringify(state.missionTargetShips)}`);
  await destroyActiveMissionTargetShips(page);
  await movePlayerToActiveWaypoint(page);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    space?.tryCompleteInteractiveMissionStep?.();
    space?.updateMissionActivity?.(1 / 60);
    space?.refreshHud?.();
  });
  state = await snapshot(page);
  assert(!state.acceptedMissionIds.includes("distress-reclaim"), "Reclaim support should complete after clearing real ships and stabilizing");
  const zoneAfterReclaim = await page.evaluate((zoneId) => {
    const zone = window.__loeSession?.getGalaxyDefinition?.()?.zones?.find((candidate) => candidate.id === zoneId);
    return zone ? { id: zone.id, currentControllerId: zone.currentControllerId, zoneState: zone.zoneState } : null;
  }, seededZone.zoneId);
  assert(zoneAfterReclaim?.currentControllerId !== seededZone.empireRaceId && zoneAfterReclaim?.zoneState === "stable", `Reclaim should restore the zone out of Empire control: ${JSON.stringify({ zoneAfterReclaim, seededZone })}`);

  const directZone = await page.evaluate(({ zoneId, empireRaceId }) => {
    const session = window.__loeSession;
    const galaxy = session?.getGalaxyDefinition?.();
    const zone = galaxy?.zones?.find((candidate) => candidate.id === zoneId);
    if (!session || !galaxy || !zone) {
      return null;
    }
    const originalControllerId = zone.currentControllerId;
    zone.currentControllerId = empireRaceId;
    zone.zoneState = "stable";
    session.setGalaxyDefinition(galaxy, true);
    session.acceptMission("world-zone-reclaim");
    session.setMissionActivityState("world-zone-reclaim", {
      stepIndex: 0,
      completedStepIds: [],
      flags: {
        targetZoneId: zone.id,
        reclaimZoneId: zone.id,
      },
    }, true);
    return { zoneId: zone.id, originalControllerId };
  }, { zoneId: seededZone.zoneId, empireRaceId: seededZone.empireRaceId });
  assert(directZone, "Could not seed direct reclaim mission state");
  await page.evaluate(() => {
    window.__loeSession?.completeMission?.("world-zone-reclaim", {
      missionId: "world-zone-reclaim",
      xp: 1,
      credits: 1,
      materials: {},
      items: [],
    });
  });
  const directZoneAfter = await page.evaluate((zoneId) => {
    const zone = window.__loeSession?.getGalaxyDefinition?.()?.zones?.find((candidate) => candidate.id === zoneId);
    return zone ? { id: zone.id, currentControllerId: zone.currentControllerId, zoneState: zone.zoneState } : null;
  }, directZone.zoneId);
  assert(directZoneAfter?.currentControllerId === directZone.originalControllerId, `Direct reclaim completion should restore original owner: ${JSON.stringify(directZoneAfter)}`);

  const invalidDirectReclaim = await page.evaluate((zoneId) => {
    const session = window.__loeSession;
    const galaxy = session?.getGalaxyDefinition?.();
    const zone = galaxy?.zones?.find((candidate) => candidate.id === zoneId);
    if (!session || !galaxy || !zone) {
      return null;
    }
    const controllerBefore = zone.currentControllerId;
    session.acceptMission("world-zone-reclaim");
    session.setMissionActivityState("world-zone-reclaim", {
      stepIndex: 0,
      completedStepIds: [],
      flags: {
        targetZoneId: zone.id,
        reclaimZoneId: zone.id,
      },
    }, true);
    session.markShipArrived("world-zone-reclaim");
    const canDeploy = session.canDeployArrivedMission("world-zone-reclaim");
    session.completeMission("world-zone-reclaim", {
      missionId: "world-zone-reclaim",
      xp: 1,
      credits: 1,
      materials: {},
      items: [],
    });
    const zoneAfter = session.getGalaxyDefinition().zones.find((candidate) => candidate.id === zoneId);
    return {
      canDeploy,
      controllerBefore,
      controllerAfter: zoneAfter?.currentControllerId ?? null,
    };
  }, directZone.zoneId);
  assert(invalidDirectReclaim?.canDeploy === false, `Direct reclaim should not deploy outside Empire-controlled zones: ${JSON.stringify(invalidDirectReclaim)}`);
  assert(invalidDirectReclaim?.controllerAfter === invalidDirectReclaim?.controllerBefore, `Invalid direct reclaim should not change ownership: ${JSON.stringify(invalidDirectReclaim)}`);

  const result = {
    contractState,
    consoleErrors,
  };
  await fs.writeFile(path.join(OUTPUT_DIR, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
