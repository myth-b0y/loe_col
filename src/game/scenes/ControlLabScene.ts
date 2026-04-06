import Phaser from "phaser";

type MoveKeys = { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
type Dummy = { body: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text; hp: number };
type Btn = { c: Phaser.GameObjects.Container; ring: Phaser.GameObjects.Arc; status: Phaser.GameObjects.Text; chip: Phaser.GameObjects.Text };
type Star = { dot: Phaser.GameObjects.Arc; nx: number; ny: number };
type Layout = {
  portrait: boolean;
  header: Phaser.Geom.Rectangle;
  arena: Phaser.Geom.Rectangle;
  move: Phaser.Geom.Rectangle;
  aim: Phaser.Geom.Rectangle;
  info: Phaser.Geom.Rectangle;
  toggle: Phaser.Math.Vector2;
  moveStick: Phaser.Math.Vector2;
  aimStick: Phaser.Math.Vector2;
  pulse: Phaser.Math.Vector2;
  dash: Phaser.Math.Vector2;
  banner: Phaser.Math.Vector2;
  mission: Phaser.Math.Vector2;
  spawn: Phaser.Math.Vector2;
  buddy: Phaser.Math.Vector2;
  targets: Phaser.Math.Vector2[];
};

const SPEED = 310;
const STICK_R = 72;
const DEADZONE = 18;
const AIM_DIST = 132;

export class ControlLabScene extends Phaser.Scene {
  private layout?: Layout;
  private touch = false;
  private infoOpen = true;

  private bg!: Phaser.GameObjects.Rectangle;
  private header!: Phaser.GameObjects.Rectangle;
  private arena!: Phaser.GameObjects.Rectangle;
  private moveZone!: Phaser.GameObjects.Rectangle;
  private aimZone!: Phaser.GameObjects.Rectangle;
  private stars: Star[] = [];

  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private mission!: Phaser.GameObjects.Text;

  private player!: Phaser.GameObjects.Arc;
  private facing!: Phaser.GameObjects.Rectangle;
  private buddy!: Phaser.GameObjects.Arc;
  private dummies: Dummy[] = [];

  private moveKeys?: MoveKeys;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyVec = new Phaser.Math.Vector2();
  private moveVec = new Phaser.Math.Vector2();
  private aimVec = new Phaser.Math.Vector2(1, 0);
  private look = new Phaser.Math.Vector2(900, 360);
  private movePointer: number | null = null;
  private aimPointer: number | null = null;

  private moveBase!: Phaser.GameObjects.Arc;
  private moveKnob!: Phaser.GameObjects.Arc;
  private aimBase!: Phaser.GameObjects.Arc;
  private aimKnob!: Phaser.GameObjects.Arc;
  private moveLabel!: Phaser.GameObjects.Text;
  private aimLabel!: Phaser.GameObjects.Text;
  private pulseBtn!: Btn;
  private dashBtn!: Btn;
  private aimLine!: Phaser.GameObjects.Graphics;
  private reticle!: Phaser.GameObjects.Arc;

  private infoBox!: Phaser.GameObjects.Container;
  private infoBg!: Phaser.GameObjects.Rectangle;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoA!: Phaser.GameObjects.Text;
  private infoB!: Phaser.GameObjects.Text;
  private infoClose!: Phaser.GameObjects.Container;
  private infoOpenBtn!: Phaser.GameObjects.Container;

  private pulseCd = 0;
  private dashCd = 0;
  private dashFlash = 0;

  create(): void {
    this.touch = this.sys.game.device.input.touch;
    this.cameras.main.setBackgroundColor("#070b12");
    this.makeBackdrop();
    this.makeActors();
    this.makeHud();
    this.makeTouchUi();
    this.makeDummies();
    this.bindKeyboard();
    this.bindPointers();
    this.applyLayout(this.scale.width, this.scale.height);
    this.updateHud();
    this.scale.on("resize", this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.onResize, this));
  }

  private makeBackdrop(): void {
    this.bg = this.add.rectangle(0, 0, 1, 1, 0x0b1220).setOrigin(0).setDepth(-10);
    this.header = this.add.rectangle(0, 0, 1, 1, 0x0d1729, 0.95).setOrigin(0).setStrokeStyle(2, 0x3e5e93, 1).setDepth(-4);
    this.arena = this.add.rectangle(0, 0, 1, 1, 0x101f38, 0.94).setOrigin(0).setStrokeStyle(4, 0x6ca8ff, 0.7).setDepth(-3);
    this.moveZone = this.add.rectangle(0, 0, 1, 1, 0x0f1b30, 0.42).setOrigin(0).setStrokeStyle(2, 0x355884, 0.7).setDepth(11);
    this.aimZone = this.add.rectangle(0, 0, 1, 1, 0x0f1b30, 0.42).setOrigin(0).setStrokeStyle(2, 0x355884, 0.7).setDepth(11);
    for (let i = 0; i < 65; i += 1) {
      this.stars.push({ dot: this.add.circle(0, 0, Phaser.Math.FloatBetween(1, 2.6), 0xc6ddff, 0.9).setDepth(-9), nx: Phaser.Math.FloatBetween(0.02, 0.98), ny: Phaser.Math.FloatBetween(0.02, 0.98) });
    }
    this.title = this.add.text(0, 0, "Champions of Light - Control Lab", { fontFamily: "Arial", fontSize: "28px", color: "#f3f7ff", fontStyle: "bold" }).setDepth(2);
    this.subtitle = this.add.text(0, 0, "Prototype Goal: desktop + iPhone input", { fontFamily: "Arial", fontSize: "18px", color: "#9fc6ff" }).setDepth(2);
  }

  private makeActors(): void {
    this.player = this.add.circle(0, 0, 20, 0xf2f7ff).setStrokeStyle(4, 0x7caeff, 1).setDepth(5);
    this.facing = this.add.rectangle(0, 0, 34, 8, 0x7ee1ff).setOrigin(0, 0.5).setDepth(6);
    this.buddy = this.add.circle(0, 0, 14, 0xf0cd79).setStrokeStyle(3, 0xffe8a6, 1).setDepth(4);
    this.mission = this.add.text(0, 0, "", { fontFamily: "Arial", fontSize: "20px", color: "#d6e7ff", align: "center" }).setOrigin(0.5).setDepth(4);
  }

  private makeHud(): void {
    this.banner = this.add.text(0, 0, "", { fontFamily: "Arial", fontSize: "18px", color: "#b8d8ff", backgroundColor: "#10213ccc", padding: { x: 14, y: 8 } }).setOrigin(0.5, 0).setDepth(20).setVisible(this.touch);
    this.infoBg = this.add.rectangle(0, 0, 1, 1, 0x08111c, 0.9).setOrigin(0).setStrokeStyle(2, 0x4772aa, 0.9);
    this.infoTitle = this.add.text(0, 0, "Prototype Readout", { fontFamily: "Arial", fontSize: "18px", color: "#f1f7ff", fontStyle: "bold" });
    this.infoA = this.add.text(0, 0, "", { fontFamily: "Arial", fontSize: "16px", color: "#eef4ff", lineSpacing: 6 });
    this.infoB = this.add.text(0, 0, "", { fontFamily: "Arial", fontSize: "16px", color: "#d8e8ff", lineSpacing: 6 });
    this.infoClose = this.makeSmallButton("X", 34, 0x20354f);
    this.infoClose.on("pointerdown", () => this.setInfo(false));
    this.infoBox = this.add.container(0, 0, [this.infoBg, this.infoTitle, this.infoA, this.infoB, this.infoClose]).setDepth(18);
    this.infoOpenBtn = this.makeSmallButton("INFO", 74, 0x163255);
    this.infoOpenBtn.on("pointerdown", () => this.setInfo(true));
    this.infoOpenBtn.setDepth(19);
  }

  private makeTouchUi(): void {
    this.moveBase = this.add.circle(0, 0, STICK_R, 0x173054, 0.36).setStrokeStyle(3, 0x72a8ff, 0.65).setDepth(12);
    this.moveKnob = this.add.circle(0, 0, 34, 0xdde9ff, 0.72).setStrokeStyle(2, 0xffffff, 0.9).setDepth(13);
    this.aimBase = this.add.circle(0, 0, STICK_R, 0x173054, 0.36).setStrokeStyle(3, 0x72a8ff, 0.65).setDepth(12);
    this.aimKnob = this.add.circle(0, 0, 34, 0xdde9ff, 0.72).setStrokeStyle(2, 0xffffff, 0.9).setDepth(13);
    this.moveLabel = this.add.text(0, 0, "MOVE", { fontFamily: "Arial", fontSize: "20px", color: "#9fc6ff", fontStyle: "bold" }).setOrigin(0.5).setDepth(13);
    this.aimLabel = this.add.text(0, 0, "AIM", { fontFamily: "Arial", fontSize: "20px", color: "#9fc6ff", fontStyle: "bold" }).setOrigin(0.5).setDepth(13);
    this.pulseBtn = this.makeActionButton(74, 0x166b8c, "PULSE", "Tap");
    this.dashBtn = this.makeActionButton(56, 0x63408f, "DASH", "Jump");
    this.pulseBtn.c.on("pointerdown", () => this.tryPulse());
    this.dashBtn.c.on("pointerdown", () => this.tryDash());
    this.aimLine = this.add.graphics().setDepth(11);
    this.reticle = this.add.circle(0, 0, 16, 0x7ee1ff, 0.16).setStrokeStyle(3, 0xbef2ff, 0.85).setDepth(12);
    this.showTouchUi(this.touch);
  }

  private makeDummies(): void {
    for (let i = 0; i < 3; i += 1) {
      const body = this.add.circle(0, 0, 22, 0xcc4761).setStrokeStyle(4, 0xffc8d4, 0.9).setDepth(4);
      const label = this.add.text(0, 0, `Target ${i + 1}: 3`, { fontFamily: "Arial", fontSize: "18px", color: "#ffdce4" }).setOrigin(0.5, 0).setDepth(5);
      this.dummies.push({ body, label, hp: 3 });
    }
  }

  private makeActionButton(radius: number, fill: number, name: string, ready: string): Btn {
    const ring = this.add.circle(0, 0, radius, fill, 0.78).setStrokeStyle(4, 0xe7f1ff, 0.95);
    const core = this.add.circle(0, 0, radius - 14, 0x07121d, 0.26).setStrokeStyle(2, 0xffffff, 0.18);
    const label = this.add.text(0, -8, name, { fontFamily: "Arial", fontSize: radius > 60 ? "20px" : "18px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
    const status = this.add.text(0, 18, ready, { fontFamily: "Arial", fontSize: "14px", color: "#d8ebff", fontStyle: "bold" }).setOrigin(0.5);
    const chip = this.add.text(0, radius + 22, name, { fontFamily: "Arial", fontSize: "16px", color: "#b6d5ff", backgroundColor: "#11233bcc", padding: { x: 10, y: 5 } }).setOrigin(0.5);
    const c = this.add.container(0, 0, [ring, core, label, status, chip]).setDepth(14);
    c.setSize(radius * 2, radius * 2);
    c.setInteractive(new Phaser.Geom.Circle(0, 0, radius), Phaser.Geom.Circle.Contains);
    return { c, ring, status, chip };
  }

  private makeSmallButton(label: string, width: number, fill: number): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, width, 32, fill, 0.95).setStrokeStyle(2, 0x8db9ff, 0.8);
    const text = this.add.text(0, 0, label, { fontFamily: "Arial", fontSize: "15px", color: "#f4fbff", fontStyle: "bold" }).setOrigin(0.5);
    const c = this.add.container(0, 0, [bg, text]);
    c.setSize(width, 32);
    c.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -16, width, 32), Phaser.Geom.Rectangle.Contains);
    return c;
  }

  private bindKeyboard(): void {
    const k = this.input.keyboard;
    if (!k) {
      return;
    }
    this.moveKeys = k.addKeys({ up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S, left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D }) as MoveKeys;
    this.cursors = k.createCursorKeys();
    k.on("keydown-SPACE", () => this.tryPulse());
    k.on("keydown-SHIFT", () => this.tryDash());
  }

  private bindPointers(): void {
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.layout) {
        return;
      }
      if (this.touch && !this.overUi(p)) {
        if (this.layout.move.contains(p.x, p.y) && this.movePointer === null) {
          this.movePointer = p.id;
          this.anchorMove(p.x, p.y);
          this.updateMovePointer(p);
          return;
        }
        if (this.layout.aim.contains(p.x, p.y) && this.aimPointer === null) {
          this.aimPointer = p.id;
          this.anchorAim(p.x, p.y);
          this.updateAimPointer(p);
          return;
        }
      }
      if (this.overUi(p)) {
        return;
      }
      this.look.set(p.worldX, p.worldY);
      if (this.touch) {
        this.tryPulse();
        return;
      }
      if (p.rightButtonDown()) {
        this.tryDash();
        return;
      }
      this.tryPulse();
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.id === this.movePointer && p.isDown) {
        this.updateMovePointer(p);
        return;
      }
      if (p.id === this.aimPointer && p.isDown) {
        this.updateAimPointer(p);
        return;
      }
      if (!this.touch) {
        this.look.set(p.worldX, p.worldY);
      }
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.id === this.movePointer) {
        this.movePointer = null;
        this.moveVec.set(0, 0);
        this.resetMove();
      }
      if (p.id === this.aimPointer) {
        this.aimPointer = null;
        this.resetAim();
      }
    });
  }

  private onResize(size: Phaser.Structs.Size): void {
    this.applyLayout(size.width, size.height);
    this.updateHud();
  }

  private applyLayout(w: number, h: number): void {
    const last = this.layout;
    this.layout = this.calcLayout(w, h);
    const l = this.layout;
    this.bg.setSize(w, h);
    this.header.setPosition(l.header.x, l.header.y).setSize(l.header.width, l.header.height);
    this.arena.setPosition(l.arena.x, l.arena.y).setSize(l.arena.width, l.arena.height);
    this.moveZone.setPosition(l.move.x, l.move.y).setSize(l.move.width, l.move.height).setVisible(this.touch);
    this.aimZone.setPosition(l.aim.x, l.aim.y).setSize(l.aim.width, l.aim.height).setVisible(this.touch);
    this.stars.forEach((s) => s.dot.setPosition(w * s.nx, h * s.ny));
    this.title.setPosition(l.header.x + 18, l.header.y + 14).setFontSize(l.portrait ? "22px" : "28px");
    this.subtitle.setPosition(l.header.x + 18, l.header.y + (l.portrait ? 42 : 44)).setFontSize(l.portrait ? "15px" : "18px");
    this.banner.setPosition(l.banner.x, l.banner.y).setFontSize(l.portrait ? "14px" : "18px");
    this.mission.setPosition(l.mission.x, l.mission.y).setFontSize(l.portrait ? "16px" : "20px").setWordWrapWidth(l.arena.width - 36);
    if (!last) {
      this.player.setPosition(l.spawn.x, l.spawn.y);
      this.look.set(l.spawn.x + AIM_DIST, l.spawn.y);
    } else {
      this.player.setPosition(Phaser.Math.Clamp(this.player.x, l.arena.x + 22, l.arena.right - 22), Phaser.Math.Clamp(this.player.y, l.arena.y + 22, l.arena.bottom - 22));
    }
    this.buddy.setPosition(this.player.x + l.buddy.x, this.player.y + l.buddy.y);
    this.dummies.forEach((d, i) => {
      d.body.setPosition(l.targets[i].x, l.targets[i].y);
      d.label.setPosition(l.targets[i].x, l.targets[i].y + 38).setFontSize(l.portrait ? "15px" : "18px");
    });
    this.layoutInfo();
    if (this.movePointer === null) {
      this.resetMove();
    }
    if (this.aimPointer === null) {
      this.resetAim();
    }
    this.updateTouchUi();
  }

  private calcLayout(w: number, h: number): Layout {
    const portrait = h > w;
    const m = portrait ? 16 : 24;
    const header = new Phaser.Geom.Rectangle(m, m, Math.max(240, w - m * 2), portrait ? 72 : 68);
    const arenaTop = header.bottom + 12;
    const wantControls = this.touch ? (portrait ? 300 : 210) : 0;
    const minArena = portrait ? 300 : 320;
    const minControls = this.touch ? (portrait ? 250 : 170) : 0;
    const below = h - arenaTop - m;
    let controls = wantControls;
    let arenaH = below - controls;
    if (this.touch && arenaH < minArena) {
      controls = Math.max(minControls, below - minArena);
      arenaH = below - controls;
    }
    if (!this.touch) {
      arenaH = Math.max(280, below);
    }
    arenaH = Math.max(240, arenaH);
    const arena = new Phaser.Geom.Rectangle(m, arenaTop, Math.max(260, w - m * 2), Math.min(arenaH, h - arenaTop - m));
    const controlTop = arena.bottom + 14;
    const controlH = Math.max(160, h - controlTop - m);
    const move = this.touch ? new Phaser.Geom.Rectangle(m, controlTop, portrait ? Math.max(148, w * 0.42) : 250, controlH) : new Phaser.Geom.Rectangle(0, 0, 0, 0);
    const aimW = portrait ? Math.max(204, w * 0.48) : 340;
    const aim = this.touch ? new Phaser.Geom.Rectangle(portrait ? w - aimW - m : w - 340 - m, controlTop, aimW, controlH) : new Phaser.Geom.Rectangle(0, 0, 0, 0);
    const infoW = Math.min(portrait ? w - m * 2 : 360, w - m * 2);
    const info = new Phaser.Geom.Rectangle(w - infoW - m, header.bottom + 14, infoW, portrait ? 176 : 196);
    return {
      portrait,
      header,
      arena,
      move,
      aim,
      info,
      toggle: new Phaser.Math.Vector2(w - m - 44, header.bottom + 20),
      moveStick: new Phaser.Math.Vector2(move.centerX, move.bottom - 76),
      aimStick: new Phaser.Math.Vector2(aim.centerX, aim.bottom - 76),
      pulse: new Phaser.Math.Vector2(aim.x + aim.width * (portrait ? 0.34 : 0.28), aim.bottom - 78),
      dash: new Phaser.Math.Vector2(aim.right - (portrait ? 72 : 82), aim.y + (portrait ? 82 : 78)),
      banner: new Phaser.Math.Vector2(header.centerX, header.y + 10),
      mission: new Phaser.Math.Vector2(arena.centerX, arena.bottom - 24),
      spawn: new Phaser.Math.Vector2(arena.x + arena.width * 0.18, arena.centerY),
      buddy: new Phaser.Math.Vector2(portrait ? -42 : -56, portrait ? 42 : 56),
      targets: [
        new Phaser.Math.Vector2(arena.x + arena.width * 0.70, arena.y + arena.height * 0.28),
        new Phaser.Math.Vector2(arena.x + arena.width * 0.82, arena.y + arena.height * 0.50),
        new Phaser.Math.Vector2(arena.x + arena.width * 0.62, arena.y + arena.height * 0.72),
      ],
    };
  }

  update(_time: number, dtMs: number): void {
    const dt = dtMs / 1000;
    this.pulseCd = Math.max(0, this.pulseCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.dashFlash = Math.max(0, this.dashFlash - dt * 3);
    this.updateKeys();
    this.movePlayer(dt);
    this.faceAim();
    this.moveBuddy(dt);
    this.updateTouchUi();
    this.updateHud();
  }

  private updateKeys(): void {
    this.keyVec.set(0, 0);
    const left = this.moveKeys?.left.isDown || this.cursors?.left.isDown;
    const right = this.moveKeys?.right.isDown || this.cursors?.right.isDown;
    const up = this.moveKeys?.up.isDown || this.cursors?.up.isDown;
    const down = this.moveKeys?.down.isDown || this.cursors?.down.isDown;
    if (left) { this.keyVec.x -= 1; }
    if (right) { this.keyVec.x += 1; }
    if (up) { this.keyVec.y -= 1; }
    if (down) { this.keyVec.y += 1; }
    if (this.keyVec.lengthSq() > 0) { this.keyVec.normalize(); }
  }

  private movePlayer(dt: number): void {
    if (!this.layout) { return; }
    const v = this.moveVec.lengthSq() > 0.01 ? this.moveVec : this.keyVec;
    this.player.x = Phaser.Math.Clamp(this.player.x + v.x * SPEED * dt, this.layout.arena.x + 22, this.layout.arena.right - 22);
    this.player.y = Phaser.Math.Clamp(this.player.y + v.y * SPEED * dt, this.layout.arena.y + 22, this.layout.arena.bottom - 22);
    this.player.setFillStyle(this.dashFlash > 0 ? 0xffffff : 0xf2f7ff, 1);
  }

  private faceAim(): void {
    const dir = this.touch ? this.aimVec.clone().normalize() : new Phaser.Math.Vector2(this.look.x - this.player.x, this.look.y - this.player.y).normalize();
    if (!Number.isFinite(dir.x) || !Number.isFinite(dir.y) || dir.lengthSq() === 0) { dir.set(1, 0); }
    const rx = this.player.x + dir.x * AIM_DIST;
    const ry = this.player.y + dir.y * AIM_DIST;
    this.look.set(rx, ry);
    this.facing.setPosition(this.player.x + dir.x * 26, this.player.y + dir.y * 26).setRotation(dir.angle());
    this.reticle.setPosition(rx, ry);
    this.aimLine.clear().lineStyle(3, 0x7ee1ff, 0.32).beginPath().moveTo(this.player.x, this.player.y).lineTo(rx, ry).strokePath();
  }

  private moveBuddy(dt: number): void {
    if (!this.layout) { return; }
    const sx = this.player.x + this.layout.buddy.x;
    const sy = this.player.y + this.layout.buddy.y;
    const t = 1 - Math.exp(-dt * 7);
    this.buddy.x = Phaser.Math.Linear(this.buddy.x, sx, t);
    this.buddy.y = Phaser.Math.Linear(this.buddy.y, sy, t);
  }

  private layoutInfo(): void {
    if (!this.layout) { return; }
    const l = this.layout;
    const fs = l.portrait ? "14px" : "16px";
    this.infoBg.setPosition(l.info.x, l.info.y).setSize(l.info.width, l.info.height);
    this.infoTitle.setPosition(l.info.x + 14, l.info.y + 12).setFontSize(l.portrait ? "16px" : "18px");
    this.infoA.setPosition(l.info.x + 14, l.info.y + 40).setFontSize(fs).setWordWrapWidth(l.info.width - 28);
    this.infoB.setPosition(l.info.x + 14, l.info.y + (l.portrait ? 104 : 116)).setFontSize(fs).setWordWrapWidth(l.info.width - 28);
    this.infoClose.setPosition(l.info.right - 24, l.info.y + 18);
    this.infoOpenBtn.setPosition(l.toggle.x, l.toggle.y);
  }

  private setInfo(open: boolean): void {
    this.infoOpen = open;
    this.infoBox.setVisible(open);
    this.infoOpenBtn.setVisible(!open);
  }

  private updateHud(): void {
    if (!this.layout) { return; }
    const left = this.touch ? "left stick" : "WASD";
    const right = this.touch ? "right stick" : "mouse";
    const targets = this.dummies.filter((d) => d.hp > 0).length;
    const a = this.layout.portrait
      ? [`Input: ${this.touch ? "touch" : "desktop"}`, `Move: ${left}`, `Aim: ${right}`, "Blue = Pulse"]
      : ["Phase 0 foundation", "Responsive browser build", `Move: ${left}`, `Aim: ${right}`, "Blue = Pulse"];
    const b = this.layout.portrait
      ? [`Targets: ${targets}`, `Pulse: ${this.pulseCd <= 0 ? "ready" : `${this.pulseCd.toFixed(1)}s`}`, `Dash: ${this.dashCd <= 0 ? "ready" : `${this.dashCd.toFixed(1)}s`}`, "Purple = Dash"]
      : [`Targets: ${targets}`, `Pulse: ${this.pulseCd <= 0 ? "ready" : `${this.pulseCd.toFixed(1)}s`}`, `Dash: ${this.dashCd <= 0 ? "ready" : `${this.dashCd.toFixed(1)}s`}`, "X hides this box"];
    this.infoA.setText(a);
    this.infoB.setText(b);
    this.layoutInfo();
    this.setInfo(this.infoOpen);
    this.banner.setText(this.touch ? "Portrait-ready test: left stick moves, right stick aims, blue = Pulse, purple = Dash." : "");
  }

  private updateTouchUi(): void {
    if (!this.layout || !this.touch) { return; }
    this.moveLabel.setPosition(this.moveBase.x, this.moveBase.y - 92);
    this.aimLabel.setPosition(this.aimBase.x, this.aimBase.y - 92);
    this.pulseBtn.c.setPosition(this.layout.pulse.x, this.layout.pulse.y);
    this.dashBtn.c.setPosition(this.layout.dash.x, this.layout.dash.y);
    this.setBtn(this.pulseBtn, this.pulseCd, "Tap", 0x166b8c);
    this.setBtn(this.dashBtn, this.dashCd, "Jump", 0x63408f);
  }

  private setBtn(btn: Btn, cd: number, ready: string, color: number): void {
    const ok = cd <= 0;
    btn.c.setScale(ok ? 1 : 0.96);
    btn.ring.setFillStyle(color, ok ? 0.8 : 0.42);
    btn.status.setText(ok ? ready : `${cd.toFixed(1)}s`).setColor(ok ? "#d8ebff" : "#ffd8a8");
    btn.chip.setAlpha(ok ? 1 : 0.75);
  }

  private updateMovePointer(p: Phaser.Input.Pointer): void {
    const dx = p.x - this.moveBase.x;
    const dy = p.y - this.moveBase.y;
    const v = new Phaser.Math.Vector2(dx, dy);
    const d = v.length();
    if (d > STICK_R) { v.normalize().scale(STICK_R); }
    this.moveKnob.setPosition(this.moveBase.x + v.x, this.moveBase.y + v.y);
    if (d <= DEADZONE) { this.moveVec.set(0, 0); return; }
    const s = Phaser.Math.Clamp((Math.min(d, STICK_R) - DEADZONE) / (STICK_R - DEADZONE), 0, 1);
    this.moveVec.set(v.x, v.y).normalize().scale(s);
  }

  private updateAimPointer(p: Phaser.Input.Pointer): void {
    const dx = p.x - this.aimBase.x;
    const dy = p.y - this.aimBase.y;
    const v = new Phaser.Math.Vector2(dx, dy);
    const d = v.length();
    if (d > STICK_R) { v.normalize().scale(STICK_R); }
    this.aimKnob.setPosition(this.aimBase.x + v.x, this.aimBase.y + v.y);
    if (d <= DEADZONE) { return; }
    this.aimVec.set(v.x, v.y).normalize();
  }

  private tryPulse(): void {
    if (this.pulseCd > 0) { return; }
    this.pulseCd = 0.45;
    this.cameras.main.shake(90, 0.0015);
    const ring = this.add.circle(this.player.x, this.player.y, 24).setStrokeStyle(6, 0x7fe3ff, 0.95).setDepth(15);
    this.tweens.add({ targets: ring, scale: 5.2, alpha: 0, duration: 220, onComplete: () => ring.destroy() });
    this.mission.setText("Pulse cast. This will evolve into color-based abilities.");
    this.dummies.forEach((d, i) => {
      if (d.hp <= 0) { return; }
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, d.body.x, d.body.y) > 170) { return; }
      d.hp -= 1;
      d.body.setFillStyle(d.hp > 0 ? 0xff8aa2 : 0x43617f, 1);
      d.label.setText(`Target ${i + 1}: ${Math.max(d.hp, 0)}`);
      this.tweens.add({ targets: d.body, scaleX: 1.25, scaleY: 1.25, yoyo: true, duration: 90 });
    });
  }

  private tryDash(): void {
    if (!this.layout || this.dashCd > 0) { return; }
    this.dashCd = 1.2;
    this.dashFlash = 0.18;
    const d = this.moveVec.lengthSq() > 0.01 ? this.moveVec.clone() : this.keyVec.lengthSq() > 0.01 ? this.keyVec.clone() : this.touch ? this.aimVec.clone() : new Phaser.Math.Vector2(this.look.x - this.player.x, this.look.y - this.player.y);
    if (d.lengthSq() === 0) { d.set(1, 0); } else { d.normalize(); }
    this.player.x = Phaser.Math.Clamp(this.player.x + d.x * 120, this.layout.arena.x + 22, this.layout.arena.right - 22);
    this.player.y = Phaser.Math.Clamp(this.player.y + d.y * 120, this.layout.arena.y + 22, this.layout.arena.bottom - 22);
    const trail = this.add.rectangle(this.player.x, this.player.y, 56, 24, 0xbcb2ff, 0.42).setDepth(3);
    trail.setRotation(d.angle());
    this.tweens.add({ targets: trail, alpha: 0, scaleX: 1.8, duration: 180, onComplete: () => trail.destroy() });
    this.cameras.main.flash(90, 118, 94, 182, false);
    this.mission.setText("Dash used. Mobility and readability are both feeling points.");
  }

  private anchorMove(x: number, y: number): void {
    if (!this.layout) { return; }
    this.moveBase.setPosition(Phaser.Math.Clamp(x, this.layout.move.x + 84, this.layout.move.right - 84), Phaser.Math.Clamp(y, this.layout.move.y + 94, this.layout.move.bottom - 76));
    this.moveBase.setFillStyle(0x173054, 0.52);
    this.moveKnob.setPosition(this.moveBase.x, this.moveBase.y);
  }

  private resetMove(): void {
    if (!this.layout) { return; }
    this.moveBase.setPosition(this.layout.moveStick.x, this.layout.moveStick.y).setFillStyle(0x173054, 0.36);
    this.moveKnob.setPosition(this.layout.moveStick.x, this.layout.moveStick.y);
  }

  private anchorAim(x: number, y: number): void {
    if (!this.layout) { return; }
    this.aimBase.setPosition(Phaser.Math.Clamp(x, this.layout.aim.x + 84, this.layout.aim.right - 84), Phaser.Math.Clamp(y, this.layout.aim.y + 94, this.layout.aim.bottom - 76));
    this.aimBase.setFillStyle(0x173054, 0.52);
    this.aimKnob.setPosition(this.aimBase.x, this.aimBase.y);
  }

  private resetAim(): void {
    if (!this.layout) { return; }
    this.aimBase.setPosition(this.layout.aimStick.x, this.layout.aimStick.y).setFillStyle(0x173054, 0.36);
    this.aimKnob.setPosition(this.layout.aimStick.x, this.layout.aimStick.y);
  }

  private showTouchUi(show: boolean): void {
    this.moveZone.setVisible(show);
    this.aimZone.setVisible(show);
    this.moveBase.setVisible(show);
    this.moveKnob.setVisible(show);
    this.aimBase.setVisible(show);
    this.aimKnob.setVisible(show);
    this.moveLabel.setVisible(show);
    this.aimLabel.setVisible(show);
    this.pulseBtn.c.setVisible(show);
    this.dashBtn.c.setVisible(show);
    this.reticle.setVisible(show);
    this.aimLine.setVisible(show);
  }

  private overUi(p: Phaser.Input.Pointer): boolean {
    return this.pulseBtn.c.getBounds().contains(p.x, p.y)
      || this.dashBtn.c.getBounds().contains(p.x, p.y)
      || this.infoClose.getBounds().contains(p.x, p.y)
      || this.infoOpenBtn.getBounds().contains(p.x, p.y);
  }
}
