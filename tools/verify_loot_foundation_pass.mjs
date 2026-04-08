import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/loot-foundation-pass");
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

  const titleSnapshot = await page.evaluate(() => {
    const scene = window.__loeGame.scene.keys["main-menu"];
    const findText = (label) => scene.children.list.find((entry) => entry.text === label);
    const ip = findText("LoE");
    const series = findText("Pocket Legends:");
    const title = findText("The Circle of Light");
    const tagline = findText("Age of Legends tactical action RPG prototype");
    return {
      ipY: ip?.y ?? null,
      seriesY: series?.y ?? null,
      titleY: title?.y ?? null,
      taglineY: tagline?.y ?? null,
    };
  });
  await page.screenshot({
    path: path.join(outputDir, "main-menu-title.png"),
    fullPage: true,
  });

  const emptyLoadoutState = await page.evaluate(() => {
    window.__loeSession.startNewGame(0);
    window.__loeGame.scene.start("hub");
    const equipment = window.__loeSession.getEquipmentLoadout();
    const cargo = window.__loeSession.getCargoSlots();
    return {
      equippedCount: Object.values(equipment).filter(Boolean).length,
      cargoCount: cargo.filter(Boolean).length,
      raceId: window.__loeSession.getPlayerRaceId(),
      combatProfile: window.__loeSession.getPlayerCombatProfile(),
    };
  });
  await waitForScene(page, "hub");

  const rewardState = await page.evaluate(() => {
    window.__loeSession.acceptMission("ember-watch");
    window.__loeSession.setSelectedMission("ember-watch");
    const hub = window.__loeGame.scene.keys.hub;
    hub.deployAcceptedMission();
    return {
      accepted: window.__loeSession.getAcceptedMissionIds(),
      active: window.__loeSession.getSelectedMissionId(),
    };
  });
  await waitForScene(page, "mission");
  await page.waitForTimeout(200);

  const missionRewardPreview = await page.evaluate(() => {
    const mission = window.__loeGame.scene.keys.mission;
    mission.missionCreditsEarned = 46;
    mission.missionMaterialsEarned = { alloy: 2, shardDust: 1, filament: 1 };
    mission.finishMission();
    return { missionId: mission.mission.id, difficulty: mission.mission.difficulty };
  });

  await waitForScene(page, "mission-result");
  await page.waitForTimeout(200);
  const missionResultState = await page.evaluate(() => {
    const scene = window.__loeGame.scene.keys["mission-result"];
    return scene.getDebugSnapshot();
  });
  await page.screenshot({
    path: path.join(outputDir, "mission-result.png"),
    fullPage: true,
  });

  await page.evaluate(() => {
    window.__loeGame.scene.keys["mission-result"].returnToShip();
  });
  await waitForScene(page, "hub");
  await page.waitForTimeout(250);

  const postMissionState = await page.evaluate(() => {
    const cargo = window.__loeSession.getCargoSlots().filter(Boolean);
    const profile = window.__loeSession.getPlayerCombatProfile();
    const beltIndex = window.__loeSession.getCargoSlots().findIndex((item) => item?.slot === "belt");
    if (beltIndex >= 0) {
      window.__loeSession.equipCargoItemToSlot(beltIndex, "belt");
    }
    return {
      cargoNames: cargo.map((item) => item.name),
      crafting: window.__loeSession.getCraftingMaterials(),
      preEquipShield: profile.shieldCapacity,
      postEquipShield: window.__loeSession.getPlayerCombatProfile().shieldCapacity,
      weaponSummary: window.__loeSession.saveData.loadout.weapon,
    };
  });

  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify(
      {
        titleSnapshot,
        emptyLoadoutState,
        rewardState,
        missionRewardPreview,
        missionResultState,
        postMissionState,
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
