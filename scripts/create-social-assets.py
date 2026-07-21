from pathlib import Path
from urllib.request import urlretrieve
from PIL import Image, ImageDraw, ImageFont, ImageFilter

root = Path(__file__).resolve().parents[1]
public = root / "public"
public.mkdir(exist_ok=True)

bg_url = "https://v3b.fal.media/files/b/0aa32c62/nfteDz5YPWUWOVYdU4wXB_varBbK4Y.png"
bg_path = public / "og-ai-background.png"
urlretrieve(bg_url, bg_path)

W, H = 1200, 630
bg = Image.open(bg_path).convert("RGB")
scale = max(W / bg.width, H / bg.height)
bg = bg.resize((int(bg.width * scale), int(bg.height * scale)), Image.LANCZOS)
left = (bg.width - W) // 2
top = (bg.height - H) // 2
canvas = bg.crop((left, top, left + W, top + H)).convert("RGBA")
canvas = Image.alpha_composite(canvas, Image.new("RGBA", (W, H), (240, 240, 224, 150)))

ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(ov)
for x in range(W):
    alpha = int(max(0, 170 - x * 0.18))
    d.line([(x, 0), (x, H)], fill=(38, 50, 119, alpha))
canvas = Image.alpha_composite(canvas, ov)

owner = Image.open(root / "src/assets/chef-margaux.jpg").convert("RGB")
side = min(owner.size)
owner = owner.crop(((owner.width - side) // 2, (owner.height - side) // 2, (owner.width + side) // 2, (owner.height + side) // 2))
portrait_size = 360
owner = owner.resize((portrait_size, portrait_size), Image.LANCZOS).convert("RGBA")
mask = Image.new("L", (portrait_size, portrait_size), 0)
ImageDraw.Draw(mask).ellipse((0, 0, portrait_size - 1, portrait_size - 1), fill=255)

px, py = 770, 135
shadow = Image.new("RGBA", (portrait_size + 40, portrait_size + 40), (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((20, 20, portrait_size + 20, portrait_size + 20), fill=(0, 0, 0, 90))
shadow = shadow.filter(ImageFilter.GaussianBlur(14))
canvas.alpha_composite(shadow, (px - 20, py - 20))

navy = (38, 50, 119, 255)
gold = (184, 166, 0, 255)
cream = (240, 240, 224, 255)
frame = Image.new("RGBA", (portrait_size + 18, portrait_size + 18), (0, 0, 0, 0))
fd = ImageDraw.Draw(frame)
fd.ellipse((0, 0, portrait_size + 17, portrait_size + 17), fill=gold)
fd.ellipse((9, 9, portrait_size + 8, portrait_size + 8), fill=cream)
canvas.alpha_composite(frame, (px - 9, py - 9))
portrait = Image.new("RGBA", (portrait_size, portrait_size), (0, 0, 0, 0))
portrait.paste(owner, (0, 0), mask)
canvas.alpha_composite(portrait, (px, py))

card = Image.new("RGBA", (650, 500), (240, 240, 224, 255))
cd = ImageDraw.Draw(card)
cd.rounded_rectangle((0, 0, 650, 500), radius=36, fill=(240, 240, 224, 255), outline=gold, width=4)
canvas.alpha_composite(card, (55, 65))

draw = ImageDraw.Draw(canvas)

def font(size: int, bold: bool = False, italic: bool = False):
    candidates = []
    if bold:
        candidates += ["/System/Library/Fonts/Supplemental/Georgia Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"]
    if italic:
        candidates += ["/System/Library/Fonts/Supplemental/Georgia Italic.ttf"]
    candidates += ["/System/Library/Fonts/Supplemental/Georgia.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()

draw.text((105, 125), "CHEF MARGAUX PRESENTS", fill=gold, font=font(25, bold=True))
draw.text((105, 175), "Table", fill=navy, font=font(88, bold=True))
draw.text((108, 255), "and", fill=gold, font=font(32, bold=True))
draw.text((190, 244), "Grace", fill=navy, font=font(92, italic=True))
draw.line((105, 360, 610, 360), fill=gold, width=3)
draw.text((105, 388), "Fresh pickup meals,", fill=navy, font=font(38, bold=True))
draw.text((105, 435), "made with love.", fill=navy, font=font(38, italic=True))
draw.text((105, 510), "Acworth · Canton · Woodstock", fill=navy, font=font(25))

og_path = public / "og-image.png"
canvas.convert("RGB").save(og_path, quality=92, optimize=True)

fav = Image.new("RGBA", (512, 512), cream)
fdraw = ImageDraw.Draw(fav)
fdraw.rounded_rectangle((18, 18, 494, 494), radius=105, fill=cream, outline=gold, width=22)
fdraw.text((256, 145), "T", anchor="mm", fill=navy, font=font(190, bold=True))
fdraw.text((256, 315), "G", anchor="mm", fill=navy, font=font(185, italic=True))
for xy in [(256, 55), (214, 82), (298, 82), (256, 109)]:
    fdraw.ellipse((xy[0] - 13, xy[1] - 13, xy[0] + 13, xy[1] + 13), fill=gold)

fav.save(public / "favicon.png")
fav.resize((180, 180), Image.LANCZOS).save(public / "apple-touch-icon.png")
fav.save(public / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

print(f"created {og_path} {Image.open(og_path).size}")
print(f"created {public / 'favicon.ico'}")
print(f"created {public / 'favicon.png'} {Image.open(public / 'favicon.png').size}")
print(f"created {public / 'apple-touch-icon.png'} {Image.open(public / 'apple-touch-icon.png').size}")
print(f"created {bg_path} from AI background")
