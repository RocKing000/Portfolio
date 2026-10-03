"""Agent 3 — Background Complexity Stress Agent (80 tests)"""
import os, sys, time, json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import (make_logger, run_detection, save_failure,
                     make_doc_image, TEST_IMG, LOG_BASE, _VF_ROOT)

import cv2, numpy as np

TS      = datetime.now().strftime("%Y%m%d_%H%M%S")
log, fh = make_logger(os.path.join(LOG_BASE, f"agent3_backgrounds_{TS}.log"))
results = []

base_card = make_doc_image()
log(f"[AGENT3] Starting 80 tests...")

def record(name, img, desc):
    ok, conf, msg, ms = run_detection(img)
    log(f"[AGENT3][{name}] {desc} → {'PASS' if ok else 'FAIL'}  conf={conf:.3f}  {ms:.1f}ms")
    if not ok: save_failure(name, img)
    results.append({"name": name, "pass": ok, "ms": ms, "reason": msg})

def place_card(bg, card=None):
    if card is None:
        card = make_doc_image(bg_w=500,bg_h=300,bg_color=(200,200,200))[:300,150:650]
    h, w = bg.shape[:2]
    ch, cw = min(300, h-20), min(500, w-20)
    card_r = cv2.resize(base_card[150:450, 150:650] if base_card.shape[0]>=450 else base_card, (cw,ch))
    y = (h - ch)//2; x = (w - cw)//2
    bg[y:y+ch, x:x+cw] = card_r
    return bg

# ── SOLID COLOR BACKGROUNDS (10) ─────────────────────────────────────────────
log("[AGENT3] === SOLID BACKGROUNDS ===")
for name, color in [
    ("bg_black",      (0,0,0)),
    ("bg_white",      (255,255,255)),
    ("bg_red",        (0,0,255)),
    ("bg_blue",       (255,0,0)),
    ("bg_green",      (0,255,0)),
    ("bg_gray",       (128,128,128)),
    ("bg_dark_gray",  (50,50,50)),
    ("bg_light_gray", (200,200,200)),
    ("bg_yellow",     (0,255,255)),
    ("bg_purple",     (128,0,128)),
]:
    img = np.full((600,800,3), color, dtype=np.uint8)
    img = place_card(img)
    record(name, img, f"solid background {color}")

# ── TEXTURED BACKGROUNDS (10) ─────────────────────────────────────────────────
log("[AGENT3] === TEXTURED BACKGROUNDS ===")
def wood_tex(h=600,w=800):
    bg = np.zeros((h,w,3),np.uint8)
    for y in range(h):
        v = int(100 + 40*np.sin(y/8) + np.random.randint(-10,10))
        bg[y,:] = [30, max(0,min(255,v)), max(0,min(255,v+20))]
    return bg

def marble_tex(h=600,w=800):
    bg = np.full((h,w,3),180,np.uint8)
    for _ in range(10):
        x1,y1 = np.random.randint(0,w),np.random.randint(0,h)
        x2,y2 = np.random.randint(0,w),np.random.randint(0,h)
        cv2.line(bg,(x1,y1),(x2,y2),(160,160,160),np.random.randint(1,4))
    blur = cv2.GaussianBlur(bg,(21,21),0)
    noise = np.random.randint(-15,15,(h,w,3),np.int8)
    return np.clip(blur.astype(np.int32)+noise,0,255).astype(np.uint8)

def fabric_tex(h=600,w=800,sz=20):
    bg = np.full((h,w,3),180,np.uint8)
    for y in range(0,h,sz): cv2.line(bg,(0,y),(w,y),(140,140,140),1)
    for x in range(0,w,sz): cv2.line(bg,(x,0),(x,h),(140,140,140),1)
    return bg

def concrete_tex(h=600,w=800):
    bg = np.random.randint(100,160,(h,w,3),np.uint8)
    return cv2.GaussianBlur(bg,(3,3),0)

def noise_tex(h=600,w=800):
    return np.random.randint(0,255,(h,w,3),np.uint8)

def stripes_tex(h=600,w=800,sz=40):
    bg = np.zeros((h,w,3),np.uint8)
    colors = [(200,100,100),(100,200,100),(100,100,200),(200,200,100)]
    for i in range(0,w,sz):
        bg[:,i:i+sz] = colors[(i//sz)%len(colors)]
    return bg

def dots_tex(h=600,w=800):
    bg = np.full((h,w,3),200,np.uint8)
    for _ in range(100):
        cv2.circle(bg,(np.random.randint(0,w),np.random.randint(0,h)),
                   np.random.randint(5,25),tuple(np.random.randint(100,200,3).tolist()),-1)
    return bg

def tile_tex(h=600,w=800,sz=60):
    bg = np.full((h,w,3),200,np.uint8)
    for y in range(0,h,sz):
        for x in range(0,w,sz):
            c = (170,170,170) if ((x//sz+y//sz)%2)==0 else (220,220,220)
            cv2.rectangle(bg,(x+2,y+2),(x+sz-2,y+sz-2),c,-1)
    return bg

textures = [
    ("tex_wood",       wood_tex(),    "wood texture"),
    ("tex_marble",     marble_tex(),  "marble texture"),
    ("tex_fabric",     fabric_tex(),  "fabric texture"),
    ("tex_concrete",   concrete_tex(),"concrete texture"),
    ("tex_paper",      np.full((600,800,3),(240,235,220),np.uint8), "paper texture"),
    ("tex_metal",      np.tile(np.linspace(100,200,800).astype(np.uint8)[np.newaxis,:,np.newaxis],(600,1,3)),"metal"),
    ("tex_tile",       tile_tex(),    "tile pattern"),
    ("tex_stripes",    stripes_tex(), "striped background"),
    ("tex_dots",       dots_tex(),    "polka dots"),
    ("tex_noise",      noise_tex(),   "random noise"),
]
for name, bg, desc in textures:
    img = place_card(bg.copy())
    record(name, img, desc)

# ── CLUTTERED BACKGROUNDS (10) ────────────────────────────────────────────────
log("[AGENT3] === CLUTTERED BACKGROUNDS ===")
def make_clutter(level):
    bg = np.full((600,800,3),130,np.uint8)
    bg = place_card(bg)
    for _ in range(level * 5):
        shape = np.random.choice(["rect","circle","line"])
        c = tuple(np.random.randint(50,220,3).tolist())
        if shape == "rect":
            x,y = np.random.randint(0,700),np.random.randint(0,500)
            cv2.rectangle(bg,(x,y),(x+np.random.randint(20,120),y+np.random.randint(10,80)),c,
                          np.random.choice([-1,2,4]))
        elif shape == "circle":
            cv2.circle(bg,(np.random.randint(0,800),np.random.randint(0,600)),
                       np.random.randint(5,40),c,np.random.choice([-1,2]))
        else:
            x1,y1 = np.random.randint(0,800),np.random.randint(0,600)
            x2,y2 = np.random.randint(0,800),np.random.randint(0,600)
            cv2.line(bg,(x1,y1),(x2,y2),c,np.random.randint(1,5))
    return bg

clutter_names = ["pen","keys","phone","papers","coffee_cup",
                 "multiple_cards","books","keyboard","coins","full_clutter"]
for i, name in enumerate(clutter_names):
    img = make_clutter(i+1)
    record(f"clutter_{name}", img, f"clutter: {name}")

# ── LIGHTING CONDITIONS (15) ──────────────────────────────────────────────────
log("[AGENT3] === LIGHTING CONDITIONS ===")
base = make_doc_image()
H, W = base.shape[:2]

def apply_gradient(img, direction="top", strength=0.6):
    out = img.copy().astype(np.float32)
    h, w = out.shape[:2]
    if direction == "top":
        g = np.linspace(1+strength, 1-strength, h)[:,np.newaxis,np.newaxis]
    elif direction == "left":
        g = np.linspace(1+strength, 1-strength, w)[np.newaxis,:,np.newaxis]
    else:
        g = np.linspace(1-strength, 1+strength, h)[:,np.newaxis,np.newaxis]
    return np.clip(out * g, 0, 255).astype(np.uint8)

# build 15 lighting scenarios
lighting = [
    ("light_harsh_top",  apply_gradient(base,"top",0.5),   "harsh top lighting"),
    ("light_side",       apply_gradient(base,"left",0.6),   "side lighting"),
    ("light_backlit",    np.clip(base.astype(np.float32)*0.4,0,255).astype(np.uint8), "back lighting"),
    ("light_spotlight",  base.copy(),                        "spotlight center"),
    ("light_fluorescent",np.clip(base.astype(np.float32)*np.array([0.9,1.0,0.85]),0,255).astype(np.uint8),"fluorescent"),
    ("light_incandescent",np.clip(base.astype(np.float32)*np.array([0.8,0.9,1.1]),0,255).astype(np.uint8),"incandescent"),
    ("light_night",      np.clip(base.astype(np.float32)*0.2+np.array([0,0,15]),0,255).astype(np.uint8),"night"),
    ("light_mixed",      base.copy(),                       "mixed lighting"),
    ("light_flicker_bright",np.clip(base.astype(np.float32)*1.8,0,255).astype(np.uint8),"flicker bright"),
    ("light_flicker_dark",  np.clip(base.astype(np.float32)*0.5,0,255).astype(np.uint8),"flicker dark"),
    ("light_shadow",     apply_gradient(base,"top",-0.5),   "deep shadow"),
    ("light_red_cast",   np.clip(base.astype(np.float32)*np.array([0.5,0.5,1.5]),0,255).astype(np.uint8),"red cast"),
    ("light_blue_cast",  np.clip(base.astype(np.float32)*np.array([1.5,0.5,0.5]),0,255).astype(np.uint8),"blue cast"),
    ("light_uv",         cv2.convertScaleAbs(base,alpha=2.0,beta=-50),"UV simulation"),
    ("light_ir",         np.clip((255-base).astype(np.float32)*np.array([0.8,0.8,1.2]),0,255).astype(np.uint8),"IR simulation"),
]

# spotlight
spot = lighting[3][1]; glare_mask = np.zeros((H,W),np.uint8)
cv2.ellipse(glare_mask,(W//2,H//2),(200,150),0,0,360,255,-1)
glare_mask = cv2.GaussianBlur(glare_mask,(101,101),0)
bg_dark = np.clip(spot.astype(np.float32)*0.3,0,255).astype(np.uint8)
for c in range(3): spot[:,:,c] = (glare_mask/255.0*spot[:,:,c] + (1-glare_mask/255.0)*bg_dark[:,:,c]).astype(np.uint8)
lighting[3] = ("light_spotlight", spot, "spotlight center")

# mixed
mixed = lighting[7][1]
mixed[:, :W//2] = np.clip(mixed[:, :W//2].astype(np.float32)*np.array([0.8,0.9,1.2]),0,255).astype(np.uint8)
mixed[:, W//2:] = np.clip(mixed[:, W//2:].astype(np.float32)*np.array([1.2,0.9,0.7]),0,255).astype(np.uint8)

for name, img, desc in lighting:
    record(name, img, desc)

# ── SURFACE REFLECTIONS (10) ──────────────────────────────────────────────────
log("[AGENT3] === SURFACE REFLECTIONS ===")
def glare_stripe(img, alpha=0.5):
    out = img.copy(); h, w = out.shape[:2]
    for y in range(h):
        for x in range(w):
            if abs(y - x*0.6) < 30:
                out[y,x] = np.clip(out[y,x].astype(np.int32)+int(200*alpha),0,255)
    return out

for name, transform, desc in [
    ("refl_glass",       lambda i: np.vstack([i, cv2.flip(i,0)[:100]])[:600], "glass table reflection"),
    ("refl_sunlight",    lambda i: np.clip(i.astype(np.float32)*2.5,0,255).astype(np.uint8), "direct sunlight"),
    ("refl_plastic",     lambda i: glare_stripe(i,0.3), "plastic cover glare"),
    ("refl_hologram",    lambda i: cv2.applyColorMap(cv2.cvtColor(i,cv2.COLOR_BGR2GRAY),cv2.COLORMAP_RAINBOW), "hologram"),
    ("refl_wet",         lambda i: np.clip(i.astype(np.float32)*0.75,0,255).astype(np.uint8), "wet surface"),
    ("refl_fingerprint", lambda i: cv2.GaussianBlur(i,(3,3),0), "fingerprint smudges"),
    ("refl_sleeve",      lambda i: np.clip(i.astype(np.float32)*1.1+5,0,255).astype(np.uint8), "plastic sleeve"),
    ("refl_laminated",   lambda i: glare_stripe(i,0.6), "laminated strong glare"),
    ("refl_embossed",    lambda i: cv2.filter2D(i,-1,np.array([[-1,-1,0],[-1,0,1],[0,1,1]])), "embossed"),
    ("refl_worn",        lambda i: cv2.convertScaleAbs(i,alpha=0.7,beta=20), "worn/faded"),
]:
    try:
        img = transform(base.copy())
        if img.shape[:2] != base.shape[:2]:
            img = cv2.resize(img, (base.shape[1], base.shape[0]))
        record(name, img, desc)
    except Exception as e:
        log(f"[AGENT3][{name}] ERROR: {e}")
        results.append({"name":name,"pass":False,"ms":0,"reason":str(e)})

# ── CAMERA SENSOR ISSUES (10) ─────────────────────────────────────────────────
log("[AGENT3] === CAMERA SENSOR ISSUES ===")
def barrel_distort(img, k=0.3):
    h,w = img.shape[:2]; cx,cy = w//2,h//2
    map_x = np.zeros((h,w),np.float32); map_y = np.zeros((h,w),np.float32)
    for y in range(h):
        for x in range(w):
            nx=(x-cx)/cx; ny=(y-cy)/cy
            r=nx*nx+ny*ny; factor=1+k*r
            map_x[y,x]=cx+nx/factor*cx; map_y[y,x]=cy+ny/factor*cy
    return cv2.remap(img,map_x,map_y,cv2.INTER_LINEAR)

def vignette(img, strength=0.6):
    h,w = img.shape[:2]; sigma=min(h,w)*0.6
    k = cv2.getGaussianKernel(max(h,w),sigma)
    kern = k * k.T; kern = kern[:h,:w]
    kern = kern/kern.max()
    out = img.copy().astype(np.float32)
    for c in range(3): out[:,:,c] *= kern
    return np.clip(out,0,255).astype(np.uint8)

def _dead_pixels(img, val=0):
    x = img.copy()
    x[np.random.randint(0, x.shape[0], 200), np.random.randint(0, x.shape[1], 200)] = val
    return x

def _banding(img):
    x = img.copy()
    x[::15] = x[::15] // 2
    return x

def _chrom_aber(img):
    h, w = img.shape[:2]
    big = np.dstack([cv2.resize(img[:,:,0],(w+4,h+4)),
                     cv2.resize(img[:,:,1],(w+4,h+4)),
                     cv2.resize(img[:,:,2],(w+4,h+4))])
    return big[:h,:w]

sensor_tests = [
    ("sensor_dead_pixels",       lambda i: _dead_pixels(i, 0),   "dead pixels"),
    ("sensor_hot_pixels",        lambda i: _dead_pixels(i, 255), "hot pixels"),
    ("sensor_barrel",            barrel_distort,                  "barrel distortion"),
    ("sensor_chrom_aber",        _chrom_aber,                     "chromatic aberration"),
    ("sensor_vignette",          vignette,                        "vignetting"),
    ("sensor_banding",           _banding,                        "banding noise"),
    ("sensor_rolling_shutter",   lambda i: cv2.warpAffine(i,np.float32([[1,0.03,0],[0,1,0]]),(i.shape[1],i.shape[0])), "rolling shutter"),
    ("sensor_oversharpened",     lambda i: cv2.filter2D(i,-1,np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])), "over-sharpened"),
    ("sensor_underexposed_noisy",lambda i: np.clip(i.astype(np.float32)*0.2+np.random.normal(0,20,i.shape),0,255).astype(np.uint8), "underexposed noisy"),
    ("sensor_pixelated",         lambda i: cv2.resize(cv2.resize(i,(i.shape[1]//8,i.shape[0]//8)),(i.shape[1],i.shape[0]),interpolation=cv2.INTER_NEAREST), "pixelated upscaled"),
]
for name, transform, desc in sensor_tests:
    try:
        img = transform(base.copy())
        if img.ndim == 2: img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        if img.shape[1] != base.shape[1] or img.shape[0] != base.shape[0]:
            img = cv2.resize(img, (base.shape[1], base.shape[0]))
        record(name, img, desc)
    except Exception as e:
        log(f"[AGENT3][{name}] ERROR: {e}")
        results.append({"name":name,"pass":False,"ms":0,"reason":str(e)})

# ── DISTANCE SIMULATION (15) ──────────────────────────────────────────────────
log("[AGENT3] === DISTANCE SIMULATION ===")
focal_px = 800
for dist_cm in [5, 8, 10, 12, 15, 18, 20, 25, 30, 40, 50, 60, 80, 100, 150]:
    real_card_cm = 8.5
    card_px      = int(focal_px * real_card_cm / dist_cm)
    card_px      = max(20, min(card_px, 780))
    card_h_px    = int(card_px * 0.63)
    bg           = np.full((600, 800, 3), 80, dtype=np.uint8)
    if card_px > 4 and card_h_px > 4:
        card_r = cv2.resize(base, (card_px, card_h_px))
        blur_k = max(1, int(dist_cm / 10)) * 2 - 1
        if blur_k > 1: card_r = cv2.GaussianBlur(card_r, (blur_k, blur_k), 0)
        x = (800 - card_px)//2; y = (600 - card_h_px)//2
        bg[y:y+card_h_px, x:x+card_px] = card_r
    record(f"distance_{dist_cm}cm", bg, f"distance={dist_cm}cm card={card_px}px")

# ── SUMMARY ───────────────────────────────────────────────────────────────────
total  = len(results); passed = sum(1 for r in results if r["pass"]); failed = total - passed
times  = [r["ms"] for r in results]
log(""); log("="*60)
log(f"[AGENT3] Total: {total}  Passed: {passed}  Failed: {failed}  Pass rate: {passed/total*100:.1f}%")
log("="*60)
summary = {"agent":"Agent3-Backgrounds","total":total,"passed":passed,"failed":failed,
           "pass_rate":f"{passed/total*100:.1f}%","avg_ms":round(sum(times)/len(times),1),
           "failures":[{"test":r["name"],"reason":r["reason"]} for r in results if not r["pass"]]}
with open(os.path.join(LOG_BASE, f"agent3_summary_{TS}.json"),"w") as f: json.dump(summary,f,indent=2)
fh.close()
print(f"\nAgent 3 complete.")
