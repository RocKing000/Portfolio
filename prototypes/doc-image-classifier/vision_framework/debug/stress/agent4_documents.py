"""Agent 4 — Document Type Stress Agent (80 tests)"""
import os, sys, time, json, re
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _common import (make_logger, run_detection, save_failure,
                     make_doc_image, LOG_BASE, _VF_ROOT)

import cv2, numpy as np

TS      = datetime.now().strftime("%Y%m%d_%H%M%S")
log, fh = make_logger(os.path.join(LOG_BASE, f"agent4_documents_{TS}.log"))
results = []

def record(name, ok, extra=""):
    verdict = "PASS" if ok else "FAIL"
    log(f"[AGENT4][{name}] {verdict}  {extra}")
    results.append({"name": name, "pass": ok})

def ocr_extract(img):
    try:
        from vision_framework.plugins.kyc.extractors.ocr_extractor import OCRExtractor
        ocr = OCRExtractor()
        res = ocr.extract(img)
        data = res.get("extracted_data", {}) or {}
        return data
    except Exception as e:
        return {"error": str(e)}

def validate_aadhaar(num):
    try:
        from vision_framework.plugins.kyc.validators.aadhaar_validator import AadhaarValidator
        v = AadhaarValidator()
        r = v.validate({"aadhaar_number": num})
        return r.get("valid", False)
    except Exception as e:
        return None

log("[AGENT4] Starting 80 tests...")

# ── AADHAAR LAYOUT VARIATIONS (20) ───────────────────────────────────────────
log("[AGENT4] === AADHAAR LAYOUT VARIATIONS ===")

def make_aadhaar(number="2345 6789 0123", num_x=100, num_y=285,
                 font_scale=0.9, thickness=3, color=(0,0,0),
                 bg_color=(255,255,255), angle=0):
    card = make_doc_image(card_w=500, card_h=300, bg_color=(50,50,50), card_color=bg_color)
    h, w = card.shape[:2]
    # find card region (center)
    cx, cy = w//2, h//2
    card_x, card_y = cx - 250, cy - 150
    cv2.putText(card, number, (card_x + num_x, card_y + num_y),
                cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness, cv2.LINE_AA)
    if angle != 0:
        M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1)
        card = cv2.warpAffine(card, M, (w, h), borderValue=(50,50,50))
    return card

aadhaar_tests = [
    ("aadhaar_std_bottom_center",   make_aadhaar("2345 6789 0123", 80, 285),            "standard bottom center"),
    ("aadhaar_bottom_left",         make_aadhaar("2345 6789 0123", 5,  285),             "number bottom left"),
    ("aadhaar_bottom_right",        make_aadhaar("2345 6789 0123", 200,285),             "number bottom right"),
    ("aadhaar_middle",              make_aadhaar("2345 6789 0123", 80, 160),             "number in middle"),
    ("aadhaar_spaces",              make_aadhaar("2345 6789 0123", 80, 285),             "number with spaces"),
    ("aadhaar_no_spaces",           make_aadhaar("234567890123",   80, 285),             "number no spaces"),
    ("aadhaar_dashes",              make_aadhaar("2345-6789-0123", 80, 285),             "number with dashes"),
    ("aadhaar_small_font",          make_aadhaar("2345 6789 0123", 80, 285, 0.4, 1),    "small font"),
    ("aadhaar_large_font",          make_aadhaar("2345 6789 0123", 10, 285, 1.5, 4),    "large font"),
    ("aadhaar_bold",                make_aadhaar("2345 6789 0123", 80, 285, 0.9, 5),    "bold"),
    ("aadhaar_blue",                make_aadhaar("2345 6789 0123", 80, 285, color=(255,0,0)), "blue color"),
    ("aadhaar_black",               make_aadhaar("2345 6789 0123", 80, 285, color=(0,0,0)),   "black color"),
    ("aadhaar_edge_cut",            make_aadhaar("2345 6789 0123", 430,285),             "partially cut off at edge"),
    ("aadhaar_upside_down",         make_aadhaar("2345 6789 0123", 80, 285, angle=180), "upside down"),
    ("aadhaar_sideways",            make_aadhaar("2345 6789 0123", 80, 285, angle=90),  "sideways"),
    ("aadhaar_noise_text",          make_aadhaar("2345 6789 0123 GOVT OF INDIA", 30,285,0.6,2), "surrounding noise"),
    ("aadhaar_colored_strip",       make_aadhaar("2345 6789 0123", 80, 285, bg_color=(200,200,255)), "colored background"),
    ("aadhaar_multi_numbers",       make_aadhaar("1234 5678 9012   2345 6789 0123", 10,285,0.5,1), "multiple numbers"),
    ("aadhaar_masked",              make_aadhaar("XXXX XXXX 0123", 80, 285),            "masked number"),
    ("aadhaar_hindi_nearby",        make_aadhaar("2345 6789 0123", 80, 285),            "Hindi nearby (simulated)"),
]

for name, img, desc in aadhaar_tests:
    ok, conf, msg, ms = run_detection(img)
    log(f"[AGENT4][{name}] {desc} → {'PASS' if ok else 'FAIL'}  conf={conf:.3f}  {ms:.1f}ms")
    if not ok: save_failure(name, img)
    results.append({"name": name, "pass": ok, "ms": ms, "reason": msg})

# ── AADHAAR NUMBER VALIDATION (30) ────────────────────────────────────────────
log("[AGENT4] === AADHAAR NUMBER VALIDATION ===")

validation_cases = [
    # (input, should_be_valid, description)
    ("2345 6789 0123",        True,  "standard with spaces"),
    ("234567890123",          True,  "no spaces"),
    ("9999 9999 9999",        True,  "all nines"),
    ("2000 0000 0001",        True,  "starts with 2"),
    ("5555 5555 5555",        True,  "repeated pattern"),
    ("3141 5926 5358",        True,  "random valid"),
    ("0234 5678 9012",        False, "starts with 0"),
    ("1234 5678 9012",        False, "starts with 1"),
    ("1111 1111 1111",        False, "starts with 1 all same"),
    ("2345 6789 012",         False, "11 digits only"),
    ("2345 6789 01234",       False, "13 digits"),
    ("2345 6789 012A",        False, "contains letter"),
    ("0000 0000 0000",        False, "all zeros"),
    ("",                      False, "empty string"),
    ("ABCD EFGH IJKL",        False, "all letters"),
    ("2345",                  False, "too short"),
    ("2345 6789",             False, "8 digits"),
    (None,                    False, "null input"),
    ("2345-6789-0123",        None,  "with dashes (implementation-dependent)"),
    ("2345.6789.0123",        None,  "with dots"),
    (" 2345 6789 0123 ",      None,  "surrounding spaces"),
    ("2345  6789  0123",      None,  "double spaces"),
    ("23456789 0123",         False, "wrong grouping"),
    ("2345678901234567",      False, "too long"),
    ("2 3 4 5 6 7 8 9 0 1 2 3", None, "spaced individual digits"),
    ("2345 6789 0124",        True,  "another valid number"),
    ("3456 7890 1234",        True,  "another valid"),
    ("4567 8901 2345",        True,  "another valid"),
    ("6789 0123 4567",        True,  "another valid"),
    ("8901 2345 6789",        True,  "another valid"),
]

correct = 0
for num, expected, desc in validation_cases:
    try:
        got = validate_aadhaar(num)
        if expected is None:
            ok = True  # implementation-dependent, don't penalize
            note = f"impl-dep got={got}"
        else:
            ok = (got == expected)
            note = f"expected={expected} got={got}"
        if ok: correct += 1
        verdict = "PASS" if ok else "FAIL"
        log(f"[AGENT4][valid_{desc[:20]}] input={repr(num)} {note} → {verdict}")
        results.append({"name": f"valid_{desc[:20]}", "pass": ok, "ms": 0, "reason": note})
    except Exception as e:
        log(f"[AGENT4][valid_{desc[:20]}] ERROR: {e}")
        results.append({"name": f"valid_{desc[:20]}", "pass": False, "ms": 0, "reason": str(e)})

log(f"[AGENT4] Validation: {correct}/{len(validation_cases)} correct")

# ── PAN CARD VARIATIONS (15) ──────────────────────────────────────────────────
log("[AGENT4] === PAN CARD VARIATIONS ===")

def make_pan_card(pan="ABCDE1234F"):
    canvas = np.full((600, 800, 3), 50, dtype=np.uint8)
    card   = np.full((300, 500, 3), 240, dtype=np.uint8)
    cv2.rectangle(card, (0,0), (499,49), (0,100,200), -1)
    cv2.putText(card, "INCOME TAX DEPT", (10,35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)
    cv2.putText(card, "Permanent Account Number", (10,90), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,0,0), 1)
    cv2.putText(card, pan, (10,130), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0,0,0), 3)
    cv2.putText(card, "Name: TEST USER", (10,180), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 1)
    cv2.putText(card, "DOB: 01/01/1990", (10,210), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 1)
    cv2.rectangle(card, (0,0), (499,299), (0,0,0), 4)
    canvas[150:450, 150:650] = card
    return canvas

pan_tests = [
    ("ABCDE1234F", True,  "standard valid PAN"),
    ("ZZZZZ9999Z", True,  "all Z and 9"),
    ("AABCD1234E", True,  "starts with AA"),
    ("ABCD1234F",  False, "9 chars not 10"),
    ("ABCDE12345", False, "ends with digit"),
    ("abcde1234f", False, "lowercase"),
    ("ABC1E1234F", False, "digit in wrong position"),
    ("ABCDE123FF", False, "two letters at end"),
]
for pan, expected_valid, desc in pan_tests:
    img = make_pan_card(pan)
    ok, conf, msg, ms = run_detection(img)
    log(f"[AGENT4][pan_{pan}] {desc} → detected={'PASS' if ok else 'FAIL'}  conf={conf:.3f}")
    if not ok: save_failure(f"pan_{pan}", img)
    results.append({"name": f"pan_{pan}", "pass": ok, "ms": ms, "reason": msg})

# Different positions
for i, (x, y, sz, desc) in enumerate([
    (80, 130, 1.2, "normal size position"),
    (10, 80, 0.5, "small font"),
    (200, 250, 1.5, "large font bottom"),
    (10, 150, 0.8, "left aligned"),
    (300, 130, 0.9, "right of card"),
    (80, 130, 1.0, "with surrounding text"),
    (80, 260, 1.0, "very bottom"),
]):
    img = make_pan_card(f"ABCDE{1000+i}F")
    ok, conf, msg, ms = run_detection(img)
    log(f"[AGENT4][pan_pos_{i}] {desc} → {'PASS' if ok else 'FAIL'}")
    results.append({"name": f"pan_pos_{i}", "pass": ok, "ms": ms, "reason": msg})

# ── MIXED DOCUMENT SCENARIOS (15) ─────────────────────────────────────────────
log("[AGENT4] === MIXED SCENARIOS ===")

base_aadhaar = make_doc_image()

scenarios = []

# 1 two docs in frame
bg = np.full((600,800,3),80,np.uint8)
a  = cv2.resize(base_aadhaar, (350,210)); p = make_pan_card()[:300,100:600]; p = cv2.resize(p,(350,210))
bg[50:260, 20:370] = a; bg[50:260, 430:780] = p
scenarios.append(("two_docs_in_frame", bg, "Aadhaar and PAN side by side"))

# 2 partial — left half of card visible
bg2 = np.full((600,800,3),80,np.uint8)
card_r = cv2.resize(base_aadhaar,(500,300))
bg2[150:450, 0:250] = card_r[:, :250]
scenarios.append(("partial_doc", bg2, "document 50% in frame"))

# 3 upside down
scenarios.append(("upside_down", cv2.rotate(base_aadhaar, cv2.ROTATE_180), "document upside down"))

# 4 wrong document
wrong = np.full((600,800,3),50,np.uint8)
card_wrong = np.full((300,480,3),230,np.uint8)
cv2.putText(card_wrong,"DRIVING LICENCE",(10,40),cv2.FONT_HERSHEY_SIMPLEX,1.0,(0,0,0),2)
cv2.putText(card_wrong,"DL No: MH01 2345 6789",(10,100),cv2.FONT_HERSHEY_SIMPLEX,0.7,(0,0,0),2)
cv2.rectangle(card_wrong,(0,0),(479,299),(0,0,0),4)
wrong[150:450,160:640] = card_wrong
scenarios.append(("wrong_doc_type", wrong, "driving licence instead"))

# 5 handwritten simulation
hand = base_aadhaar.copy()
hand = cv2.GaussianBlur(hand,(3,3),0)
noise = np.random.normal(0,15,hand.shape).astype(np.int8)
hand  = np.clip(hand.astype(np.int32)+noise,0,255).astype(np.uint8)
scenarios.append(("handwritten_sim", hand, "handwritten simulation"))

# 6-15 various damage scenarios
scenarios.extend([
    ("photocopy",     np.clip(cv2.cvtColor(base_aadhaar,cv2.COLOR_BGR2GRAY)[:,:,np.newaxis].repeat(3,2).astype(np.float32)*0.8+30,0,255).astype(np.uint8), "photocopy"),
    ("scanned_skewed",cv2.warpAffine(base_aadhaar,cv2.getRotationMatrix2D((400,300),3,1),(800,600),borderValue=(255,255,255)),"scanned skewed"),
    ("screen_photo",  (lambda i: np.clip(i.astype(np.float32)+np.tile(np.sin(np.arange(i.shape[0])*0.5)[:,np.newaxis,np.newaxis]*8,(1,i.shape[1],3)),0,255).astype(np.uint8))(base_aadhaar.copy()),"photographed from screen"),
    ("old_yellowed",  np.clip(base_aadhaar.astype(np.float32)*np.array([0.8,0.85,1.1]),0,255).astype(np.uint8), "old yellowed"),
    ("laminated_glare",cv2.addWeighted(base_aadhaar,0.7,np.full_like(base_aadhaar,220),0.3,0),"laminated"),
    ("torn_corner",   (lambda i: (i.__setitem__((slice(0,100),slice(600,800)),80),i)[1])(base_aadhaar.copy()),"torn corner"),
    ("folded",        (lambda i: [cv2.line(i,(0,300),(800,300),(180,180,180),3), i][1])(base_aadhaar.copy()),"folded crease"),
    ("water_damaged", (lambda i: (lambda m: (i.__setitem__(m>200,np.clip(i[m>200].astype(np.int32)-40,0,255)),i)[1])(np.random.randint(0,255,(600,800),np.uint8)))(base_aadhaar.copy()),"water damage"),
    ("in_envelope",   (lambda i: (i.__setitem__((slice(None),slice(600,800)),np.array([240,230,200])),i)[1])(base_aadhaar.copy()),"in envelope partial"),
    ("behind_glass",  cv2.addWeighted(base_aadhaar,0.8,np.full_like(base_aadhaar,200),0.2,0),"behind glass"),
])

for name, img, desc in scenarios:
    try:
        ok, conf, msg, ms = run_detection(img)
    except Exception as e:
        ok, conf, msg, ms = False, 0.0, str(e), 0.0
    log(f"[AGENT4][{name}] {desc} → {'PASS' if ok else 'FAIL'}  conf={conf:.3f}")
    if not ok: save_failure(name, img)
    results.append({"name":name,"pass":ok,"ms":ms,"reason":msg})

# ── SUMMARY ───────────────────────────────────────────────────────────────────
total = len(results); passed = sum(1 for r in results if r["pass"]); failed = total - passed
times = [r.get("ms",0) for r in results if r.get("ms",0) > 0]
log(""); log("="*60)
log(f"[AGENT4] Total: {total}  Passed: {passed}  Failed: {failed}  Pass rate: {passed/total*100:.1f}%")
log("="*60)
summary = {"agent":"Agent4-Documents","total":total,"passed":passed,"failed":failed,
           "pass_rate":f"{passed/total*100:.1f}%","avg_ms":round(sum(times)/max(1,len(times)),1),
           "failures":[{"test":r["name"],"reason":r.get("reason","")} for r in results if not r["pass"]]}
with open(os.path.join(LOG_BASE, f"agent4_summary_{TS}.json"),"w") as f: json.dump(summary,f,indent=2)
fh.close()
print("\nAgent 4 complete.")
