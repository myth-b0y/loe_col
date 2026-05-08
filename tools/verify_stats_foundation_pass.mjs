import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("output/web-game/stats-foundation-pass");
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto("http://127.0.0.1:4173/?renderer=canvas", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await waitForScene(page, "main-menu");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await waitForScene(page, "main-menu");

  const statsProbe = await page.evaluate(() => {
    const session = window.__loeSession;
    session.startNewGame(0);

    const before = session.getPlayerCharacterStats();
    const testGear = {
      instanceId: "verify-stat-blade",
      kind: "gear",
      templateId: "verify-stat-blade",
      name: "Verifier Stat Blade",
      shortLabel: "Stat Blade",
      description: "Verifier equipment item for stat foundation testing.",
      category: "weapon",
      slot: "rightHand",
      rarity: "Rare",
      color: 0x70c4ff,
      raceTag: "olydran",
      stats: {
        power: 10,
        vitality: 5,
        focus: 4,
        shieldCapacity: 3,
        shieldRecovery: 2,
        haste: 2,
      },
      perks: [],
    };

    session.saveData.loadout.cargo[0] = testGear;
    const equipped = session.equipCargoItemToSlot(0, "rightHand");
    const afterEquip = session.getPlayerCharacterStats();
    const combatAfterEquip = session.getPlayerCombatProfile();
    const unequipped = session.unequipItemFromSlot("rightHand");
    const afterUnequip = session.getPlayerCharacterStats();

    const rook = session.getCompanionStats("rook");
    const lyra = session.getCompanionStats("lyra");

    const shipBefore = session.getShipStats();
    const previousWeaponMount = session.getShipComponentLoadout().weaponMount;
    const installed = session.installShipComponent("weaponMount", {
      id: "verify-heavy-mount",
      slot: "weaponMount",
      name: "Verifier Heavy Mount",
      shortLabel: "Heavy Mount",
      description: "Verifier ship component.",
      stats: { weaponPower: 30, speed: 5 },
      tags: ["offense", "verify"],
    });
    const shipAfterInstall = session.getShipStats();
    session.installShipComponent("weaponMount", previousWeaponMount);
    const shipAfterRestore = session.getShipStats();

    return {
      baseline: before.total,
      afterEquip: afterEquip.total,
      equipmentDelta: afterEquip.equipment,
      afterUnequip: afterUnequip.total,
      equipped,
      unequipped,
      combatAfterEquip,
      rook: rook?.total ?? null,
      lyra: lyra?.total ?? null,
      shipBefore: shipBefore.total,
      shipAfterInstall: shipAfterInstall.total,
      shipAfterRestore: shipAfterRestore.total,
      installed,
      playerSummary: session.getPlayerStatSummary(),
      shipSummary: session.getShipStatSummary(),
    };
  });

  assert(statsProbe.baseline.health === 120, "Level 1 knight baseline health should be 120.");
  assert(statsProbe.baseline.resonance === 100, "Level 1 knight baseline resonance should be 100.");
  assert(statsProbe.baseline.power === 18, "Level 1 knight baseline power should be 18.");
  assert(statsProbe.equipped, "Verifier gear should equip from cargo.");
  assert(statsProbe.afterEquip.power > statsProbe.baseline.power, "Equipped gear should increase real power.");
  assert(statsProbe.afterEquip.health > statsProbe.baseline.health, "Equipped gear should increase real health.");
  assert(statsProbe.afterEquip.shield > statsProbe.baseline.shield, "Equipped gear should increase real shield.");
  assert(statsProbe.combatAfterEquip.maxHp === Math.round(statsProbe.afterEquip.health), "Combat adapter should derive HP from real character stats.");
  assert(statsProbe.unequipped, "Verifier gear should unequip.");
  assert(statsProbe.afterUnequip.power === statsProbe.baseline.power, "Unequipping gear should revert power.");
  assert(statsProbe.rook?.health > statsProbe.baseline.health * 0.8, "Companion tank stats should resolve through the character stat framework.");
  assert(statsProbe.lyra?.healingPower > statsProbe.rook?.healingPower, "Healer companion should have higher healing power than tank.");
  assert(statsProbe.shipBefore.hull > 100, "Default ship components should modify real hull.");
  assert(statsProbe.installed, "Verifier ship component should install.");
  assert(statsProbe.shipAfterInstall.weaponPower > statsProbe.shipBefore.weaponPower, "Installed ship component should increase real weapon power.");
  assert(statsProbe.shipAfterRestore.weaponPower === statsProbe.shipBefore.weaponPower, "Restoring previous ship component should restore weapon power.");
  assert(statsProbe.playerSummary.some((line) => line.includes("Res ")), "Player stat summary should expose resonance.");
  assert(statsProbe.shipSummary.some((line) => line.includes("Reactor")), "Ship stat summary should expose reactor stats.");

  await page.evaluate(() => {
    window.__loeGame.scene.start("hub");
  });
  await waitForScene(page, "hub");
  await page.waitForTimeout(300);
  await page.keyboard.press("i");
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outputDir, "inventory-stats.png"), fullPage: true });
  await page.mouse.click(1080, 170);
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outputDir, "starship-stats.png"), fullPage: true });

  fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(statsProbe, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
