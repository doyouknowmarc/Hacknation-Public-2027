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


# ─────────────────────────── 01 hook ───────────────────────────
tok1 = ["€", "%", "?", "§", "!", "€"]
ring_dots = ""
for i in range(14):
    r = [150, 210, 270][i % 3]
    a = i * 360 / 14 + (i % 3) * 17
    x = 300 + r * math.cos(math.radians(a))
    y = 300 + r * math.sin(math.radians(a))
    ring_dots += f'<circle class="dot" cx="{x:.1f}" cy="{y:.1f}" r="{7 + (i % 3) * 3}" fill="{HINOKI}"/>'
tokens1 = ""
for i, t in enumerate(tok1):
    a = math.radians(i * 60 + 25)
    x = 300 + 240 * math.cos(a)
    y = 300 + 240 * math.sin(a)
    tokens1 += f'<div class="token t1" style="left:{180 + x - 26:.0f}px;top:{190 + y - 26:.0f}px">{t}</div>'

frame("01-hook", 5.5, """
$R .fig{position:absolute;left:180px;top:190px;width:600px;height:600px;}
$R .title{left:840px;top:290px;width:1000px;font-size:92px;}
$R .sub{position:absolute;left:844px;top:560px;font-size:46px;font-weight:500;line-height:1.5;color:#66686e;}
$R .sub div{display:block;width:fit-content;}
$R .why{color:#b6402f;font-weight:700;position:relative;}
$R .brush{position:absolute;left:0;bottom:-4px;height:6px;width:100%;background:#b6402f;border-radius:3px;transform-origin:left center;}
""", f"""
<svg class="fig" viewBox="0 0 600 600">
  <g class="rings" fill="none" stroke="{LINE}" stroke-width="2"><circle cx="300" cy="300" r="150"/><circle cx="300" cy="300" r="210"/><circle cx="300" cy="300" r="270"/></g>
  <g class="orbit">{ring_dots}</g>
  <g class="person" transform="translate(300 320)">{PERSON}</g>
</svg>
{tokens1}
<h1 class="h1 title"><span style="display:block">{words("In every company,")}</span><span style="display:block">{words("someone just knows.")}</span></h1>
<div class="sub"><div class="s1">Which invoice to approve.</div><div class="s2">Which one to hold.</div><div class="s3 why">And why.<span class="brush"></span></div></div>
""", """
tl.fromTo(q('.person'),{opacity:0,scale:.7,svgOrigin:"300 320"},{opacity:1,scale:1,svgOrigin:"300 320",duration:.7,ease:"back.out(1.6)"},0);
tl.fromTo(qa('.rings circle'),{opacity:0,scale:.85,svgOrigin:"300 300"},{opacity:1,scale:1,svgOrigin:"300 300",duration:.8,stagger:.12,ease:"power2.out"},.1);
tl.fromTo(qa('.dot'),{opacity:0},{opacity:1,duration:.4,stagger:.07},.4);
tl.fromTo(q('.orbit'),{rotation:-25,svgOrigin:"300 300"},{rotation:35,svgOrigin:"300 300",duration:5.5,ease:"none"},0);
tl.fromTo(qa('.t1'),{opacity:0,scale:.4},{opacity:1,scale:1,duration:.45,stagger:.18,ease:"back.out(2)"},.9);
tl.fromTo(qa('.t1'),{y:0},{y:-14,duration:4,ease:"sine.inOut"},1);
tl.fromTo(qa('.title .w'),{opacity:0,y:40},{opacity:1,y:0,duration:.6,stagger:.09,ease:"power3.out"},.3);
tl.fromTo(q('.s1'),{opacity:0,x:-24},{opacity:1,x:0,duration:.5,ease:"power2.out"},2.1);
tl.fromTo(q('.s2'),{opacity:0,x:-24},{opacity:1,x:0,duration:.5,ease:"power2.out"},2.8);
tl.fromTo(q('.s3'),{opacity:0,x:-24},{opacity:1,x:0,duration:.5,ease:"power2.out"},3.6);
tl.fromTo(q('.brush'),{scaleX:0},{scaleX:1,duration:.5,ease:"power2.inOut"},4.2);
""")

# ─────────────────────────── 02 problem ───────────────────────────
tok2 = ["€", "%", "?", "§", "!", "€", "?", "%", "§", "€", "!", "?"]
tokens2 = ""
for i, t in enumerate(tok2):
    x = 330 + (i % 4) * 70 + (i // 4) * 18
    y = 470 + (i // 4) * 80 + (i % 2) * 24
    tokens2 += f'<div class="token t2" style="left:{x}px;top:{y}px">{t}</div>'

frame("02-problem", 6.5, """
$R .title{left:180px;top:118px;width:1600px;font-size:84px;}
$R .sub{position:absolute;left:184px;top:345px;font-size:44px;font-weight:500;color:#66686e;}
$R .figure{position:absolute;left:330px;top:520px;width:300px;height:340px;}
$R .door{position:absolute;left:1340px;top:430px;width:250px;height:432px;}
$R .floor{position:absolute;left:200px;top:861px;width:1520px;height:2px;background:#d3d0c4;transform-origin:left center;}
""", f"""
<h1 class="h1 title"><span style="display:block">{words("When she retires,")}</span><span style="display:block">{words("her know-how walks out the door.")}</span></h1>
<div class="sub">Most of it was <span class="shu" style="font-weight:700">never</span> written down.</div>
<div class="floor"></div>
<svg class="figure" viewBox="-150 -170 300 340"><g class="person" transform="translate(0 40) scale(1.25)">{PERSON}</g></svg>
<svg class="door" viewBox="0 0 250 432">
  <defs><linearGradient id="g02door" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{INDIGO}"/><stop offset="1" stop-color="{DEEP}"/></linearGradient></defs>
  <rect class="opening" x="6" y="6" width="238" height="426" fill="url(#g02door)"/>
  <path class="leaf" d="M244 6 L320 40 L320 470 L244 432 Z" fill="{PAPER}" stroke="{INK}" stroke-width="4" transform="translate(-76 -20)"/>
  <rect x="6" y="6" width="238" height="426" fill="none" stroke="{INK}" stroke-width="6"/>
</svg>
{tokens2}
""", """
tl.fromTo(qa('.title .w'),{opacity:0,y:36},{opacity:1,y:0,duration:.55,stagger:.07,ease:"power3.out"},.15);
tl.fromTo(q('.floor'),{scaleX:0},{scaleX:1,duration:1,ease:"power2.out"},.2);
tl.fromTo(q('.figure'),{opacity:0},{opacity:1,duration:.5},.3);
tl.fromTo(q('.door'),{opacity:0,y:20},{opacity:1,y:0,duration:.6,ease:"power2.out"},.5);
tl.fromTo(qa('.t2'),{opacity:0,scale:.4},{opacity:1,scale:1,duration:.35,stagger:.05,ease:"back.out(2)"},.6);
const door={x:1440,y:640};
qa('.t2').forEach((el,i)=>{
  const dx=door.x-(el.offsetLeft+26), dy=door.y-(el.offsetTop+26);
  tl.fromTo(el,{x:0,y:0},{x:dx,y:dy,duration:1.5,ease:"power1.in"},1.6+i*.17);
  tl.fromTo(el,{opacity:1,scale:1},{opacity:0,scale:.5,duration:.35,immediateRender:false},1.6+i*.17+1.25);
});
tl.fromTo(q('.figure'),{opacity:1},{opacity:.25,duration:2.6,ease:"power1.inOut",immediateRender:false},2.6);
tl.fromTo(q('.sub'),{opacity:0,y:20},{opacity:1,y:0,duration:.6,ease:"power2.out"},3.3);
""")

# ─────────────────────────── 03 gap ───────────────────────────
bars = "".join(f'<div class="bar" style="top:{560 + i * 46}px;width:{w}px"></div>' for i, w in enumerate([520, 470, 540, 400, 500]))
frame("03-gap", 6.0, """
$R .divider{position:absolute;left:959px;top:200px;width:2px;height:660px;background:#d3d0c4;transform-origin:center top;}
$R .l-label{left:200px;top:236px;}
$R .what{left:196px;top:290px;font-size:112px;color:#7d7a72;font-weight:600;}
$R .bar{position:absolute;left:200px;height:16px;border-radius:8px;background:#d9d6cb;transform-origin:left center;}
$R .r-label{left:1060px;top:226px;color:#b6402f;}
$R .why{left:1052px;top:290px;font-size:190px;color:#b6402f;line-height:1.1;}
$R .ask{left:1060px;top:540px;padding:22px 30px;font-size:32px;font-weight:700;}
$R .reply{position:absolute;left:1060px;top:668px;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:64px;color:#223a5e;}
$R .reply2{position:absolute;left:1064px;top:766px;font-size:30px;font-weight:500;color:#66686e;}
""", f"""
<div class="divider"></div>
<div class="label l-label">The manual</div>
<h1 class="h1 what">What to do.</h1>
{bars}
<div class="label r-label">The expert</div>
<h1 class="h1 why">Why.</h1>
<div class="card ask">€180 software invoice. Approve?</div>
<div class="reply">“It depends.”</div>
<div class="reply2">on the project, the month, the budget.</div>
""", """
tl.fromTo(q('.divider'),{scaleY:0},{scaleY:1,duration:.9,ease:"power2.out"},0);
tl.fromTo(q('.l-label'),{opacity:0},{opacity:1,duration:.4},.15);
tl.fromTo(q('.what'),{opacity:0,y:30},{opacity:1,y:0,duration:.6,ease:"power3.out"},.25);
tl.fromTo(qa('.bar'),{scaleX:0},{scaleX:1,duration:.5,stagger:.1,ease:"power2.out"},.7);
tl.fromTo(q('.r-label'),{opacity:0},{opacity:1,duration:.4},2.2);
tl.fromTo(q('.why'),{opacity:0,scale:1.35,transformOrigin:"left center"},{opacity:1,scale:1,duration:.7,ease:"back.out(1.7)"},2.35);
tl.fromTo(q('.ask'),{opacity:0,y:24},{opacity:1,y:0,duration:.5,ease:"power2.out"},3.3);
tl.fromTo(q('.reply'),{opacity:0,y:24},{opacity:1,y:0,duration:.5,ease:"power2.out"},4.2);
tl.fromTo(q('.reply2'),{opacity:0},{opacity:1,duration:.5},4.9);
tl.fromTo(qa('.what,.bar'),{opacity:1},{opacity:.8,duration:1,immediateRender:false},2.4);
""")

# ─────────────────────────── 04 capture ───────────────────────────
rows = [("INV 2041", "Office supplies", "€700"), ("INV 2042", "Claude · Project Atlas", "€180"), ("INV 2043", "Office rent", "€3,000")]
rows_html = "".join(
    f'<div class="row r{i}" style="top:{92 + i * 112}px"><span class="no">{a}</span><span class="what">{b}</span><span class="amt">{c}</span>'
    f'<span class="st st-a">Ready</span>{"<span class=" + chr(34) + "st st-b" + chr(34) + ">Awaiting approval</span>" if i == 1 else ""}</div>'
    for i, (a, b, c) in enumerate(rows))
langs = ["EN", "DE", "FR", "ES", "JA"]
whys = ["Why?", "Warum?", "Pourquoi ?", "¿Por qué?", "なぜ？"]
frame("04-capture", 7.5, """
$R .title{left:180px;top:178px;width:1600px;font-size:68px;}
$R .win{left:180px;top:330px;width:880px;height:470px;overflow:hidden;}
$R .bar{position:absolute;left:0;top:0;right:0;height:62px;border-bottom:1px solid #d3d0c4;display:flex;align-items:center;gap:10px;padding:0 24px;font-size:22px;font-weight:700;color:#66686e;}
$R .bar i{width:14px;height:14px;border-radius:50%;background:#d3d0c4;display:block;}
$R .bar span{margin-left:16px;}
$R .row{position:absolute;left:18px;right:18px;height:96px;border-radius:14px;display:flex;align-items:center;gap:22px;padding:0 22px;font-size:27px;}
$R .row .no{font-weight:700;color:#66686e;width:130px;}
$R .row .what{flex:1;font-weight:500;margin-top:-26px;}
$R .row .amt{font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:32px;width:130px;text-align:right;}
$R .row .st{position:absolute;left:174px;top:62px;font-size:17px;font-weight:700;letter-spacing:1px;color:#66686e;}
$R .row .st-b{color:#b6402f;}
$R .row .amt{margin-right:0;}
$R .hl{position:absolute;left:18px;right:18px;top:204px;height:96px;border-radius:14px;background:#dfe4ec;}
$R .cursor{position:absolute;left:0;top:0;width:40px;height:52px;}
$R .ripple{position:absolute;width:60px;height:60px;border-radius:50%;border:3px solid #223a5e;}
$R .bubble{left:1220px;top:330px;width:560px;height:200px;border-radius:32px;}
$R .bubble .tail{position:absolute;left:130px;bottom:-22px;width:40px;height:40px;background:#fff;border-right:1px solid #d3d0c4;border-bottom:1px solid #d3d0c4;transform:rotate(45deg);}
$R .wy{position:absolute;left:0;right:0;top:44px;text-align:center;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:96px;line-height:1.1;color:#b6402f;}
$R .langs{position:absolute;left:1220px;top:720px;width:560px;display:flex;justify-content:center;gap:26px;font-size:24px;font-weight:700;letter-spacing:3px;color:#b5b2a7;}
$R .langs span{display:block;}
$R .tags{position:absolute;left:180px;top:830px;width:1600px;display:flex;gap:18px;}
$R .tag{display:block;padding:10px 26px;border-radius:999px;background:#fff;border:1px solid #d3d0c4;font-size:26px;font-weight:700;color:#223a5e;}
""", f"""
<div class="chip"><b>1</b>Capture</div>
<h1 class="h1 title">{words("Sensei sits quietly beside the expert.")}</h1>
<div class="card win"><div class="bar"><i></i><i></i><i></i><span>Invoices · Sabine</span></div><div class="hl"></div>{rows_html}
  <div class="ripple" style="left:520px;top:222px"></div>
  <svg class="cursor" viewBox="0 0 40 52"><path d="M3 3 L3 42 L13 33 L20 49 L27 46 L20 30 L34 30 Z" fill="{INK}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>
</div>
{orb(1360, 620, 110, 2, "o4")}
<div class="card bubble"><div class="tail"></div>{"".join(f'<div class="wy wy{i}">{w}</div>' for i, w in enumerate(whys))}</div>
<div class="langs">{"".join(f'<span class="lg lg{i}">{l}</span>' for i, l in enumerate(langs))}</div>
<div class="tags"><span class="tag">No forms</span><span class="tag">No extra meetings</span><span class="tag">Any language</span></div>
""", """
tl.fromTo(q('.chip'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:"power2.out"},0);
tl.fromTo(qa('.title .w'),{opacity:0,y:30},{opacity:1,y:0,duration:.5,stagger:.07,ease:"power3.out"},.15);
tl.fromTo(q('.win'),{opacity:0,y:30},{opacity:1,y:0,duration:.6,ease:"power2.out"},.35);
tl.fromTo(qa('.row'),{opacity:0},{opacity:1,duration:.3,stagger:.1},.6);
tl.fromTo(q('.hl'),{opacity:0},{opacity:0,duration:.01},0);
tl.fromTo(q('.cursor'),{x:760,y:420},{x:540,y:244,duration:1,ease:"power2.inOut"},.7);
tl.fromTo(q('.ripple'),{opacity:.9,scale:.2},{opacity:0,scale:1.4,duration:.6,ease:"power2.out",immediateRender:false},1.75);
tl.fromTo(q('.hl'),{opacity:0},{opacity:1,duration:.3,immediateRender:false},1.75);
tl.fromTo(q('.r1 .st-a'),{opacity:1},{opacity:0,duration:.2,immediateRender:false},2.1);
tl.fromTo(q('.r1 .st-b'),{opacity:0},{opacity:1,duration:.3},2.15);
tl.fromTo(q('.o4'),{opacity:0,scale:.5},{opacity:1,scale:1,duration:.6,ease:"back.out(2)"},.9);
tl.fromTo(qa('.o4 .ring'),{opacity:.8,scale:1},{opacity:0,scale:1.9,duration:1.1,stagger:.35,repeat:3,ease:"power1.out"},2.3);
tl.fromTo(q('.bubble'),{opacity:0,scale:.85,transformOrigin:"25% 100%"},{opacity:1,scale:1,duration:.5,ease:"back.out(1.8)"},2.4);
const W=qa('.wy'), L=qa('.lg');
W.forEach((el,i)=>{
  const t=2.55+i*.72;
  tl.fromTo(el,{opacity:0,y:30},{opacity:1,y:0,duration:.28,ease:"power2.out"},t);
  tl.fromTo(L[i],{color:"#b5b2a7"},{color:"#223a5e",duration:.2},t);
  if(i<W.length-1){
    tl.fromTo(el,{opacity:1,y:0},{opacity:0,y:-30,duration:.22,ease:"power2.in",immediateRender:false},t+.5);
    tl.fromTo(L[i],{color:"#223a5e"},{color:"#b5b2a7",duration:.2,immediateRender:false},t+.5);
  }
});
tl.fromTo(qa('.langs'),{opacity:0},{opacity:1,duration:.4},2.5);
tl.fromTo(qa('.tag'),{opacity:0,y:20},{opacity:1,y:0,duration:.4,stagger:.22,ease:"power2.out"},5.4);
""")

# ─────────────────────────── 05 map ───────────────────────────
frame("05-map", 6.5, """
$R .title{left:180px;top:178px;width:1600px;font-size:68px;}
$R .quote{left:180px;top:350px;width:640px;height:330px;padding:40px 44px;}
$R .av{position:absolute;left:44px;top:40px;width:72px;height:72px;border-radius:50%;background:#8f6f3c;color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:36px;}
$R .who{position:absolute;left:136px;top:52px;font-size:24px;font-weight:700;color:#66686e;letter-spacing:1px;}
$R .qt{position:absolute;left:44px;top:140px;right:40px;font-family:"Shippori Mincho B1",serif;font-weight:600;font-size:40px;line-height:1.35;}
$R .arrow{position:absolute;left:850px;top:480px;width:150px;height:60px;}
$R .rule{left:1030px;top:330px;width:720px;height:380px;overflow:hidden;}
$R .rule .top{position:absolute;left:0;right:0;top:0;height:10px;background:#223a5e;}
$R .rule .lbl{position:absolute;left:44px;top:44px;font-size:22px;font-weight:700;letter-spacing:5px;color:#66686e;}
$R .ln{position:absolute;left:44px;right:40px;display:flex;gap:22px;align-items:flex-start;font-size:36px;font-weight:700;line-height:1.3;}
$R .ln .k{flex:none;display:block;width:96px;text-align:center;padding:6px 0;border-radius:10px;color:#fff;font-size:24px;letter-spacing:3px;margin-top:4px;}
$R .ln1{top:110px;} $R .ln1 .k{background:#223a5e;}
$R .ln2{top:250px;} $R .ln2 .k{background:#b6402f;}
$R .ln .tx{display:block;}
$R .stamp{position:absolute;left:1570px;top:600px;width:210px;height:210px;border-radius:50%;border:7px solid #b6402f;color:#b6402f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:rgba(247,246,241,.85);}
$R .stamp .s1{font-weight:700;font-size:22px;letter-spacing:3px;}
$R .stamp .s2{font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:40px;}
$R .foot{position:absolute;left:180px;top:780px;display:flex;align-items:center;gap:16px;font-size:28px;font-weight:500;color:#66686e;}
""", f"""
<div class="chip"><b>2</b>Work Map</div>
<h1 class="h1 title">{words("Her answer becomes a clear rule.")}</h1>
<div class="card quote"><div class="av">S</div><div class="who">SABINE · EXPERT</div><div class="qt">“Over €100 per project a month? Then the project lead decides.”</div></div>
<svg class="arrow" viewBox="0 0 150 60"><path class="ap" d="M6 30 H130 M108 10 L132 30 L108 50" fill="none" stroke="{INDIGO}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
<div class="card rule"><div class="top"></div><div class="lbl">RULE</div>
  <div class="ln ln1"><span class="k">IF</span><span class="tx">software spend is over €100 per project, per month</span></div>
  <div class="ln ln2"><span class="k">THEN</span><span class="tx">the project lead approves</span></div>
</div>
<div class="stamp"><div class="s0">{check(40, SHU)}</div><div class="s1">CONFIRMED</div><div class="s2">Sabine</div></div>
<div class="foot"><svg width="34" height="34" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2" fill="none" stroke="{MUTED}" stroke-width="2"/><path d="M8 21h8" stroke="{MUTED}" stroke-width="2"/></svg>Linked to her screen moment and her own words</div>
""", """
tl.fromTo(q('.chip'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:"power2.out"},0);
tl.fromTo(qa('.title .w'),{opacity:0,y:30},{opacity:1,y:0,duration:.5,stagger:.07,ease:"power3.out"},.15);
tl.fromTo(q('.quote'),{opacity:0,y:30},{opacity:1,y:0,duration:.6,ease:"power2.out"},.4);
const ap=q('.ap'); const len=ap.getTotalLength();
tl.fromTo(ap,{strokeDasharray:len,strokeDashoffset:len},{strokeDashoffset:0,duration:.6,ease:"power2.out"},1.9);
tl.fromTo(q('.rule'),{opacity:0,x:40},{opacity:1,x:0,duration:.6,ease:"power2.out"},2.2);
tl.fromTo(q('.ln1'),{opacity:0,y:16},{opacity:1,y:0,duration:.5,ease:"power2.out"},2.7);
tl.fromTo(q('.ln2'),{opacity:0,y:16},{opacity:1,y:0,duration:.5,ease:"power2.out"},3.5);
tl.fromTo(q('.stamp'),{opacity:0,scale:1.9,rotation:-30},{opacity:1,scale:1,rotation:-12,duration:.45,ease:"back.out(2.2)"},4.4);
tl.fromTo(q('.foot'),{opacity:0,y:16},{opacity:1,y:0,duration:.5,ease:"power2.out"},5.1);
""")

# ─────────────────────────── 06 teach ───────────────────────────
frame("06-teach", 7.5, """
$R .title{left:180px;top:178px;width:1600px;font-size:68px;}
$R .inv{left:180px;top:330px;width:800px;height:470px;}
$R .inv .hd{position:absolute;left:44px;top:40px;font-size:24px;font-weight:700;color:#66686e;letter-spacing:1px;}
$R .inv .nm{position:absolute;left:44px;top:80px;font-size:34px;font-weight:700;}
$R .inv .amt{position:absolute;left:40px;top:142px;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:130px;line-height:1.1;}
$R .inv .spent{position:absolute;left:44px;top:304px;font-size:28px;font-weight:500;color:#66686e;}
$R .btn{position:absolute;top:360px;height:76px;border-radius:14px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:28px;font-weight:700;}
$R .b-ok{left:44px;width:240px;background:#223a5e;color:#fff;}
$R .b-ok .x{position:absolute;inset:-5px;border:4px solid #b6402f;border-radius:18px;}
$R .b-lead{left:310px;width:446px;border:2px solid #223a5e;color:#223a5e;background:#fff;}
$R .b-lead .fill{position:absolute;inset:-2px;border-radius:14px;background:#223a5e;color:#fff;display:flex;align-items:center;justify-content:center;gap:12px;}
$R .cursor{position:absolute;left:0;top:0;width:40px;height:52px;}
$R .note{left:1200px;top:330px;width:560px;height:350px;border-left:10px solid #b6402f;border-radius:10px 22px 22px 10px;padding:0;}
$R .note .n1{position:absolute;left:44px;top:34px;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:64px;color:#b6402f;}
$R .note .n2{position:absolute;left:44px;top:140px;right:30px;font-size:36px;font-weight:700;line-height:1.3;}
$R .note .n3{position:absolute;left:44px;top:250px;right:30px;font-size:26px;font-weight:500;color:#66686e;line-height:1.4;}
$R .out{position:absolute;left:180px;top:828px;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:50px;color:#223a5e;}
""", f"""
<div class="chip"><b>3</b>Teach</div>
<h1 class="h1 title">{words("Lena is new. Sensei has her back.")}</h1>
<div class="card inv"><div class="hd">INV 2051 · NEW HIRE CASE</div><div class="nm">Claude · Project Orion</div><div class="amt">€90</div>
  <div class="spent">Already spent this month: €40</div>
  <div class="btn b-ok">Approve<div class="x"></div></div>
  <div class="btn b-lead">Send to project lead<div class="fill">{check(30)} Sent to project lead</div></div>
  <svg class="cursor" viewBox="0 0 40 52"><path d="M3 3 L3 42 L13 33 L20 49 L27 46 L20 30 L34 30 Z" fill="{INK}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>
</div>
{orb(1110, 380, 90, 2, "o6")}
<div class="card note"><div class="n1">Wait!</div><div class="n2">€40 + €90 = €130 this month.</div><div class="n3">Sabine: “Over €100? The project lead decides.”</div></div>
<div class="out">{words("Mistake caught — before it happens.")}</div>
""", """
tl.fromTo(q('.chip'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:"power2.out"},0);
tl.fromTo(qa('.title .w'),{opacity:0,y:30},{opacity:1,y:0,duration:.5,stagger:.07,ease:"power3.out"},.15);
tl.fromTo(q('.inv'),{opacity:0,y:30},{opacity:1,y:0,duration:.6,ease:"power2.out"},.4);
tl.fromTo(q('.cursor'),{x:620,y:470},{x:170,y:395,duration:1.2,ease:"power2.inOut"},.9);
tl.fromTo(q('.b-ok .x'),{opacity:0,scale:1.2},{opacity:1,scale:1,duration:.3,ease:"back.out(2)"},2.15);
tl.fromTo(q('.b-ok'),{x:0},{x:10,duration:.06,repeat:5,yoyo:true,ease:"none"},2.2);
tl.fromTo(q('.o6'),{opacity:0,scale:.5},{opacity:1,scale:1,duration:.5,ease:"back.out(2)"},2.1);
tl.fromTo(qa('.o6 .ring'),{opacity:.8,scale:1},{opacity:0,scale:1.9,duration:1,stagger:.3,repeat:2,ease:"power1.out"},2.3);
tl.fromTo(q('.note'),{opacity:0,x:40},{opacity:1,x:0,duration:.5,ease:"power2.out"},2.3);
tl.fromTo(q('.n2'),{opacity:0},{opacity:1,duration:.4},2.9);
tl.fromTo(q('.n3'),{opacity:0},{opacity:1,duration:.4},3.6);
tl.fromTo(q('.cursor'),{x:170,y:395},{x:560,y:400,duration:.8,ease:"power2.inOut",immediateRender:false},4.5);
tl.fromTo(q('.b-ok'),{opacity:1},{opacity:.35,duration:.4,immediateRender:false},5.3);
tl.fromTo(q('.b-ok .x'),{opacity:1},{opacity:0,duration:.3,immediateRender:false},5.3);
tl.fromTo(q('.b-lead .fill'),{opacity:0,scale:.9},{opacity:1,scale:1,duration:.35,ease:"back.out(2)"},5.35);
tl.fromTo(qa('.out .w'),{opacity:0,y:24},{opacity:1,y:0,duration:.45,stagger:.08,ease:"power3.out"},5.8);
""")

# ─────────────────────────── 07 compound ───────────────────────────
CX, CY, R = 960, 490, 280
nodes = [("1", "Capture", "watch &amp; ask why", -90), ("2", "Work Map", "rules, confirmed", 30), ("3", "Teach", "guide new hires", 150)]
node_html = ""
for i, (n, name, sub, a) in enumerate(nodes):
    x = CX + R * math.cos(math.radians(a))
    y = CY + R * math.sin(math.radians(a))
    node_html += (f'<div class="node nd{i}" style="left:{x - 125:.0f}px;top:{y - 38:.0f}px"><b>{n}</b>{name}</div>'
                  f'<div class="nsub ns{i}" style="left:{x - 160:.0f}px;top:{y + 46:.0f}px">{sub}</div>')


def arc(a0, a1, r=R):
    x0, y0 = CX + r * math.cos(math.radians(a0)), CY + r * math.sin(math.radians(a0))
    x1, y1 = CX + r * math.cos(math.radians(a1)), CY + r * math.sin(math.radians(a1))
    return f"M{x0:.1f} {y0:.1f} A{r} {r} 0 0 1 {x1:.1f} {y1:.1f}"


arcs = [arc(-90 + 30, 30 - 28), arc(30 + 28, 150 - 28), arc(150 + 28, 270 - 30)]


def arrowhead(a):
    x, y = CX + R * math.cos(math.radians(a)), CY + R * math.sin(math.radians(a))
    t = a + 90  # tangent direction (clockwise)
    return f'<path class="ah" d="M-14 -11 L4 0 L-14 11" transform="translate({x:.1f} {y:.1f}) rotate({t:.1f})" fill="none" stroke="{INDIGO}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'


heads = [arrowhead(30 - 28), arrowhead(150 - 28), arrowhead(270 - 30)]
kb_dots = ""
for i in range(46):
    rr = 9.5 * math.sqrt(i + 1)
    a = i * 137.508
    x = rr * math.cos(math.radians(a))
    y = rr * math.sin(math.radians(a))
    c = [HINOKI, INDIGO, SHU][i % 3] if i % 5 else INDIGO
    kb_dots += f'<circle class="kd" cx="{x:.1f}" cy="{y:.1f}" r="{4 + (i % 3)}" fill="{c}"/>'

frame("07-compound", 7.0, """
$R .title{left:0;width:1920px;top:84px;text-align:center;font-size:64px;}
$R .diagram{position:absolute;left:0;top:0;width:1920px;height:1080px;}
$R .node{position:absolute;width:250px;height:76px;border-radius:999px;background:#fff;border:2px solid #223a5e;display:flex;align-items:center;gap:14px;padding-left:12px;font-size:28px;font-weight:700;color:#223a5e;box-shadow:0 12px 30px rgba(34,58,94,.1);}
$R .node b{display:flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:50%;background:#223a5e;color:#fff;font-size:24px;}
$R .nsub{position:absolute;width:320px;text-align:center;font-size:24px;font-weight:500;color:#66686e;}
$R .ns0{top:0;}
$R .kbl{position:absolute;left:760px;width:400px;top:648px;text-align:center;font-size:22px;font-weight:700;letter-spacing:4px;color:#223a5e;}
$R .bottom{left:0;width:1920px;top:812px;text-align:center;font-size:52px;font-weight:600;color:#223a5e;}
""", f"""
<h1 class="h1 title">{words("Every expert. Every decision.")}</h1>
<svg class="diagram" viewBox="0 0 1920 1080">
  <g fill="none" stroke="{INDIGO}" stroke-width="4" stroke-linecap="round">{"".join(f'<path class="arc" d="{d}"/>' for d in arcs)}</g>
  {"".join(heads)}
  <g class="kb" transform="translate({CX} {CY})"><circle class="kbc" r="118" fill="{PAPER}" stroke="{INDIGO}" stroke-width="3"/>{kb_dots}</g>
</svg>
{node_html}
<div class="kbl">KNOWLEDGE BASE</div>
<h2 class="h1 bottom">{words("One knowledge base that keeps growing.")}</h2>
""", f"""
tl.fromTo(qa('.title .w'),{{opacity:0,y:30}},{{opacity:1,y:0,duration:.5,stagger:.08,ease:"power3.out"}},.1);
tl.fromTo(q('.kbc'),{{opacity:0,scale:.4,svgOrigin:"0 0"}},{{opacity:1,scale:.8,svgOrigin:"0 0",duration:.6,ease:"back.out(1.6)"}},.3);
tl.fromTo(q('.kbl'),{{opacity:0}},{{opacity:1,duration:.4}},.6);
const nodes=[q('.nd0'),q('.nd1'),q('.nd2')], subs=[q('.ns0'),q('.ns1'),q('.ns2')], arcs=qa('.arc'), heads=qa('.ah');
nodes.forEach((n,i)=>{{
  const t=.5+i*.75;
  tl.fromTo(n,{{opacity:0,scale:.6}},{{opacity:1,scale:1,duration:.45,ease:"back.out(2)"}},t);
  tl.fromTo(subs[i],{{opacity:0}},{{opacity:1,duration:.4}},t+.2);
  const L=arcs[i].getTotalLength();
  tl.fromTo(arcs[i],{{strokeDasharray:L,strokeDashoffset:L}},{{strokeDashoffset:0,duration:.6,ease:"power1.inOut"}},t+.35);
  tl.fromTo(heads[i],{{opacity:0}},{{opacity:1,duration:.15}},t+.9);
}});
const kd=qa('.kd');
tl.fromTo(kd,{{opacity:0,scale:0,transformOrigin:"50% 50%"}},{{opacity:1,scale:1,duration:.3,stagger:.085,ease:"back.out(2)"}},2.5);
tl.fromTo(q('.kbc'),{{scale:.8,svgOrigin:"0 0"}},{{scale:1.05,svgOrigin:"0 0",duration:4,ease:"power1.inOut",immediateRender:false}},2.5);
tl.fromTo(q('.kbl'),{{y:0}},{{y:14,duration:4,ease:"power1.inOut"}},2.5);
tl.fromTo(qa('.bottom .w'),{{opacity:0,y:24}},{{opacity:1,y:0,duration:.5,stagger:.08,ease:"power3.out"}},4.6);
""")

# ─────────────────────────── 08 purpose ───────────────────────────
SX, SY = 560, 600
kb8 = kb_dots.replace('class="kd"', 'class="kd8"')
people = "".join(f'<g transform="translate({x} {y}) scale({s})">{PERSON}</g>' for x, y, s in [(-40, 14, .34), (40, 14, .34), (0, 6, .42)])
frame("08-purpose", 6.5, """
$R .title{left:0;width:1920px;top:120px;text-align:center;font-size:84px;}
$R .dg{position:absolute;left:0;top:0;width:1920px;height:1080px;}
$R .tg{position:absolute;font-size:44px;font-weight:700;}
$R .tg small{display:block;font-size:28px;font-weight:500;color:#66686e;letter-spacing:1px;}
$R .kbl8{position:absolute;left:360px;width:400px;top:770px;text-align:center;font-size:22px;font-weight:700;letter-spacing:4px;color:#223a5e;}
""", f"""
<h1 class="h1 title">{words("Precious knowledge — never lost.")}</h1>
<svg class="dg" viewBox="0 0 1920 1080">
  <path class="ln8 l1" d="M{SX + 140} {SY - 40} C 900 520, 1000 470, 1180 470" fill="none" stroke="{INDIGO}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>
  <path class="ln8 l2" d="M{SX + 140} {SY + 40} C 900 690, 1000 740, 1180 740" fill="none" stroke="{INDIGO}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>
  <g transform="translate({SX} {SY})"><circle class="kbc8" r="124" fill="{PAPER}" stroke="{INDIGO}" stroke-width="3"/>{kb8}</g>
  <g class="ppl" transform="translate(1270 480)"><circle r="78" fill="#fff" stroke="{LINE}" stroke-width="2"/>{people}</g>
  <g class="agent" transform="translate(1270 740)"><circle r="78" fill="#fff" stroke="{LINE}" stroke-width="2"/>
    <line x1="0" y1="-52" x2="0" y2="-36" stroke="{INDIGO}" stroke-width="5" stroke-linecap="round"/><circle cx="0" cy="-56" r="7" fill="{SHU}"/>
    <rect x="-44" y="-36" width="88" height="70" rx="20" fill="{INDIGO}"/><circle cx="-17" cy="-2" r="9" fill="#fff"/><circle cx="17" cy="-2" r="9" fill="#fff"/>
    <rect x="-16" y="16" width="32" height="5" rx="2.5" fill="#fff"/></g>
</svg>
<div class="kbl8">EVERYTHING SENSEI LEARNED</div>
<div class="tg t-p" style="left:1380px;top:430px">New colleagues<small>TODAY</small></div>
<div class="tg t-a" style="left:1380px;top:690px">AI agents<small>TOMORROW</small></div>
""", """
tl.fromTo(qa('.title .w'),{opacity:0,y:34},{opacity:1,y:0,duration:.55,stagger:.09,ease:"power3.out"},.1);
tl.fromTo(q('.kbc8'),{opacity:0,scale:.6,svgOrigin:"0 0"},{opacity:1,scale:1,svgOrigin:"0 0",duration:.6,ease:"back.out(1.6)"},.5);
tl.fromTo(qa('.kd8'),{opacity:0},{opacity:1,duration:.25,stagger:.015},.7);
tl.fromTo(q('.kbl8'),{opacity:0},{opacity:1,duration:.4},1.2);
tl.fromTo(q('.l1'),{opacity:0,strokeDashoffset:0},{opacity:1,strokeDashoffset:-28,duration:.5},2.2);
tl.fromTo(q('.l1'),{strokeDashoffset:-28},{strokeDashoffset:-140,duration:4,ease:"none",immediateRender:false},2.7);
tl.fromTo(q('.ppl'),{opacity:0,scale:.6,svgOrigin:"0 0"},{opacity:1,scale:1,svgOrigin:"0 0",duration:.5,ease:"back.out(2)"},2.5);
tl.fromTo(q('.t-p'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:"power2.out"},2.7);
tl.fromTo(q('.l2'),{opacity:0,strokeDashoffset:0},{opacity:1,strokeDashoffset:-28,duration:.5},3.7);
tl.fromTo(q('.l2'),{strokeDashoffset:-28},{strokeDashoffset:-110,duration:2.6,ease:"none",immediateRender:false},4.2);
tl.fromTo(q('.agent'),{opacity:0,scale:.6,svgOrigin:"0 0"},{opacity:1,scale:1,svgOrigin:"0 0",duration:.5,ease:"back.out(2)"},4.0);
tl.fromTo(q('.t-a'),{opacity:0,x:-20},{opacity:1,x:0,duration:.5,ease:"power2.out"},4.2);
""")

# ─────────────────────────── 09 close ───────────────────────────
frame("09-close", 4.5, """
$R .mark{position:absolute;left:0;width:1920px;top:400px;text-align:center;font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:190px;line-height:1.1;letter-spacing:-3px;}
$R .mark span{display:inline-block;}
$R .seal{display:inline-flex;align-items:center;justify-content:center;width:124px;height:124px;margin-left:34px;vertical-align:middle;border-radius:14px;background:#b6402f;color:#fff;font-size:44px;letter-spacing:0;writing-mode:vertical-rl;line-height:1;transform:translateY(-14px);}
$R .slogan{position:absolute;left:0;width:1920px;top:650px;text-align:center;font-size:54px;font-weight:500;color:#223a5e;}
""", f"""
{orb(960, 300, 110, 2, "o9")}
<div class="mark"><span class="wm">{"".join(f'<span class="ch">{c}</span>' for c in "Sensei")}</span><span class="seal-wrap" style="display:inline-block"><span class="seal">先生</span></span></div>
<div class="slogan">{words("Teach the next generation.")}</div>
""", """
tl.fromTo(q('.o9'),{opacity:0,scale:.4},{opacity:1,scale:1,duration:.6,ease:"back.out(2)"},.1);
tl.fromTo(qa('.o9 .ring'),{opacity:.8,scale:1},{opacity:0,scale:2,duration:1.2,stagger:.4,repeat:2,ease:"power1.out"},.5);
qa('.ch').forEach((c,i)=>tl.fromTo(c,{opacity:0,y:40,x:(i-2.5)*22},{opacity:1,y:0,x:0,duration:.9,ease:"power3.out"},.35+i*.04));
tl.fromTo(q('.seal-wrap'),{opacity:0,scale:1.8,rotation:-20},{opacity:1,scale:1,rotation:-6,duration:.4,ease:"back.out(2.2)"},1.1);
tl.fromTo(qa('.slogan .w'),{opacity:0,y:24},{opacity:1,y:0,duration:.5,stagger:.12,ease:"power3.out"},1.6);
""")


for fid, dur, css, markup, js in FRAMES:
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
        const tl = gsap.timeline({{ paused: true }});
{js}
        window.__timelines["{fid}"] = tl;
      }})();
    </script>
  </div>
</template>
"""
    with open(os.path.join(OUT, f"{fid}.html"), "w") as f:
        f.write(html)
    print("wrote", fid, dur)
print("total", sum(d for _, d, *_ in FRAMES))
