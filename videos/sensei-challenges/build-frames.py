#!/usr/bin/env python3
"""Generates compositions/frames/NN-*.html for the Sensei explainer.

Each frame is a bare <template> sub-composition. Fonts are embedded as base64 so
the frames render identically in Studio and in the headless renderer.
"""
import base64, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "compositions", "frames")
os.makedirs(OUT, exist_ok=True)
GSAP = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"

INK, MUTED, INDIGO, DEEP, TINT, LINE, BG, PAPER, HINOKI, SHU = (
    "#1c1d21", "#66686e", "#223a5e", "#16263f", "#dfe4ec", "#d3d0c4", "#eae8e0", "#f7f6f1", "#c9a974", "#b6402f")


def b64(name):
    with open(os.path.join(HERE, "assets", "fonts", name), "rb") as f:
        return base64.b64encode(f.read()).decode()


JP = "unicode-range:U+3000-30FF,U+4E00-9FFF,U+FF00-FFEF;"
FONTS = "".join([
    f'@font-face{{font-family:"Shippori Mincho B1";font-weight:600;src:url(data:font/woff2;base64,{b64("shippori-600.woff2")}) format("woff2");}}',
    f'@font-face{{font-family:"Shippori Mincho B1";font-weight:800;src:url(data:font/woff2;base64,{b64("shippori-800.woff2")}) format("woff2");}}',
    f'@font-face{{font-family:"Shippori Mincho B1";font-weight:800;src:url(data:font/woff2;base64,{b64("shippori-jp-800.woff2")}) format("woff2");{JP}}}',
    f'@font-face{{font-family:"Yuji Boku";font-weight:400;src:url(data:font/woff2;base64,{b64("yuji-sen.woff2")}) format("woff2");}}',
    f'@font-face{{font-family:"Zen Kaku Gothic New";font-weight:500;src:url(data:font/woff2;base64,{b64("zen-500.woff2")}) format("woff2");}}',
    f'@font-face{{font-family:"Zen Kaku Gothic New";font-weight:700;src:url(data:font/woff2;base64,{b64("zen-700.woff2")}) format("woff2");}}',
    f'@font-face{{font-family:"Zen Kaku Gothic New";font-weight:700;src:url(data:font/woff2;base64,{b64("zen-jp-700.woff2")}) format("woff2");{JP}}}',
])

BASE = f"""
$R{{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;color:{INK};font-family:"Zen Kaku Gothic New",sans-serif;}}
$R .bg{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,{PAPER} 0%,{BG} 72%);}}
$R .bg-rule{{position:absolute;inset:36px;border:1px solid {LINE};}}
$R .stage{{position:absolute;inset:0;}}
$R .abs{{position:absolute;}}
$R .serif{{font-family:"Shippori Mincho B1",serif;font-weight:800;}}
$R .w{{display:inline-block;}}
$R .h1{{position:absolute;font-family:"Shippori Mincho B1",serif;font-weight:800;line-height:1.22;letter-spacing:-1.5px;margin:0;}}
$R .muted{{color:{MUTED};}}
$R .shu{{color:{SHU};}}
$R .indigo{{color:{INDIGO};}}
$R .label{{position:absolute;font-weight:700;font-size:22px;letter-spacing:5px;text-transform:uppercase;color:{MUTED};}}
$R .chip{{position:absolute;left:180px;top:104px;display:flex;align-items:center;gap:14px;padding:8px 24px 8px 8px;border:2px solid {INDIGO};border-radius:999px;color:{INDIGO};font-weight:700;font-size:22px;letter-spacing:5px;text-transform:uppercase;}}
$R .chip b{{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:{INDIGO};color:#fff;letter-spacing:0;font-size:22px;}}
$R .orb{{position:absolute;border-radius:50%;background:radial-gradient(circle at 34% 30%,#4a6a98 0%,{INDIGO} 55%,{DEEP} 100%);box-shadow:0 10px 30px rgba(34,58,94,.25);}}
$R .orb .ring{{position:absolute;inset:0;border-radius:50%;border:3px solid rgba(34,58,94,.35);}}
$R .card{{position:absolute;background:#fff;border:1px solid {LINE};border-radius:22px;box-shadow:0 18px 40px rgba(28,29,33,.07);}}
$R .hanko{{display:inline-grid;place-items:center;background:#b6402f;color:#f7f6f1;border-radius:12px;font-family:"Yuji Boku",serif;line-height:1;box-shadow:inset 0 0 0 5px #b6402f,inset 0 0 0 9px rgba(247,246,241,.67);}}
$R .token{{position:absolute;width:52px;height:52px;border-radius:50%;border:2px solid {HINOKI};background:{PAPER};color:#9c7b45;display:flex;align-items:center;justify-content:center;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:26px;}}
"""


def words(text, cls="w"):
    return " ".join(f'<span class="{cls}">{t}</span>' for t in text.split(" "))


def orb(x, y, size, rings=2, extra=""):
    r = "".join('<div class="ring"></div>' for _ in range(rings))
    return f'<div class="orb {extra}" style="left:{x - size // 2}px;top:{y - size // 2}px;width:{size}px;height:{size}px">{r}</div>'


PERSON = f'<circle cx="0" cy="-60" r="44" fill="{INK}"/><path d="M-88 80 C-88 10 -48 -8 0 -8 C48 -8 88 10 88 80 Z" fill="{INK}"/>'
CHECK = '<svg width="{s}" height="{s}" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def check(size=28, color="#fff"):
    return CHECK.format(s=size, c=color)


FRAMES = []


def frame(fid, dur, css, markup, js):
    FRAMES.append((fid, dur, css, markup, js))


# ─────────────────────────── shared: knowledge pieces (hexagons) ───────────────────────────
SQ3 = math.sqrt(3)


def hex_points(cx, cy, s):
    return " ".join(f"{cx + s * math.cos(math.radians(-90 + 60 * k)):.1f},{cy + s * math.sin(math.radians(-90 + 60 * k)):.1f}" for k in range(6))


def honey(n, size, gap=1.08):
    dirs = [(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)]
    cells, ring = [(0, 0)], 1
    while len(cells) < n:
        q, r = -ring, ring
        for d in range(6):
            for _ in range(ring):
                cells.append((q, r))
                q += dirs[d][0]
                r += dirs[d][1]
        ring += 1
    return [(size * gap * SQ3 * (q + r / 2), size * gap * 1.5 * r) for q, r in cells[:n]]


def hex_style(i):
    if i % 7 == 0:
        return f'fill="{INDIGO}" stroke="{INDIGO}"'
    if i % 5 == 2:
        return f'fill="{HINOKI}" stroke="{HINOKI}"'
    if i % 11 == 4:
        return f'fill="{SHU}" stroke="{SHU}"'
    return f'fill="{PAPER}" stroke="{INDIGO}"'


def honey_svg(cls, cx, cy, n, size):
    return "".join(f'<polygon class="{cls}" points="{hex_points(cx + x, cy + y, size * .93)}" {hex_style(i)} stroke-width="2.5"/>'
                   for i, (x, y) in enumerate(honey(n, size)))


HEX_ICON = f'<svg width="26" height="26" viewBox="-13 -13 26 26"><polygon points="{hex_points(0, 0, 12)}" fill="#fff"/></svg>'
STATES = ["ok", "ok", "ok", "ok", "open"]


def progress(cur):
    """Row of five challenge pieces. Earlier ones are final, the current one pops in (class pcur)."""
    out = ""
    for i, st in enumerate(STATES):
        cx, cy = 30 + i * 62, 36
        if i > cur:
            out += f'<polygon points="{hex_points(cx, cy, 24)}" fill="none" stroke="{LINE}" stroke-width="2.5" stroke-dasharray="5 5"/>'
            continue
        cls = "pcur" if i == cur else "pdone"
        if st == "ok":
            body = (f'<polygon points="{hex_points(cx, cy, 24)}" fill="{INDIGO}"/>'
                    f'<path d="M{cx - 9} {cy + 1} l6 6 l12 -13" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>')
        else:
            body = (f'<polygon points="{hex_points(cx, cy, 22)}" fill="{PAPER}" stroke="{HINOKI}" stroke-width="3.5" stroke-dasharray="6 4"/>'
                    f'<circle cx="{cx}" cy="{cy}" r="5" fill="{HINOKI}"/>')
        out += f'<g class="{cls}">{body}</g>'
    return (f'<svg class="prog" viewBox="0 0 320 72" style="position:absolute;left:174px;top:812px;width:320px;height:72px">{out}</svg>'
            f'<div class="proglab">Challenge {cur + 1} of 5</div>')


CH_CSS = """
$R .title{left:180px;top:170px;width:1600px;font-size:64px;}
$R .prob{position:absolute;left:184px;top:278px;width:820px;font-size:32px;font-weight:500;line-height:1.5;color:#66686e;}
$R .ans{left:180px;top:520px;width:880px;padding:24px 34px 26px;border-left:10px solid #223a5e;border-radius:10px 22px 22px 10px;}
$R .ans.open{border-left-color:#c9a974;}
$R .ans .al{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:700;letter-spacing:4px;color:#223a5e;}
$R .ans.open .al{color:#8f6f3c;}
$R .ans .at{margin-top:10px;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:35px;line-height:1.3;}
$R .ans .at2{margin-top:8px;font-size:24px;font-weight:500;color:#66686e;line-height:1.45;}
$R .proglab{position:absolute;left:510px;top:834px;font-size:20px;font-weight:700;letter-spacing:4px;color:#66686e;text-transform:uppercase;}
$R .vlab{position:absolute;font-size:22px;font-weight:700;letter-spacing:2px;color:#66686e;text-align:center;}
$R .tagp{position:absolute;padding:6px 16px;border-radius:999px;font-size:18px;font-weight:700;letter-spacing:3px;}
$R .planned{border:2px dashed #c9a974;color:#8f6f3c;background:#f7f6f1;}
"""


def ch_markup(n, title, prob, solved, at, at2):
    lab = (f'{check(26, INDIGO)}HOW WE SOLVED IT' if solved else
           f'<svg width="22" height="22" viewBox="-11 -11 22 22"><polygon points="{hex_points(0, 0, 10)}" fill="none" stroke="#8f6f3c" stroke-width="2.5" stroke-dasharray="4 3"/></svg>STILL OPEN · NEXT STEP')
    return (f'<div class="chip"><b>{n}</b>Challenge</div>'
            f'<h1 class="h1 title">{words(title)}</h1>'
            f'<div class="prob">{prob}</div>'
            f'<div class="card ans{"" if solved else " open"}"><div class="al">{lab}</div><div class="at">{at}</div><div class="at2">{at2}</div></div>'
            + progress(n - 1))


def ch_js(t_ans):
    return """
tl.fromTo(q('.chip'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:"power2.out"},0);
tl.fromTo(qa('.title .w'),{opacity:0,y:30},{opacity:1,y:0,duration:.5,stagger:.07,ease:"power3.out"},.15);
tl.fromTo(q('.prob'),{opacity:0,y:16},{opacity:1,y:0,duration:.6,ease:"power2.out"},1.0);
tl.fromTo(q('.prog'),{opacity:0},{opacity:1,duration:.4},.4);
tl.fromTo(q('.proglab'),{opacity:0},{opacity:1,duration:.4},.5);
tl.fromTo(q('.ans'),{opacity:0,x:-30},{opacity:1,x:0,duration:.6,ease:"power2.out"},TA);
tl.fromTo(q('.pcur'),{opacity:0,scale:1.8,transformOrigin:"50% 50%"},{opacity:1,scale:1,duration:.5,ease:"back.out(2)"},TA+.6);
""".replace("TA", str(t_ans))


CURSOR = f'<svg class="cursor" viewBox="0 0 40 52" style="position:absolute;left:0;top:0;width:40px;height:52px"><path d="M3 3 L3 42 L13 33 L20 49 L27 46 L20 30 L34 30 Z" fill="{INK}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>'

# ─────────────────────────── 01 title ───────────────────────────
frame("01-title", 5, """
$R .tlogo{position:absolute;left:0;width:1920px;top:230px;display:flex;justify-content:center;}
$R .tlogo .hanko{width:120px;height:120px;font-size:88px;}
$R .mark{position:absolute;left:0;width:1920px;top:400px;text-align:center;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:132px;letter-spacing:-3px;line-height:1.15;}
$R .sub{position:absolute;left:0;width:1920px;top:600px;text-align:center;font-size:46px;font-weight:500;color:#66686e;}
$R .sub b{font-weight:700;}
$R .row{position:absolute;left:805px;top:700px;width:320px;height:72px;}
""", f"""
<div class="tlogo"><span class="hanko">先</span></div>
<div class="mark">{words("Building Sensei")}</div>
<div class="sub"><span class="w s1">Five challenges.</span> <span class="w s2"><b class="indigo">Four</b> solved.</span> <span class="w s3"><b style="color:#8f6f3c">One</b> next step.</span></div>
<svg class="row" viewBox="0 0 320 72">{"".join(f'<polygon class="ph" points="{hex_points(30 + i * 62, 36, 24)}" fill="none" stroke="{LINE}" stroke-width="2.5" stroke-dasharray="5 5"/>' for i in range(5))}</svg>
""", """
tl.fromTo(q('.tlogo .hanko'),{opacity:0,scale:1.8,rotation:-20},{opacity:1,scale:1,rotation:-4,duration:.45,ease:"back.out(2.2)"},.1);
tl.fromTo(qa('.mark .w'),{opacity:0,y:40},{opacity:1,y:0,duration:.7,stagger:.12,ease:"power3.out"},.4);
tl.fromTo(q('.s1'),{opacity:0,y:20},{opacity:1,y:0,duration:.5},1.5);
tl.fromTo(q('.s2'),{opacity:0,y:20},{opacity:1,y:0,duration:.5},2.2);
tl.fromTo(q('.s3'),{opacity:0,y:20},{opacity:1,y:0,duration:.5},2.9);
tl.fromTo(qa('.ph'),{opacity:0,scale:.4,transformOrigin:"50% 50%"},{opacity:1,scale:1,duration:.35,stagger:.1,ease:"back.out(2)"},3.4);
""")

# ─────────────────────────── 02 purpose ───────────────────────────
HC2 = (1390, 490)
frame("02-purpose", 8, """
$R .title{left:180px;top:178px;width:960px;font-size:68px;}
$R .bl{position:absolute;left:184px;width:780px;display:flex;gap:22px;align-items:flex-start;font-size:36px;font-weight:700;line-height:1.35;}
$R .bl i{flex:none;display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin-top:2px;}
$R .hc{position:absolute;left:0;top:0;width:1920px;height:1080px;}
$R .foot{position:absolute;left:184px;top:790px;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:44px;color:#223a5e;}
""", f"""
<div class="chip"><b>{HEX_ICON}</b>Why Sensei</div>
<h1 class="h1 title">{words("Know-how that compounds.")}</h1>
{"".join(f'<div class="bl b{i}" style="top:{330 + i * 120}px"><i><svg width="40" height="40" viewBox="-20 -20 40 40"><polygon points="{hex_points(0, 0, 18)}" fill="{c}"/></svg></i><span>{t}</span></div>' for i, (t, c) in enumerate([("Capture it from experienced employees.", INDIGO), ("Filter out the real business logic.", HINOKI), ("Apply it, and teach new hires what it means for business decisions.", SHU)]))}
<svg class="hc" viewBox="0 0 1920 1080">{honey_svg("hx", HC2[0], HC2[1], 37, 40)}</svg>
<div class="foot">{words("Every answer adds a piece.")}</div>
""", """
tl.fromTo(q('.chip'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:"power2.out"},0);
tl.fromTo(qa('.title .w'),{opacity:0,y:34},{opacity:1,y:0,duration:.55,stagger:.08,ease:"power3.out"},.15);
const hx=qa('.hx');
const grow=(a,b,t,st)=>tl.fromTo(Array.prototype.slice.call(hx,a,b),{opacity:0,scale:0,transformOrigin:"50% 50%"},{opacity:1,scale:1,duration:.4,stagger:st,ease:"back.out(2)"},t);
grow(0,1,.5,.1);
tl.fromTo(q('.b0'),{opacity:0,x:-24},{opacity:1,x:0,duration:.5,ease:"power2.out"},1.3); grow(1,7,1.4,.1);
tl.fromTo(q('.b1'),{opacity:0,x:-24},{opacity:1,x:0,duration:.5,ease:"power2.out"},2.7); grow(7,19,2.8,.08);
tl.fromTo(q('.b2'),{opacity:0,x:-24},{opacity:1,x:0,duration:.5,ease:"power2.out"},4.1); grow(19,37,4.2,.07);
tl.fromTo(qa('.foot .w'),{opacity:0,y:24},{opacity:1,y:0,duration:.5,stagger:.08,ease:"power3.out"},6.0);
""")

# ─────────────────────────── 03 architecture ───────────────────────────
cards = [("1", "Expert at work", "Works as usual in the ERP, with the tab shared.", "BROWSER"),
         ("2", "Capture", "Each click: one screenshot, read by AI. A voice agent asks why at pauses.", "CLAUDE HAIKU · ELEVENLABS"),
         ("3", "Work Map", "Answers become rules, with quotes and screen moments. The expert confirms.", "CLAUDE OPUS"),
         ("4", "Teach", "A tutor agent watches the new hire, stops a wrong save and explains why.", "ELEVENLABS AGENT")]
cx = [180 + i * 415 for i in range(4)]
arch_cards = "".join(
    f'<div class="card ac ac{i}" style="left:{x}px"><div class="an"><b>{n}</b></div><div class="atit">{t}</div><div class="adesc">{d}</div><div class="atag">{tag}</div></div>'
    for i, ((n, t, d, tag), x) in enumerate(zip(cards, cx)))
arrows_h = "".join(f'<path class="ah ah{i}" d="M{x + 352} 470 h46 M{x + 384} 458 l14 12 l-14 12" fill="none" stroke="{INDIGO}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' for i, x in enumerate(cx[:3]))
vx = [c + 172 for c in cx]
arrows_v = (f'<path class="av av0" d="M{vx[1]} 632 v54 M{vx[1] - 12} 674 l12 12 l12 -12" fill="none" stroke="{INDIGO}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path class="av av1" d="M{vx[2]} 632 v54 M{vx[2] - 12} 674 l12 12 l12 -12" fill="none" stroke="{INDIGO}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path class="av av2" d="M{vx[3]} 688 v-54 M{vx[3] - 12} 646 l12 -12 l12 12" fill="none" stroke="{SHU}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>')
kb_hexes = "".join(f'<polygon class="kh" points="{hex_points(940 + i * 40 + (i % 2) * 0, 752 + (-12 if i % 2 else 12), 18)}" {hex_style(i)} stroke-width="2"/>' for i in range(18))
frame("03-architecture", 11, """
$R .title{left:180px;top:170px;width:1600px;font-size:64px;}
$R .ac{top:320px;width:345px;height:300px;padding:26px 26px 0;}
$R .an b{display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#223a5e;color:#fff;font-size:24px;font-weight:700;}
$R .atit{margin-top:14px;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:36px;}
$R .adesc{margin-top:8px;font-size:23px;font-weight:500;line-height:1.45;color:#66686e;}
$R .atag{position:absolute;left:26px;bottom:22px;font-size:15px;font-weight:700;letter-spacing:2.5px;color:#223a5e;}
$R .dg{position:absolute;left:0;top:0;width:1920px;height:1080px;}
$R .kb{left:180px;top:690px;width:1590px;height:124px;border:2px solid #223a5e;background:#f7f6f1;}
$R .kbt{position:absolute;left:34px;top:24px;font-size:22px;font-weight:700;letter-spacing:5px;color:#223a5e;}
$R .kbs{position:absolute;left:34px;top:62px;font-size:26px;font-weight:500;color:#66686e;}
""", f"""
<div class="chip"><b>{HEX_ICON}</b>Architecture</div>
<h1 class="h1 title">{words("From one expert to every new hire.")}</h1>
{arch_cards}
<div class="card kb"><div class="kbt">KNOWLEDGE BASE</div><div class="kbs">confirmed rules · expert quotes · screen moments</div></div>
<svg class="dg" viewBox="0 0 1920 1080">{arrows_h}{arrows_v}{kb_hexes}</svg>
""", """
tl.fromTo(q('.chip'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:"power2.out"},0);
tl.fromTo(qa('.title .w'),{opacity:0,y:30},{opacity:1,y:0,duration:.5,stagger:.07,ease:"power3.out"},.15);
const ac=qa('.ac'), ah=qa('.ah');
[.9,2.4,3.9,5.4].forEach((t,i)=>{
  tl.fromTo(ac[i],{opacity:0,y:30},{opacity:1,y:0,duration:.55,ease:"power2.out"},t);
  if(i>0){const L=ah[i-1].getTotalLength();tl.fromTo(ah[i-1],{strokeDasharray:L,strokeDashoffset:L},{strokeDashoffset:0,duration:.4,ease:"power2.out"},t-.3);}
});
tl.fromTo(q('.kb'),{opacity:0,y:24},{opacity:1,y:0,duration:.55,ease:"power2.out"},6.8);
const av=qa('.av');
[7.3,7.6,9.0].forEach((t,i)=>{const L=av[i].getTotalLength();tl.fromTo(av[i],{strokeDasharray:L,strokeDashoffset:L},{strokeDashoffset:0,duration:.45,ease:"power2.out"},t);});
tl.fromTo(qa('.kh'),{opacity:0,scale:0,transformOrigin:"50% 50%"},{opacity:1,scale:1,duration:.35,stagger:.1,ease:"back.out(2)"},7.6);
""")

# ─────────────────────────── 04 web ───────────────────────────
frame("04-web", 8, CH_CSS + """
$R .nat{left:1090px;top:420px;width:270px;height:200px;overflow:hidden;}
$R .wbar{position:absolute;left:0;right:0;top:0;height:40px;border-bottom:1px solid #d3d0c4;display:flex;align-items:center;gap:8px;padding:0 16px;}
$R .wbar i{display:block;width:11px;height:11px;border-radius:50%;background:#d3d0c4;}
$R .appicon{position:absolute;left:95px;top:78px;width:80px;height:80px;border-radius:20px;background:#b5b2a7;}
$R .web{left:1410px;top:350px;width:360px;height:320px;overflow:hidden;}
$R .url{margin-left:14px;flex:1;height:24px;border-radius:12px;background:#eceef1;font-size:14px;font-weight:700;color:#66686e;display:flex;align-items:center;padding-left:12px;}
$R .wb{position:absolute;left:30px;height:16px;border-radius:8px;background:#dfe4ec;}
$R .wbtn{position:absolute;left:30px;top:250px;width:150px;height:40px;border-radius:10px;background:#223a5e;}
$R .badge{position:absolute;left:1736px;top:322px;width:64px;height:64px;border-radius:50%;background:#223a5e;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(34,58,94,.3);}
$R .dg{position:absolute;left:0;top:0;width:1920px;height:1080px;}
""", ch_markup(1, "Web instead of native.",
               "The challenge guidelines pushed us into the browser. A native app, on a proper tech stack, would have felt smoother.",
               True, "We went all-in on a web app.", "One Next.js app in Chrome: screen sharing, voice agent and vision. Nothing to install.")
      + f"""
<div class="card nat"><div class="wbar"><i></i><i></i><i></i></div><div class="appicon"></div></div>
<div class="vlab nl" style="left:1090px;top:640px;width:270px">Native app</div>
<div class="card web"><div class="wbar"><i></i><i></i><i></i><div class="url">localhost · Sensei</div></div>
  {orb(62, 96, 48, 1, "o4w")}<div class="wb" style="top:140px;width:290px"></div><div class="wb" style="top:172px;width:240px"></div><div class="wb" style="top:204px;width:270px"></div><div class="wbtn"></div></div>
<div class="vlab wl" style="left:1410px;top:690px;width:360px">Web app · Next.js in Chrome</div>
<div class="badge">{check(36)}</div>
<svg class="dg" viewBox="0 0 1920 1080">
  <path class="cross" d="M1080 410 L1370 630" stroke="{SHU}" stroke-width="8" stroke-linecap="round"/>
  <path class="arr" d="M1368 520 h30 M1386 508 l12 12 l-12 12" fill="none" stroke="{INDIGO}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
""", ch_js(4.2) + """
tl.fromTo(q('.nat'),{opacity:0,y:24},{opacity:1,y:0,duration:.5,ease:"power2.out"},1.1);
tl.fromTo(q('.nl'),{opacity:0},{opacity:1,duration:.4},1.3);
const cr=q('.cross'),cl=cr.getTotalLength();
tl.fromTo(cr,{strokeDasharray:cl,strokeDashoffset:cl},{strokeDashoffset:0,duration:.45,ease:"power2.in"},2.4);
tl.fromTo(qa('.nat,.nl'),{opacity:1},{opacity:.4,duration:.5,immediateRender:false},2.9);
const ar=q('.arr'),al=ar.getTotalLength();
tl.fromTo(ar,{strokeDasharray:al,strokeDashoffset:al},{strokeDashoffset:0,duration:.4},3.6);
tl.fromTo(q('.web'),{opacity:0,scale:.9},{opacity:1,scale:1,duration:.55,ease:"back.out(1.6)"},3.9);
tl.fromTo(qa('.web .wb,.web .wbtn'),{scaleX:0,transformOrigin:"left center"},{scaleX:1,duration:.4,stagger:.1,ease:"power2.out"},4.3);
tl.fromTo(q('.wl'),{opacity:0},{opacity:1,duration:.4},4.4);
tl.fromTo(q('.badge'),{opacity:0,scale:.3},{opacity:1,scale:1,duration:.45,ease:"back.out(2.4)"},5.0);
""")

# ─────────────────────────── 06 time ───────────────────────────
segs = [("Teacher", INDIGO), ("AI agent", "#8f6f3c"), ("Apprentice", SHU)]
frame("05-time", 8.5, CH_CSS + """
$R .big{position:absolute;left:1100px;top:420px;width:660px;height:80px;display:flex;border-radius:14px;overflow:hidden;}
$R .seg{display:flex;align-items:center;justify-content:center;width:220px;height:80px;color:#fff;font-size:24px;font-weight:700;}
$R .small{position:absolute;left:1290px;top:650px;width:280px;height:56px;display:flex;border-radius:12px;overflow:hidden;}
$R .small div{width:93.3px;height:56px;}
$R .tl{position:absolute;font-family:"Shippori Mincho B1",serif;font-weight:800;}
$R .dg{position:absolute;left:0;top:0;width:1920px;height:1080px;}
""", ch_markup(2, "A 10-minute story in 1 minute.",
               "The ElevenLabs track describes 5–10 minutes of Teacher, AI agent and Apprentice. One minute forces us to cut most of the real interaction.",
               True, "We built a scripted player of the real app.", "The whole flow in about 55 seconds: real screens, real voices, no live calls.")
      + f"""
<div class="vlab l1" style="left:1100px;top:330px;width:660px;text-align:left">THE REAL FLOW</div>
<div class="tl t1" style="left:1100px;top:350px;font-size:52px;color:#1c1d21;width:660px;text-align:right">5–10 min</div>
<div class="big">{"".join(f'<div class="seg" style="background:{c}">{t}</div>' for t, c in segs)}</div>
<svg class="dg" viewBox="0 0 1920 1080"><path class="fun" d="M1100 512 L1290 640 M1760 512 L1570 640" stroke="{LINE}" stroke-width="3" stroke-dasharray="6 8" fill="none"/></svg>
<div class="small">{"".join(f'<div style="background:{c}"></div>' for _, c in segs)}</div>
<div class="vlab l2" style="left:1190px;top:722px;width:480px">SCRIPTED PLAYER</div>
<div class="tl t2" style="left:1590px;top:645px;font-size:52px;color:#223a5e">55 s</div>
""", ch_js(4.2) + """
tl.fromTo(q('.l1'),{opacity:0},{opacity:1,duration:.4},1.1);
tl.fromTo(qa('.seg'),{opacity:0,scaleX:0,transformOrigin:"left center"},{opacity:1,scaleX:1,duration:.5,stagger:.35,ease:"power2.out"},1.3);
tl.fromTo(q('.t1'),{opacity:0,y:16},{opacity:1,y:0,duration:.5,ease:"power2.out"},2.5);
tl.fromTo(q('.fun'),{opacity:0},{opacity:1,duration:.5},4.4);
tl.fromTo(qa('.small div'),{scaleX:0,transformOrigin:"left center"},{scaleX:1,duration:.3,stagger:.15,ease:"power2.out"},4.8);
tl.fromTo(q('.t2'),{opacity:0,scale:.6},{opacity:1,scale:1,duration:.45,ease:"back.out(2)"},5.4);
tl.fromTo(q('.l2'),{opacity:0},{opacity:1,duration:.4},5.6);
tl.fromTo(qa('.big,.t1,.l1'),{opacity:1},{opacity:.45,duration:.6,immediateRender:false},5.0);
""")


# ─────────────────────────── 07 credits ───────────────────────────
dense = "".join(f'<rect class="dt" x="{1100 + i * 22}" y="420" width="8" height="44" rx="4" fill="{SHU}"/>' for i in range(30))
clicks = [1150, 1290, 1340, 1500, 1610]
sparse = "".join(f'<g class="ck"><rect x="{x - 4}" y="640" width="8" height="44" rx="4" fill="{INDIGO}"/><circle cx="{x}" cy="618" r="9" fill="none" stroke="{INDIGO}" stroke-width="3"/></g>' for x in clicks)
frame("06-credits", 8.5, CH_CSS + """
$R .dg{position:absolute;left:0;top:0;width:1920px;height:1080px;}
$R .rl{position:absolute;left:1100px;font-size:22px;font-weight:700;letter-spacing:3px;}
$R .qt{position:absolute;left:1655px;top:720px;width:130px;text-align:center;font-size:18px;font-weight:700;color:#8f6f3c;line-height:1.3;}
""", ch_markup(3, "Screenshots cost credits.",
               "Analysing the screen every 1–2 seconds would have burned through our AI credits, mostly on frames where nothing changed.",
               True, "Sensei only looks when something happens.", "One screenshot after each click. After 15 quiet seconds, one gentle check-in.")
      + f"""
<div class="rl r1" style="top:370px;color:#b6402f">EVERY 1–2 SECONDS</div>
<div class="rl r2" style="top:560px;color:#223a5e">ONLY AFTER A CLICK</div>
<svg class="dg" viewBox="0 0 1920 1080">
  <line class="ax1" x1="1100" y1="476" x2="1760" y2="476" stroke="{LINE}" stroke-width="2"/>
  {dense}
  <line class="ax2" x1="1100" y1="696" x2="1760" y2="696" stroke="{LINE}" stroke-width="2"/>
  {sparse}
  <g class="qm"><path d="M1610 706 v14 M1720 706 v14 M1610 713 h110" stroke="{HINOKI}" stroke-width="3" stroke-dasharray="5 5"/><rect x="1716" y="640" width="8" height="44" rx="4" fill="none" stroke="{HINOKI}" stroke-width="3"/></g>
</svg>
<div class="qt">15 s quiet: check-in</div>
""", ch_js(4.4) + """
tl.fromTo(qa('.r1,.ax1'),{opacity:0},{opacity:1,duration:.4},1.1);
tl.fromTo(qa('.dt'),{opacity:0,scaleY:0,transformOrigin:"50% 100%"},{opacity:1,scaleY:1,duration:.2,stagger:.06,ease:"power2.out"},1.3);
tl.fromTo(qa('.r1,.ax1,.dt'),{opacity:1},{opacity:.35,duration:.6,immediateRender:false},4.6);
tl.fromTo(qa('.r2,.ax2'),{opacity:0},{opacity:1,duration:.4},4.8);
tl.fromTo(qa('.ck'),{opacity:0,scale:.3,transformOrigin:"50% 100%"},{opacity:1,scale:1,duration:.35,stagger:.3,ease:"back.out(2)"},5.0);
tl.fromTo(q('.qm'),{opacity:0},{opacity:1,duration:.4},6.6);
tl.fromTo(q('.qt'),{opacity:0},{opacity:1,duration:.4},6.7);
""")

# ─────────────────────────── 08 noise ───────────────────────────
bub = [(1080, 300), (1600, 250), (1770, 560), (1060, 640), (1430, 780)]
bubbles = "".join(
    f'<div class="bub bb{i}" style="left:{x}px;top:{y}px">' + "".join(f'<span style="height:{h}px"></span>' for h in [14, 26, 18, 30, 12][: 3 + i % 3]) + "</div>"
    for i, (x, y) in enumerate(bub))
frame("07-noise", 8.5, CH_CSS + """
$R .win{left:1140px;top:370px;width:600px;height:370px;overflow:hidden;}
$R .wbar{position:absolute;left:0;right:0;top:0;height:44px;border-bottom:1px solid #d3d0c4;display:flex;align-items:center;gap:8px;padding:0 16px;}
$R .wbar i{display:block;width:11px;height:11px;border-radius:50%;background:#d3d0c4;}
$R .wb{position:absolute;left:36px;height:18px;border-radius:9px;background:#e6e4dc;}
$R .corner{position:absolute;right:0;top:44px;width:150px;height:150px;}
$R .lis{position:absolute;left:1350px;top:560px;display:flex;align-items:center;gap:14px;padding:12px 24px 12px 14px;border-radius:999px;background:#223a5e;color:#fff;font-size:24px;font-weight:700;}
$R .lis .dot{width:36px;height:36px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#8fb0dd,#4a6a98);}
$R .bub{position:absolute;display:flex;align-items:center;gap:6px;padding:14px 18px;border-radius:24px;background:#fff;border:1px solid #d3d0c4;}
$R .bub span{display:block;width:6px;border-radius:3px;background:#b6402f;}
""", ch_markup(4, "A noisy hackathon hall.",
               "A voice agent hears the whole room, not just the expert in front of the screen.",
               True, "A hot corner pulls Sensei in.", "Rest the cursor in the top-right corner and Sensei listens actively.")
      + f"""
<div class="card win"><div class="wbar"><i></i><i></i><i></i></div>
  <div class="wb" style="top:90px;width:320px"></div><div class="wb" style="top:130px;width:260px"></div><div class="wb" style="top:170px;width:300px"></div><div class="wb" style="top:230px;width:220px"></div>
  <svg class="corner" viewBox="0 0 150 150"><path class="cg" d="M150 0 L150 150 L0 0 Z" fill="{INDIGO}" opacity=".9"/><circle class="cr" cx="150" cy="0" r="70" fill="none" stroke="{INDIGO}" stroke-width="3"/></svg>
  {CURSOR}
</div>
{bubbles}
<div class="lis"><div class="dot"></div>Sensei is listening</div>
""", ch_js(4.4) + """
tl.fromTo(q('.win'),{opacity:0,y:24},{opacity:1,y:0,duration:.5,ease:"power2.out"},1.0);
const bb=qa('.bub');
bb.forEach((b,i)=>{
  tl.fromTo(b,{opacity:0,scale:.5},{opacity:1,scale:1,duration:.35,ease:"back.out(2)"},1.6+i*.25);
  tl.fromTo(b.querySelectorAll('span'),{scaleY:.4},{scaleY:1.15,duration:.22,stagger:.05,repeat:9,yoyo:true,ease:"sine.inOut"},1.8+i*.25);
});
tl.fromTo(q('.cursor'),{x:250,y:250},{x:540,y:58,duration:1,ease:"power2.inOut"},4.7);
tl.fromTo(q('.cg'),{opacity:0,scale:.2,svgOrigin:"150 0"},{opacity:.9,scale:1,svgOrigin:"150 0",duration:.5,ease:"back.out(1.6)"},5.6);
tl.fromTo(q('.cr'),{opacity:.8,scale:.6,svgOrigin:"150 0"},{opacity:0,scale:2,svgOrigin:"150 0",duration:1,repeat:2,ease:"power1.out"},5.7);
tl.fromTo(q('.lis'),{opacity:0,y:20},{opacity:1,y:0,duration:.45,ease:"back.out(1.8)"},6.0);
tl.fromTo(bb,{opacity:1},{opacity:.15,duration:.6,immediateRender:false},6.0);
""")

# ─────────────────────────── 08 dedup ───────────────────────────
srcs = ["Sabine", "Tom", "Aylin"]
frame("08-dedup", 8.5, CH_CSS + """
$R .rc{left:1180px;width:560px;height:118px;padding:20px 26px;}
$R .rc .r1{font-size:24px;font-weight:700;}
$R .rc .r2{margin-top:8px;font-size:22px;font-weight:500;color:#66686e;}
$R .rc .k{display:inline-block;width:66px;font-size:16px;font-weight:700;letter-spacing:2px;color:#223a5e;}
$R .src{position:absolute;right:20px;top:20px;padding:4px 12px;border-radius:999px;background:#f3ead9;color:#8f6f3c;font-size:17px;font-weight:700;}
$R .dup{position:absolute;right:20px;bottom:18px;padding:4px 12px;border-radius:999px;border:2px solid #b6402f;color:#b6402f;font-size:15px;font-weight:700;letter-spacing:2px;}
$R .three{position:absolute;right:20px;bottom:18px;padding:5px 14px;border-radius:999px;background:#223a5e;color:#fff;font-size:17px;font-weight:700;}
$R .pl8{left:1180px;top:296px;}
""", ch_markup(5, "A knowledge base that only grows.",
               "Experts repeat themselves. Without merging recurring rules, the knowledge base fills up with duplicates.",
               False, "Detect recurring rules and merge them.", "One rule with many sources, so the base stays small and trustworthy.")
      + "".join(
          f'<div class="card rc rc{i}" style="top:{350 + i * 140}px"><div class="r1"><span class="k">IF</span>over €100 per project, per month</div><div class="r2"><span class="k">THEN</span>the project lead approves</div><div class="src">{s}</div>'
          + ('<div class="three">3 sources</div>' if i == 0 else '<div class="dup">DUPLICATE</div>') + "</div>"
          for i, s in reversed(list(enumerate(srcs))))
      + '<div class="tagp planned pl8">NEXT STEP · CONCEPT</div>',
      ch_js(4.6) + """
const rc=[q('.rc0'),q('.rc1'),q('.rc2')];
rc.forEach((c,i)=>tl.fromTo(c,{opacity:0,x:40},{opacity:1,x:0,duration:.5,ease:"power2.out"},1.1+i*.5));
tl.fromTo(qa('.dup'),{opacity:0,scale:.6},{opacity:1,scale:1,duration:.35,stagger:.2,ease:"back.out(2)"},2.9);
tl.fromTo(q('.pl8'),{opacity:0,scale:.6},{opacity:1,scale:1,duration:.4,ease:"back.out(2)"},5.3);
tl.fromTo(rc[1],{y:0},{y:-140,duration:.6,ease:"power2.inOut",immediateRender:false},5.7);
tl.fromTo(rc[2],{y:0},{y:-280,duration:.7,ease:"power2.inOut",immediateRender:false},5.8);
tl.fromTo([rc[1],rc[2]],{opacity:1},{opacity:0,duration:.3,immediateRender:false},6.3);
tl.fromTo(q('.three'),{opacity:0,scale:.5},{opacity:1,scale:1,duration:.45,ease:"back.out(2.2)"},6.5);
""")

# ─────────────────────────── 09 bigger picture ───────────────────────────
HC9 = (620, 530)
people9 = "".join(f'<g transform="translate({x} {y}) scale({s})">{PERSON}</g>' for x, y, s in [(-40, 14, .34), (40, 14, .34), (0, 6, .42)])
frame("09-bigger", 8, """
$R .title{left:0;width:1920px;top:96px;text-align:center;font-size:70px;}
$R .dg{position:absolute;left:0;top:0;width:1920px;height:1080px;}
$R .tg{position:absolute;font-size:44px;font-weight:700;}
$R .tg small{display:block;margin-top:4px;font-size:26px;font-weight:500;color:#66686e;}
$R .foot{position:absolute;left:0;width:1920px;top:836px;text-align:center;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:44px;color:#223a5e;}
""", f"""
<h1 class="h1 title">{words("Knowledge that never walks out the door.")}</h1>
<svg class="dg" viewBox="0 0 1920 1080">
  <path class="ln l1" d="M930 470 C 1030 420, 1090 400, 1180 400" fill="none" stroke="{INDIGO}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>
  <path class="ln l2" d="M930 600 C 1030 650, 1090 660, 1180 660" fill="none" stroke="{INDIGO}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>
  {honey_svg("hb", HC9[0], HC9[1], 61, 38)}
  <g class="ppl" transform="translate(1260 400)"><circle r="76" fill="#fff" stroke="{LINE}" stroke-width="2"/>{people9}</g>
  <g class="agent" transform="translate(1260 660)"><circle r="76" fill="#fff" stroke="{LINE}" stroke-width="2"/>
    <line x1="0" y1="-52" x2="0" y2="-36" stroke="{INDIGO}" stroke-width="5" stroke-linecap="round"/><circle cx="0" cy="-56" r="7" fill="{SHU}"/>
    <rect x="-44" y="-36" width="88" height="70" rx="20" fill="{INDIGO}"/><circle cx="-17" cy="-2" r="9" fill="#fff"/><circle cx="17" cy="-2" r="9" fill="#fff"/>
    <rect x="-16" y="16" width="32" height="5" rx="2.5" fill="#fff"/></g>
</svg>
<div class="tg t-p" style="left:1370px;top:350px">New hires<small>learn the why from day one</small></div>
<div class="tg t-a" style="left:1370px;top:610px">AI agents<small>act on confirmed rules, later</small></div>
<div class="foot">{words("It compounds with every expert and every decision.")}</div>
""", """
tl.fromTo(qa('.title .w'),{opacity:0,y:34},{opacity:1,y:0,duration:.55,stagger:.07,ease:"power3.out"},.1);
const hb=qa('.hb');
tl.fromTo(Array.prototype.slice.call(hb,0,37),{opacity:0,scale:0,transformOrigin:"50% 50%"},{opacity:1,scale:1,duration:.3,stagger:.015,ease:"back.out(2)"},.3);
tl.fromTo(Array.prototype.slice.call(hb,37),{opacity:0,scale:0,transformOrigin:"50% 50%"},{opacity:1,scale:1,duration:.4,stagger:.09,ease:"back.out(2)"},1.3);
tl.fromTo(q('.l1'),{opacity:0,strokeDashoffset:0},{opacity:1,strokeDashoffset:-28,duration:.5},2.6);
tl.fromTo(q('.l1'),{strokeDashoffset:-28},{strokeDashoffset:-150,duration:4.6,ease:"none",immediateRender:false},3.1);
tl.fromTo(q('.ppl'),{opacity:0,scale:.6,svgOrigin:"0 0"},{opacity:1,scale:1,svgOrigin:"0 0",duration:.5,ease:"back.out(2)"},2.8);
tl.fromTo(q('.t-p'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:"power2.out"},3.0);
tl.fromTo(q('.l2'),{opacity:0,strokeDashoffset:0},{opacity:1,strokeDashoffset:-28,duration:.5},3.8);
tl.fromTo(q('.l2'),{strokeDashoffset:-28},{strokeDashoffset:-120,duration:3.4,ease:"none",immediateRender:false},4.3);
tl.fromTo(q('.agent'),{opacity:0,scale:.6,svgOrigin:"0 0"},{opacity:1,scale:1,svgOrigin:"0 0",duration:.5,ease:"back.out(2)"},4.0);
tl.fromTo(q('.t-a'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:"power2.out"},4.2);
tl.fromTo(qa('.foot .w'),{opacity:0,y:24},{opacity:1,y:0,duration:.45,stagger:.07,ease:"power3.out"},5.4);
""")

# ─────────────────────────── 10 close ───────────────────────────
frame("10-close", 4.5, """
$R .logo{position:absolute;left:0;width:1920px;top:350px;display:flex;justify-content:center;align-items:center;gap:44px;}
$R .logo .hanko{width:170px;height:170px;font-size:124px;border-radius:16px;box-shadow:inset 0 0 0 6px #b6402f,inset 0 0 0 11px rgba(247,246,241,.67);}
$R .wm{display:block;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:190px;line-height:1.1;letter-spacing:-2px;}
$R .wm span{display:inline-block;}
$R .slogan{position:absolute;left:0;width:1920px;top:640px;text-align:center;font-size:54px;font-weight:500;color:#223a5e;}
""", f"""
<div class="logo"><span class="hk"><span class="hanko">先</span></span><span class="wm">{"".join(f'<span class="cc">{c}</span>' for c in "Sensei")}</span></div>
<div class="slogan">{words("Teach the next generation.")}</div>
""", """
tl.fromTo(q('.hk'),{opacity:0,scale:1.8,rotation:-20},{opacity:1,scale:1,rotation:-4,duration:.45,ease:"back.out(2.2)"},.1);
qa('.cc').forEach((c,i)=>tl.fromTo(c,{opacity:0,y:40,x:(i-2.5)*22},{opacity:1,y:0,x:0,duration:.9,ease:"power3.out"},.3+i*.04));
tl.fromTo(qa('.slogan .w'),{opacity:0,y:24},{opacity:1,y:0,duration:.5,stagger:.12,ease:"power3.out"},1.4);
""")

NEWDUR = {"01-title": 3.5, "02-purpose": 6, "03-architecture": 8, "04-web": 6.5, "05-time": 6.5, "06-credits": 6.5,
          "07-noise": 6.5, "08-dedup": 6.5, "09-bigger": 6, "10-close": 3.5}

for fid, odur, css, markup, js in FRAMES:
    dur = NEWDUR[fid]
    k = round(odur / dur, 4)
    R = f'[data-composition-id="{fid}"]'
    style = FONTS + (BASE + css).replace("$R", R)
    html = f"""<template>
  <div id="root" data-composition-id="{fid}" data-start="0" data-width="1920" data-height="1080" data-duration="{dur}">
    <style>{style}</style>
    <div id="f{fid}-bg" class="clip bg" data-start="0" data-duration="{dur}" data-track-index="0"><div class="bg-rule"></div></div>
    <div class="stage">{markup}</div>
    <script src="{GSAP}"></script>
    <script>
      (function () {{
        const R = document.querySelector('[data-composition-id="{fid}"] .stage').parentElement;
        const q = (s) => R.querySelector(s);
        const qa = (s) => R.querySelectorAll(s);
        const main = gsap.timeline({{ paused: true }});
        const tl = gsap.timeline();
        main.add(tl, 0);
{js}
        tl.timeScale({k});
        window.__timelines["{fid}"] = main;
      }})();
    </script>
  </div>
</template>
"""
    with open(os.path.join(OUT, f"{fid}.html"), "w") as f:
        f.write(html)
    print("wrote", fid, dur)
print("total", sum(NEWDUR.values()))
