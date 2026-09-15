from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Image.open(ROOT / "assets" / "branding" / "dama_logo.png").convert("RGBA")


def fit_on_square(size: int, fill_ratio: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    max_w = int(size * fill_ratio)
    max_h = int(size * fill_ratio)
    ratio = min(max_w / SRC.width, max_h / SRC.height)
    new_w = max(1, int(SRC.width * ratio))
    new_h = max(1, int(SRC.height * ratio))
    resized = SRC.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - new_w) // 2, (size - new_h) // 2), resized)
    return canvas


def save_rgb(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, "PNG", optimize=True)


def splash_logo(width: int = 900) -> Image.Image:
    ratio = width / SRC.width
    height = max(1, int(SRC.height * ratio))
    resized = SRC.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    canvas.paste(resized, (0, 0), resized)
    return canvas


def main() -> None:
    branding = ROOT / "assets" / "branding"
    save_rgb(fit_on_square(1024, 0.82), branding / "app_icon.png")
    save_rgb(fit_on_square(1024, 0.58), branding / "splash_android12.png")
    splash = splash_logo()
    save_rgb(splash, branding / "splash_logo.png")

    res = ROOT / "android" / "app" / "src" / "main" / "res"
    legacy = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    foreground = {
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }
    for folder, size in legacy.items():
        save_rgb(fit_on_square(size, 0.82), res / folder / "ic_launcher.png")
    for folder, size in foreground.items():
        save_rgb(fit_on_square(size, 0.62), res / folder / "ic_launcher_foreground.png")

    drawable = res / "drawable"
    save_rgb(splash, drawable / "splash_logo.png")
    save_rgb(fit_on_square(512, 0.58), drawable / "splash_icon.png")
    print("logo", SRC.size)
    print("branding written")


if __name__ == "__main__":
    main()
