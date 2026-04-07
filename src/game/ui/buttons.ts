import Phaser from "phaser";

export type MenuButton = {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  setEnabled: (enabled: boolean) => void;
  setInputEnabled: (enabled: boolean) => void;
  setLabel: (label: string) => void;
  setOnClick: (onClick: () => void) => void;
  setCooldownProgress: (progress: number) => void;
};

type ButtonOptions = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height?: number;
  label: string;
  onClick: () => void;
  onPress?: (pointer: Phaser.Input.Pointer) => void;
  onRelease?: (pointer: Phaser.Input.Pointer) => void;
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
  onPress,
  onRelease,
  depth = 10,
  accentColor = 0x194777,
  disabled = false,
}: ButtonOptions): MenuButton {
  const background = scene.add
    .rectangle(0, 0, width, height, accentColor, disabled ? 0.32 : 0.88)
    .setStrokeStyle(2, 0xaed0ff, disabled ? 0.35 : 0.75);
  background.setInteractive({ useHandCursor: true });

  const cooldownOverlay = scene.add.rectangle(0, -height / 2 + 3, width - 6, height - 6, 0x03070d, 0.42)
    .setOrigin(0.5, 0)
    .setVisible(false);

  const text = scene.add.text(0, 0, label, {
    fontFamily: "Arial",
    fontSize: "18px",
    color: disabled ? "#a7b8cf" : "#f5fbff",
    fontStyle: "bold",
  });
  text.setOrigin(0.5);

  const button = scene.add.container(x, y, [background, cooldownOverlay, text]).setDepth(depth);
  button.setSize(width, height);

  let enabled = !disabled;
  let inputEnabled = true;

  const refresh = (): void => {
    background.setAlpha(enabled ? 0.88 : 0.32);
    background.setStrokeStyle(2, 0xaed0ff, enabled ? 0.75 : 0.35);
    text.setColor(enabled ? "#f5fbff" : "#a7b8cf");
    if (background.input) {
      background.input.enabled = enabled && inputEnabled;
    }
  };

  refresh();

  background.on("pointerover", () => {
    if (!enabled) {
      return;
    }

    background.setScale(1.02, 1.04);
    background.setFillStyle(0x215a96, 0.96);
  });

  background.on("pointerout", () => {
    background.setScale(1, 1);
    background.setFillStyle(accentColor, enabled ? 0.88 : 0.32);
  });

  let clickHandler = onClick;
  let pressHandler = onPress;
  let releaseHandler = onRelease;
  let cooldownProgress = 0;

  background.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (!enabled) {
      return;
    }

    pressHandler?.(pointer);
    clickHandler();
  });

  background.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    if (!enabled) {
      return;
    }

    releaseHandler?.(pointer);
  });

  background.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
    if (!enabled) {
      return;
    }

    releaseHandler?.(pointer);
  });

  return {
    container: button,
    label: text,
    setEnabled(nextEnabled: boolean) {
      enabled = nextEnabled;
      background.setFillStyle(accentColor, enabled ? 0.88 : 0.32);
      refresh();
    },
    setInputEnabled(nextEnabled: boolean) {
      inputEnabled = nextEnabled;
      refresh();
    },
    setLabel(nextLabel: string) {
      text.setText(nextLabel);
    },
    setOnClick(nextHandler: () => void) {
      clickHandler = nextHandler;
    },
    setCooldownProgress(progress: number) {
      cooldownProgress = Phaser.Math.Clamp(progress, 0, 1);
      if (cooldownProgress <= 0) {
        cooldownOverlay.setVisible(false);
        return;
      }

      cooldownOverlay.setVisible(true);
      cooldownOverlay.setDisplaySize(width - 6, Math.max(3, (height - 6) * cooldownProgress));
    },
  };
}
