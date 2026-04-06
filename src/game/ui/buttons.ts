import Phaser from "phaser";

export type MenuButton = {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  setEnabled: (enabled: boolean) => void;
  setLabel: (label: string) => void;
  setOnClick: (onClick: () => void) => void;
};

type ButtonOptions = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height?: number;
  label: string;
  onClick: () => void;
  depth?: number;
  accentColor?: number;
  disabled?: boolean;
};

export function createMenuButton({
  scene,
  x,
  y,
  width,
  height = 48,
  label,
  onClick,
  depth = 10,
  accentColor = 0x194777,
  disabled = false,
}: ButtonOptions): MenuButton {
  const background = scene.add
    .rectangle(0, 0, width, height, accentColor, disabled ? 0.32 : 0.88)
    .setStrokeStyle(2, 0xaed0ff, disabled ? 0.35 : 0.75);

  const text = scene.add.text(0, 0, label, {
    fontFamily: "Arial",
    fontSize: "18px",
    color: disabled ? "#a7b8cf" : "#f5fbff",
    fontStyle: "bold",
  });
  text.setOrigin(0.5);

  const button = scene.add.container(x, y, [background, text]).setDepth(depth);
  button.setSize(width, height);
  button.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    Phaser.Geom.Rectangle.Contains,
  );

  let enabled = !disabled;

  const refresh = (): void => {
    background.setAlpha(enabled ? 0.88 : 0.32);
    background.setStrokeStyle(2, 0xaed0ff, enabled ? 0.75 : 0.35);
    text.setColor(enabled ? "#f5fbff" : "#a7b8cf");
  };

  refresh();

  button.on("pointerover", () => {
    if (!enabled) {
      return;
    }

    background.setScale(1.02, 1.04);
    background.setFillStyle(0x215a96, 0.96);
  });

  button.on("pointerout", () => {
    background.setScale(1, 1);
    background.setFillStyle(accentColor, enabled ? 0.88 : 0.32);
  });

  let clickHandler = onClick;

  button.on("pointerdown", () => {
    if (!enabled) {
      return;
    }

    clickHandler();
  });

  return {
    container: button,
    label: text,
    setEnabled(nextEnabled: boolean) {
      enabled = nextEnabled;
      background.setFillStyle(accentColor, enabled ? 0.88 : 0.32);
      refresh();
    },
    setLabel(nextLabel: string) {
      text.setText(nextLabel);
    },
    setOnClick(nextHandler: () => void) {
      clickHandler = nextHandler;
    },
  };
}
