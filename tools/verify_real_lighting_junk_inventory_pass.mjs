import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/real-lighting-junk-inventory-pass");
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
  const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://127.0.0.1:4173/?renderer=canvas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
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

  const missionState = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.clearEnemies();
    mission.clearBullets();
    mission.worldPickups.forEach((pickup) => {
      pickup.sprite.destroy();
      pickup.halo.destroy();
      pickup.light.destroy();
      pickup.shadow.destroy();
      pickup.promptText.destroy();
    });
    mission.worldPickups = [];
    mission.missionCreditsEarned = 0;
    mission.missionItemsEarned = [];
    mission.player.x = mission.playArea.centerX - 120;
    mission.player.y = mission.playArea.centerY;

    const makeJunk = (templateId, name, shortLabel, description, rarity, color, maxStack, stackCount) => ({
      kind: "junk",
      templateId,
      instanceId: `${templateId}-${stackCount}-${Math.random().toString(16).slice(2)}`,
      name,
      shortLabel,
      description,
      rarity,
      color,
      maxStack,
      stackCount,
    });

    mission.spawnItemPickup(
      mission.player.x + 96,
      mission.player.y - 24,
      makeJunk(
        "alloy-scrap",
        "Alloy Scrap",
        "Alloy Scrap",
        "Bent structural fragments and salvage-grade plating for future forging work.",
        "Common",
        0x63d77b,
        25,
        3,
      ),
    );
    mission.spawnItemPickup(
      mission.player.x + 132,
      mission.player.y + 18,
      makeJunk(
        "alloy-scrap",
        "Alloy Scrap",
        "Alloy Scrap",
        "Bent structural fragments and salvage-grade plating for future forging work.",
        "Common",
        0x63d77b,
        25,
        5,
      ),
    );
    mission.spawnBossLootDrops(mission.player.x + 214, mission.player.y + 8);
    mission.spawnBullet(mission.player.x + 26, mission.player.y - 6, mission.aimVector.clone(), 0, 0, 7, "player", 0x7ee1ff);
    mission.spawnShieldSpark(mission.player.x + 36, mission.player.y + 12, 0x6cdcff, 0.55);
    mission.spawnStatusSigil(mission.player.x - 12, mission.player.y - 48, 0x7ef5ff, "heal");
    mission.updateLightingState();

    const junkPickups = mission.worldPickups.filter((pickup) => pickup.item?.kind === "junk");
    junkPickups.forEach((pickup) => {
      mission.player.x = pickup.baseX;
      mission.player.y = pickup.baseY;
      mission.tryMissionInteract();
    });

    const gearPickup = mission.worldPickups.find((pickup) => pickup.item?.kind === "gear");
    if (gearPickup) {
      mission.player.x = gearPickup.baseX;
      mission.player.y = gearPickup.baseY;
      mission.tryMissionInteract();
    }

    const snapshot = mission.getMissionInventorySnapshot();
    const stackedJunk = snapshot.cargo.find((item) => item?.kind === "junk" && item.templateId === "alloy-scrap");
    const gearIndex = snapshot.cargo.findIndex((item) => item?.kind === "gear");
    const gearName = gearIndex >= 0 ? snapshot.cargo[gearIndex]?.name ?? null : null;

    return {
      lightingSupported: Boolean(mission.lightingRig?.supported),
      missionShadowSourceCount: mission.missionShadowSources.length,
      pickupBanner: mission.pickupBannerText?.text ?? null,
      stackedJunkCount: stackedJunk?.stackCount ?? null,
      gearName,
      gearIndex,
    };
  });

  await page.screenshot({ path: path.join(outputDir, "mission-lighting.png"), fullPage: true });

  await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.extractMissionLootToShip();
    window.__loeGame.scene.stop("mission");
    window.__loeGame.scene.start("hub");
  });
  await page.waitForTimeout(250);

  await waitForScene(page, "hub");
  await page.waitForTimeout(350);
  const hubLightingState = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.updateHubLighting();
    return {
      lightingSupported: Boolean(hub.lightingRig?.supported),
      casterCount: hub.hubShadowCasters.length,
      sourceCount: hub.hubShadowSources.length,
      ambientLights: hub.ambientLights.length,
      stationLights: hub.stations.map((station) => ({
        id: station.id,
        x: Math.round(station.zone.x),
        y: Math.round(station.zone.y),
      })),
    };
  });
  await page.screenshot({ path: path.join(outputDir, "hub-lighting.png"), fullPage: true });

  const inventoryCoordinates = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    hub.openStation("loadout");
    const overlay = hub.inventoryOverlay;
    const gearIndex = overlay.currentSnapshot.cargo.findIndex((item) => item?.kind === "gear");
    overlay.onCargoCellClicked(gearIndex);
    const gearCell = overlay.cargoCells[gearIndex];
    return {
      gearIndex,
      gearCellX: gearCell.frame.x,
      gearCellY: gearCell.frame.y,
      actionVisible: overlay.actionMenu.visible,
      actionLabel: overlay.actionPrimary.label.text,
      primaryX: overlay.actionPrimary.container.x,
      primaryY: overlay.actionPrimary.container.y,
    };
  });
  const actionMenuState = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    const overlay = hub.inventoryOverlay;
    return {
      visible: overlay.actionMenu.visible,
      label: overlay.actionPrimary.label.text,
      title: overlay.actionTitle.text,
    };
  });
  await page.screenshot({ path: path.join(outputDir, "inventory-action-menu.png"), fullPage: true });

  await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    const overlay = hub.inventoryOverlay;
    overlay.runActionMenuPrimary();
  });
  await page.waitForTimeout(100);
  const equippedState = await page.evaluate(() => {
    const session = window.__loeSession;
    const equipment = session.getEquipmentLoadout();
    const cargo = session.getCargoSlots();
    const equippedSlots = Object.entries(equipment)
      .filter(([, item]) => item !== null)
      .map(([slotId, item]) => ({ slotId, name: item.name }));
    return {
      equippedSlots,
      cargoLabels: cargo.filter(Boolean).map((item) => item.shortLabel ?? item.name),
    };
  });

  const filledSlot = await page.evaluate(() => {
    const hub = window.__loeGame.scene.keys.hub;
    const overlay = hub.inventoryOverlay;
    const filledSlot = overlay.equipmentSlots.find((slot) => overlay.currentSnapshot.equipment[slot.slotId] !== null);
    if (!filledSlot) {
      return null;
    }

    overlay.onEquipmentSlotClicked(filledSlot.slotId);
    return {
      x: filledSlot.frame.x,
      y: filledSlot.frame.y,
      actionVisible: overlay.actionMenu.visible,
      actionLabel: overlay.actionPrimary.label.text,
    };
  });
  if (filledSlot) {
    await page.evaluate(() => {
      const hub = window.__loeGame.scene.keys.hub;
      hub.inventoryOverlay.runActionMenuPrimary();
    });
    await page.waitForTimeout(80);
  }
  const unequippedState = await page.evaluate(() => {
    const session = window.__loeSession;
    const equipment = session.getEquipmentLoadout();
    const cargo = session.getCargoSlots();
    return {
      equippedCount: Object.values(equipment).filter(Boolean).length,
      cargoCount: cargo.filter(Boolean).length,
      cargoLabels: cargo.filter(Boolean).map((item) => item.shortLabel ?? item.name),
    };
  });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify({ missionState, hubLightingState, actionMenuState, equippedState, unequippedState }, null, 2),
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
