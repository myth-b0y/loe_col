import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUTPUT_DIR = path.resolve("output/web-game/mission-activity-pass");
const URL = process.env.LOE_VERIFY_URL ?? "http://127.0.0.1:4173/?renderer=canvas";

const TERMINAL_MISSION_IDS = [
  "test-comms-checkin",
  "test-space-battle",
  "test-ground-sweep",
  "test-zone-reclaim",
  "test-kill-target",
  "test-boss-climax",
  "test-chain-dispatch",
  "test-smuggling-run",
];

const LIVE_MISSION_IDS = [
  "test-escort-distress",
  "test-resource-salvage",
];

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

async function resetToSpace(page, missionId, { live = false } = {}) {
  await page.evaluate(({ missionId: id, live: isLive }) => {
    window.localStorage.clear();
    window.__loeSession?.startNewGame?.(0);
    if (isLive) {
      window.__loeSession?.grantLiveMission?.(id);
    } else {
      window.__loeSession?.acceptMission?.(id);
    }
    window.__loeSession?.setSelectedMission?.(id);
    window.__loeGame?.scene.stop("hub");
    window.__loeGame?.scene.stop("space");
    window.__loeGame?.scene.start("space");
  }, { missionId, live });
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
    return {
      selectedMissionId: window.__loeSession?.getSelectedMissionId?.() ?? null,
      acceptedMissionIds: window.__loeSession?.getAcceptedMissionIds?.() ?? [],
      completedMissionIds: window.__loeSession?.getCompletedMissionIds?.() ?? [],
      activityState: raw.activeMissionWaypoint?.missionId
        ? window.__loeSession?.getMissionActivityState?.(raw.activeMissionWaypoint.missionId)
        : null,
      activeMissionWaypoint: raw.activeMissionWaypoint ?? null,
      missionObjects: raw.missionObjects ?? [],
      missionRuntime: raw.missionRuntime ?? {},
      cargo: window.__loeSession?.getCargoSlots?.() ?? [],
      war: raw.war ?? null,
      commsOverlayVisible: raw.commsOverlayVisible ?? false,
      stationOverlayVisible: raw.stationOverlayVisible ?? false,
      landingReady: raw.landingReady ?? false,
    };
  });
}

async function destroyMissionCombatObjects(page) {
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    if (!space) {
      return;
    }
    space.updateMissionActivity?.(1 / 60);
    const objects = [...(space.missionObjects ?? [])]
      .filter((object) => object.kind === "hostile" || object.kind === "boss");
    objects.forEach((object) => space.damageMissionObject?.(object, object.hp + 20));
    space.updateMissionActivity?.(1 / 60);
    space.refreshHud?.();
  });
}

async function completeCurrentComms(page) {
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
    space.refreshHud?.();
    space.tryCompleteInteractiveMissionStep?.();
    space.handleMissionCommsContinue?.();
    space.updateMissionActivity?.(1 / 60);
    space.refreshHud?.();
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

  const contractState = await page.evaluate(({ terminalIds, liveIds }) => {
    const contracts = window.__loeContracts ?? [];
    return {
      count: contracts.length,
      terminalIds: contracts.filter((contract) => contract.terminalVisible).map((contract) => contract.id),
      liveIds: contracts.filter((contract) => contract.source?.kind === "live-space").map((contract) => contract.id),
      removedTravelPresent: contracts.some((contract) => contract.id === "test-travel-survey"),
      chainSteps: contracts.find((contract) => contract.id === "test-chain-dispatch")?.activities?.map((step) => step.type) ?? [],
      salvageSteps: contracts.find((contract) => contract.id === "test-resource-salvage")?.activities?.map((step) => step.type) ?? [],
      smugglingSteps: contracts.find((contract) => contract.id === "test-smuggling-run")?.activities?.map((step) => step.type) ?? [],
      shortGroundStages: window.__loeCreateMissionDefinition?.("test-ground-sweep", 1)?.stages?.length ?? null,
      terminalPresent: terminalIds.every((id) => contracts.some((contract) => contract.id === id && contract.terminalVisible)),
      livePresent: liveIds.every((id) => contracts.some((contract) => contract.id === id && contract.source?.kind === "live-space")),
    };
  }, { terminalIds: TERMINAL_MISSION_IDS, liveIds: LIVE_MISSION_IDS });

  assert(contractState.count === 10, `Expected 10 focused test missions, got ${contractState.count}`);
  assert(!contractState.removedTravelPresent, "Standalone travel test mission should be removed");
  assert(contractState.terminalPresent, `Terminal mission set mismatch: ${JSON.stringify(contractState.terminalIds)}`);
  assert(contractState.livePresent, `Live mission set mismatch: ${JSON.stringify(contractState.liveIds)}`);
  assert(contractState.chainSteps.join(">") === "travel>comms>escort>boss", `Linked chain steps changed unexpectedly: ${contractState.chainSteps}`);
  assert(contractState.salvageSteps.join(">") === "resource>comms", `Salvage should recover then deliver: ${contractState.salvageSteps}`);
  assert(contractState.smugglingSteps.join(">") === "resource>comms", `Smuggling should recover cargo then deliver: ${contractState.smugglingSteps}`);
  assert(contractState.shortGroundStages === 2, `Short ground mission should use 2 stages, got ${contractState.shortGroundStages}`);

  await page.evaluate(() => {
    window.localStorage.clear();
    window.__loeSession?.startNewGame?.(0);
    window.__loeSession?.acceptMission?.("test-comms-checkin");
    window.__loeSession?.setSelectedMission?.(null);
    window.__loeGame?.scene.stop("hub");
    window.__loeGame?.scene.stop("space");
    window.__loeGame?.scene.start("space");
  });
  await waitForScene(page, "space");
  await page.waitForTimeout(250);
  const acceptedNotActive = await snapshot(page);
  assert(acceptedNotActive.acceptedMissionIds.includes("test-comms-checkin"), "Accepted mission missing before set-course test");
  assert(acceptedNotActive.selectedMissionId === null, "Accepted mission should not be selected automatically");
  assert(acceptedNotActive.activeMissionWaypoint === null, "Accepted but inactive mission should not show waypoint");
  await capture(page, "accepted-not-course.png");

  await resetToSpace(page, "test-comms-checkin");
  await capture(page, "comms-course-set.png");
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const waypoint = space?.getDebugSnapshot?.()?.activeMissionWaypoint;
    space.shipRoot.x = waypoint.x;
    space.shipRoot.y = waypoint.y;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(waypoint.x, waypoint.y);
    space.refreshHud?.();
    space.tryCompleteInteractiveMissionStep?.();
  });
  let state = await snapshot(page);
  assert(state.stationOverlayVisible || state.commsOverlayVisible, "Comms mission should open a contextual comms/menu window before completion");
  await capture(page, "comms-window.png");
  await page.evaluate(() => window.__loeGame?.scene.keys.space?.handleMissionCommsContinue?.());
  await page.waitForTimeout(200);
  state = await snapshot(page);
  assert(state.completedMissionIds.includes("test-comms-checkin"), "Comms mission did not complete through comms hook");
  assert(state.activeMissionWaypoint === null, "Completed comms mission should clear waypoint");

  await resetToSpace(page, "test-space-battle");
  state = await snapshot(page);
  assert(state.missionObjects.filter((object) => object.kind === "hostile").length === 3, `Skirmish wave 1 not spawned: ${JSON.stringify(state.missionObjects)}`);
  assert(state.missionObjects.filter((object) => object.kind === "hostile").every((object) => object.usesRealShipVisual), "Skirmish targets should use real ship visuals");
  await destroyMissionCombatObjects(page);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    for (let i = 0; i < 150; i += 1) {
      space.updateMissionActivity?.(1 / 30);
    }
  });
  state = await snapshot(page);
  assert(state.missionObjects.filter((object) => object.kind === "hostile").length === 2, `Skirmish wave 2 not spawned: ${JSON.stringify(state)}`);
  await destroyMissionCombatObjects(page);
  await page.evaluate(() => window.__loeGame?.scene.keys.space?.updateMissionActivity?.(1 / 60));
  state = await snapshot(page);
  assert(state.completedMissionIds.includes("test-space-battle"), "Finite skirmish did not complete after clearing all waves");

  await resetToSpace(page, "test-escort-distress", { live: true });
  state = await snapshot(page);
  const escort = state.missionObjects.find((object) => object.kind === "escort");
  assert(escort?.routeOriginLabel && escort?.routeDestinationLabel, `Escort transport missing real route labels: ${JSON.stringify(state.missionObjects)}`);
  assert(escort?.usesRealShipVisual, "Escort transport should use the real ship renderer");
  assert(escort?.routeCheckpointCount >= 3, `Escort route should include internal checkpoints: ${JSON.stringify(escort)}`);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const escortObject = space.missionObjects.find((object) => object.kind === "escort");
    space.shipRoot.x = escortObject.root.x;
    space.shipRoot.y = escortObject.root.y;
    space.shipVelocity.set(0, 0);
    const checkpoint = escortObject.routeCheckpoints[0];
    escortObject.root.x = checkpoint.x;
    escortObject.root.y = checkpoint.y;
    space.shipRoot.x = checkpoint.x;
    space.shipRoot.y = checkpoint.y;
    space.updateMissionActivity?.(1 / 60);
    for (let i = 0; i < 140; i += 1) {
      space.updateMissionActivity?.(1 / 30);
    }
  });
  state = await snapshot(page);
  assert(state.missionObjects.some((object) => object.role === "skirmish" && object.factionId === "pirate"), "Escort route did not spawn periodic raiders");
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const escortObject = space.missionObjects.find((object) => object.kind === "escort");
    const finalCheckpoint = escortObject.routeCheckpoints[escortObject.routeCheckpoints.length - 1];
    escortObject.routeCheckpointIndex = escortObject.routeCheckpoints.length - 1;
    escortObject.targetX = finalCheckpoint.x;
    escortObject.targetY = finalCheckpoint.y;
    escortObject.root.x = finalCheckpoint.x;
    escortObject.root.y = finalCheckpoint.y;
    space.updateMissionActivity?.(1 / 60);
  });
  state = await snapshot(page);
  assert(state.completedMissionIds.includes("test-escort-distress"), "Escort mission did not complete when transport reached destination");

  await resetToSpace(page, "test-resource-salvage", { live: true });
  state = await snapshot(page);
  assert(state.missionObjects.some((object) => object.kind === "resource"), "Salvage resource did not spawn");
  assert(state.missionObjects.filter((object) => object.kind === "debris").length >= 3, "Salvage debris field did not spawn");
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const resource = space.missionObjects.find((object) => object.kind === "resource");
    space.shipRoot.x = resource.root.x;
    space.shipRoot.y = resource.root.y;
    space.shipVelocity.set(0, 0);
    space.refreshHud?.();
    space.tryCompleteInteractiveMissionStep?.();
    space.updateMissionActivity?.(1 / 60);
    space.refreshHud?.();
  });
  state = await snapshot(page);
  assert(state.activityState?.stepIndex === 1, `Salvage pickup should advance to delivery step: ${JSON.stringify(state.activityState)}`);
  assert(state.cargo.some((item) => item?.tag === "mission-cargo:test-resource-salvage"), "Salvage pickup should place a quest cargo item in inventory");
  assert(state.activeMissionWaypoint?.kind === "comms", `Salvage delivery should target comms/station: ${JSON.stringify(state.activeMissionWaypoint)}`);
  await completeCurrentComms(page);
  state = await snapshot(page);
  assert(state.completedMissionIds.includes("test-resource-salvage"), "Salvage mission did not complete after delivery");
  assert(!state.cargo.some((item) => item?.tag === "mission-cargo:test-resource-salvage"), "Salvage cargo should be removed on delivery");

  await resetToSpace(page, "test-smuggling-run");
  state = await snapshot(page);
  assert(state.missionObjects.some((object) => object.kind === "resource"), "Smuggling cargo cache did not spawn");
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const resource = space.missionObjects.find((object) => object.kind === "resource");
    space.shipRoot.x = resource.root.x;
    space.shipRoot.y = resource.root.y;
    space.shipVelocity.set(0, 0);
    space.refreshHud?.();
    space.tryCompleteInteractiveMissionStep?.();
    space.updateMissionActivity?.(1 / 60);
    space.refreshHud?.();
  });
  state = await snapshot(page);
  assert(state.cargo.some((item) => item?.tag === "mission-cargo:test-smuggling-run"), "Smuggling pickup should place a quest cargo item in inventory");
  await completeCurrentComms(page);
  state = await snapshot(page);
  assert(state.completedMissionIds.includes("test-smuggling-run"), "Smuggling run did not complete after cargo delivery");
  assert(!state.cargo.some((item) => item?.tag === "mission-cargo:test-smuggling-run"), "Smuggling cargo should be removed on delivery");

  await resetToSpace(page, "test-zone-reclaim");
  state = await snapshot(page);
  const zoneBefore = state.war?.contestedZones?.[0] ?? null;
  assert(zoneBefore, `Zone reclaim did not create visible contested state: ${JSON.stringify(state.war)}`);
  assert(state.missionObjects.some((object) => object.role === "zone-defender" && object.factionId === "empire"), "Zone reclaim did not spawn Empire defenders");
  assert(state.missionObjects.filter((object) => object.role === "zone-defender").every((object) => object.usesRealShipVisual), "Zone defenders should use real ship visuals");
  await destroyMissionCombatObjects(page);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    const waypoint = space.getDebugSnapshot().activeMissionWaypoint;
    space.shipRoot.x = waypoint.x;
    space.shipRoot.y = waypoint.y;
    space.shipVelocity.set(0, 0);
    window.__loeSession?.setShipSpacePosition?.(waypoint.x, waypoint.y);
    space.refreshHud?.();
    space.tryCompleteInteractiveMissionStep?.();
  });
  state = await snapshot(page);
  assert(state.completedMissionIds.includes("test-zone-reclaim"), "Zone reclaim did not complete after clearing defenders and stabilizing");
  assert((state.war?.contestedZones ?? []).length === 0, "Zone reclaim should clear contested state after stabilization");

  await resetToSpace(page, "test-kill-target");
  state = await snapshot(page);
  assert(state.missionObjects.some((object) => object.role === "elite-target"), "Marked target did not spawn elite target");
  assert(state.missionObjects.some((object) => object.role === "elite-target" && object.usesRealShipVisual), "Marked target should use real ship visuals");
  await destroyMissionCombatObjects(page);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    for (let i = 0; i < 20; i += 1) {
      space.updateMissionActivity?.(1 / 30);
    }
  });
  state = await snapshot(page);
  assert(state.completedMissionIds.includes("test-kill-target"), "Marked target mission did not complete on target destruction");
  assert(!state.missionObjects.some((object) => object.role === "elite-target"), "Marked target respawned after completion");

  await resetToSpace(page, "test-boss-climax");
  state = await snapshot(page);
  assert(state.missionObjects.some((object) => object.role === "heavy-contact"), "Heavy contact did not spawn command target");
  assert(state.missionObjects.some((object) => object.role === "heavy-contact" && object.usesRealShipVisual), "Heavy contact should use real ship visuals");
  await destroyMissionCombatObjects(page);
  await page.evaluate(() => window.__loeGame?.scene.keys.space?.updateMissionActivity?.(1 / 60));
  state = await snapshot(page);
  assert(state.completedMissionIds.includes("test-boss-climax"), "Heavy contact mission did not complete on command target destruction");

  await resetToSpace(page, "test-chain-dispatch");
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    let waypoint = space.getDebugSnapshot().activeMissionWaypoint;
    space.shipRoot.x = waypoint.x;
    space.shipRoot.y = waypoint.y;
    space.shipVelocity.set(0, 0);
    space.updateMissionActivity?.(1 / 60);
    space.updateMissionActivity?.(1 / 60);
  });
  await completeCurrentComms(page);
  await page.evaluate(() => {
    const space = window.__loeGame?.scene.keys.space;
    let escortObject = space.missionObjects.find((object) => object.kind === "escort");
    space.shipRoot.x = escortObject.root.x;
    space.shipRoot.y = escortObject.root.y;
    space.updateMissionActivity?.(1 / 60);
    escortObject = space.missionObjects.find((object) => object.kind === "escort");
    const finalCheckpoint = escortObject.routeCheckpoints[escortObject.routeCheckpoints.length - 1];
    escortObject.routeCheckpointIndex = escortObject.routeCheckpoints.length - 1;
    escortObject.targetX = finalCheckpoint.x;
    escortObject.targetY = finalCheckpoint.y;
    escortObject.root.x = finalCheckpoint.x;
    escortObject.root.y = finalCheckpoint.y;
    space.updateMissionActivity?.(1 / 60);
  });
  await destroyMissionCombatObjects(page);
  await page.evaluate(() => window.__loeGame?.scene.keys.space?.updateMissionActivity?.(1 / 60));
  state = await snapshot(page);
  assert(state.completedMissionIds.includes("test-chain-dispatch"), `Linked chain did not complete corrected flow: ${JSON.stringify(state)}`);

  const result = {
    contractState,
    consoleErrors,
  };
  await fs.writeFile(path.join(OUTPUT_DIR, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
