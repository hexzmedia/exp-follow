// Meekijken demo: two panes with the same small page. What happens in the left pane
// is sent as events over a WebRTC data channel; the right pane rebuilds it.
// No picture is sent. No server: the two ends live in the same page, or in two
// windows of the same browser that find each other through a BroadcastChannel.

const root = document.getElementById("follow-demo");

// The small page that both sides show. Sample content, nothing is stored or sent anywhere.
const PAGE = [
  {
    id: "who",
    tab: "Voor wie",
    title: "Voor wie is de kaart?",
    blocks: [
      { p: "Je stuurt iemand een kaart. Begin bij de ontvanger." },
      { field: "name", label: "Naam", type: "text", placeholder: "bijvoorbeeld: oma" },
      { field: "occasion", label: "Aanleiding", type: "select", options: ["Zomaar", "Verjaardag", "Bedankt", "Beterschap"] },
      { p: "Een kaart zonder aanleiding is vaak de leukste. Niemand verwacht hem." },
      { p: "Scrol gerust verder. De meekijker scrolt mee, als je dat deelt." },
      { field: "place", label: "Waar ken je elkaar van?", type: "text", placeholder: "bijvoorbeeld: van vroeger" },
    ],
  },
  {
    id: "card",
    tab: "De kaart",
    title: "Hoe ziet de kaart eruit?",
    blocks: [
      { field: "colour", label: "Kleur", type: "choice", options: [["purple", "Paars"], ["green", "Groen"], ["cyan", "Cyaan"], ["orange", "Oranje"]] },
      { p: "Vier kleuren, alle vier even belangrijk. Kies er één." },
      { field: "pattern", label: "Patroon", type: "choice", options: [["lines", "Lijnen"], ["dots", "Stippen"], ["grid", "Raster"]] },
      { p: "Het patroon komt op de voorkant. De achterkant blijft leeg, voor je tekst." },
    ],
  },
  {
    id: "text",
    tab: "De tekst",
    title: "Wat schrijf je?",
    blocks: [
      { field: "message", label: "Je bericht", type: "textarea", placeholder: "Typ hier. Rechts verschijnt het letter voor letter." },
      { p: "Kies hierboven ‘aandacht’, en de meekijker ziet nog wel waar je typt, maar niet meer wat." },
      { field: "from", label: "Afzender", type: "text", placeholder: "je naam" },
      { p: "Klaar? Dit voorbeeld verstuurt niets. Het gaat om het meekijken." },
    ],
  },
];

// What is shared at each level. A higher level includes the lower ones.
const LEVELS = [
  { name: "plek", sees: "ziet waar je bent" },
  { name: "scrollen", sees: "ziet waar je bent en hoe ver je scrolt" },
  { name: "aanwijzer", sees: "ziet ook je aanwijzer" },
  { name: "aandacht", sees: "ziet ook welk veld je aandacht heeft" },
  { name: "tekst", sees: "ziet alles, ook wat je typt" },
];

const params = new URLSearchParams(location.search);
const viewRoom = params.get("view"); // set in the second window: this page only watches
const stat = (name) => root.querySelector(`[data-stat="${name}"]`);
const round = (n) => Math.round(n * 1000) / 1000;

// Measuring: what the visitor does with the demo (see content/goals.yaml).
function use(action, detail) {
  if (window.hexzTrack) window.hexzTrack("demo_use", { article: "meekijken", action: action, detail: detail || "" });
}

// ---- One pane: the same page on both sides ----
function buildPane(pane, role) {
  const page = pane.querySelector(".follow-page");
  const tabs = document.createElement("div");
  tabs.className = "follow-tabs";
  const scroller = document.createElement("div");
  scroller.className = "follow-scroll";
  const content = document.createElement("div");
  content.className = "follow-content";
  const dot = document.createElement("span");
  dot.className = "follow-dot";
  dot.hidden = true;
  const fields = new Map(); // field name -> { wrap, type, inputs }

  PAGE.forEach((section) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = section.tab;
    tab.dataset.section = section.id;
    tab.disabled = role === "view";
    tabs.appendChild(tab);

    const part = document.createElement("div");
    part.className = "follow-section";
    part.dataset.section = section.id;
    const h = document.createElement("h3");
    h.textContent = section.title;
    part.appendChild(h);

    section.blocks.forEach((b) => {
      if (b.p) {
        const p = document.createElement("p");
        p.textContent = b.p;
        return part.appendChild(p);
      }
      const wrap = document.createElement(b.type === "choice" ? "fieldset" : "label");
      wrap.className = "follow-field";
      wrap.dataset.field = b.field;
      const caption = document.createElement(b.type === "choice" ? "legend" : "span");
      caption.textContent = b.label;
      wrap.appendChild(caption);
      const inputs = [];
      if (b.type === "choice") {
        b.options.forEach(([value, text]) => {
          const option = document.createElement("label");
          option.className = "follow-option";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = role + "-" + b.field;
          input.value = value;
          const span = document.createElement("span");
          span.textContent = text;
          span.dataset.value = value;
          option.append(input, span);
          wrap.appendChild(option);
          inputs.push(input);
        });
      } else {
        const input = document.createElement(b.type === "text" ? "input" : b.type);
        if (b.type === "text") input.type = "text";
        if (b.type === "select") {
          b.options.forEach((text) => input.appendChild(new Option(text, text)));
        } else {
          input.placeholder = b.placeholder || "";
        }
        input.autocomplete = "off";
        wrap.appendChild(input);
        inputs.push(input);
      }
      inputs.forEach((input) => {
        input.dataset.field = b.field;
        input.disabled = role === "view";
      });
      fields.set(b.field, { wrap, type: b.type, inputs });
      part.appendChild(wrap);
    });
    content.appendChild(part);
  });
  content.appendChild(dot);
  scroller.appendChild(content);
  page.append(tabs, scroller);

  return {
    tabs, scroller, content, fields,
    setNav(id) {
      tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.section === id)));
      content.querySelectorAll(".follow-section").forEach((s) => (s.hidden = s.dataset.section !== id));
    },
    setScroll(y) {
      scroller.scrollTop = y * (scroller.scrollHeight - scroller.clientHeight);
    },
    setPointer(p) {
      dot.hidden = !p;
      if (!p) return;
      dot.style.left = p.x * 100 + "%";
      dot.style.top = p.y * 100 + "%";
    },
    setFocus(name) {
      fields.forEach((f, key) => f.wrap.classList.toggle("is-focus", key === name));
    },
    setValue(name, value) {
      const f = fields.get(name);
      if (!f) return;
      if (f.type === "choice") f.inputs.forEach((i) => (i.checked = i.value === value));
      else f.inputs[0].value = value || (f.type === "select" ? f.inputs[0].options[0].value : "");
    },
  };
}

// ---- The watching side: rebuilds the picture from the events ----
function makeViewer(pane) {
  const view = buildPane(pane, "view");
  view.setNav(PAGE[0].id);
  return function apply(m) {
    switch (m.t) {
      case "state": // a full picture: at the start, and when the level changes
        view.setNav(m.nav);
        view.setScroll(m.scroll || 0);
        view.setPointer(m.ptr || null);
        view.setFocus(m.focus || null);
        view.fields.forEach((f, name) => view.setValue(name, (m.values || {})[name] || ""));
        stat("sees").textContent = LEVELS[m.level - 1].sees;
        break;
      case "nav":
        view.setNav(m.s);
        view.setScroll(0);
        break;
      case "scroll":
        view.setScroll(m.y);
        break;
      case "ptr":
        view.setPointer(m.x === undefined ? null : m);
        break;
      case "focus":
        view.setFocus(m.f);
        break;
      case "input":
        view.setValue(m.f, m.v);
        break;
    }
  };
}

// ---- Counting what goes over the line ----
const encoder = new TextEncoder();
const count = { messages: 0, bytes: 0, recent: [] };
function counted(text) {
  const n = encoder.encode(text).length;
  count.messages++;
  count.bytes += n;
  count.recent.push([performance.now(), n]);
}
function formatBytes(n) {
  if (n < 1000) return n + " bytes";
  return (n / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 }) + " kB";
}
setInterval(() => {
  const now = performance.now();
  count.recent = count.recent.filter((r) => now - r[0] < 1000);
  stat("messages").textContent = count.messages.toLocaleString("nl-NL");
  stat("bytes").textContent = formatBytes(count.bytes);
  stat("rate").textContent = formatBytes(count.recent.reduce((sum, r) => sum + r[1], 0)) + " per seconde";
}, 250);

// ---- Two ends in one page, joined by a real WebRTC data channel ----
// Both ends live here, so they can hand each other the offer, the answer and the
// network candidates directly. Between two computers a server does that introduction.
async function loopback(onMessage) {
  const a = new RTCPeerConnection();
  const b = new RTCPeerConnection();
  a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate);
  b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate);
  b.ondatachannel = (e) => (e.channel.onmessage = (msg) => onMessage(msg.data));

  const channel = a.createDataChannel("follow");
  const open = new Promise((resolve, reject) => {
    channel.onopen = resolve;
    setTimeout(() => reject(new Error("timeout")), 4000);
  });
  await a.setLocalDescription(await a.createOffer());
  await b.setRemoteDescription(a.localDescription);
  await b.setLocalDescription(await b.createAnswer());
  await a.setRemoteDescription(b.localDescription);
  await open;
  return channel;
}

// ---- The second window: this page only watches ----
function watch() {
  root.classList.add("is-watching");
  root.querySelector(".follow-share").hidden = true;
  root.querySelector('[data-role="lead"]').hidden = true;
  root.querySelector(".follow-actions").hidden = true;
  const apply = makeViewer(root.querySelector('[data-role="view"]'));
  stat("link").textContent = "zoekt het eerste venster…";
  stat("note").textContent = "Dit venster kijkt mee. Zet het naast het eerste venster, en beweeg, scrol en typ daar.";

  const signal = new BroadcastChannel("hexz-follow-" + viewRoom);
  let pc = null;
  signal.onmessage = async (e) => {
    const m = e.data;
    if (m.type === "offer") {
      pc = new RTCPeerConnection();
      pc.onicecandidate = (c) => c.candidate && signal.postMessage({ type: "ice", from: "view", candidate: c.candidate.toJSON() });
      pc.ondatachannel = (d) => {
        stat("link").textContent = "rechtstreeks, tussen twee vensters";
        d.channel.onmessage = (msg) => {
          counted(msg.data);
          apply(JSON.parse(msg.data));
        };
        d.channel.onclose = () => (stat("link").textContent = "het eerste venster is weg");
      };
      await pc.setRemoteDescription(m.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      signal.postMessage({ type: "answer", sdp: pc.localDescription.toJSON() });
    } else if (m.type === "ice" && m.from === "lead" && pc) {
      pc.addIceCandidate(m.candidate).catch(() => {});
    }
  };
  signal.postMessage({ type: "hello" });
}

// ---- The first window: you, and the watcher next to you ----
async function lead() {
  const leadPane = buildPane(root.querySelector('[data-role="lead"]'), "lead");
  const apply = makeViewer(root.querySelector('[data-role="view"]'));

  const state = { level: 5, nav: PAGE[0].id, ptr: null, focus: null, values: {} };
  const links = []; // everything with a send(text): the pane next door, and a second window
  let touched = false;

  function send(m) {
    const text = JSON.stringify(m);
    if (!links.length) return;
    counted(text);
    links.forEach((link) => link.send(text));
  }
  function scrollPos() {
    const max = leadPane.scroller.scrollHeight - leadPane.scroller.clientHeight;
    return max > 0 ? round(leadPane.scroller.scrollTop / max) : 0;
  }
  // Everything the watcher may see at this level, in one message.
  function snapshot() {
    const m = { t: "state", level: state.level, nav: state.nav };
    if (state.level >= 2) m.scroll = scrollPos();
    if (state.level >= 3 && state.ptr) m.ptr = state.ptr;
    if (state.level >= 4 && state.focus) m.focus = state.focus;
    if (state.level >= 5) m.values = state.values;
    return m;
  }
  function interact() {
    if (touched) return;
    touched = true;
    stat("hint").hidden = true;
    use("interact");
  }

  // The level: five blocks, from "where I am" to "everything"
  const levels = root.querySelector(".follow-levels");
  LEVELS.forEach((l, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.level = i + 1;
    b.textContent = l.name;
    levels.appendChild(b);
  });
  function showLevel() {
    levels.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("is-on", Number(b.dataset.level) <= state.level);
      b.setAttribute("aria-pressed", String(Number(b.dataset.level) === state.level));
    });
  }
  levels.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.level = Number(b.dataset.level);
    showLevel();
    send(snapshot());
    use("level", String(state.level));
  });

  // What you do
  leadPane.setNav(state.nav);
  leadPane.tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.nav = b.dataset.section;
    leadPane.setNav(state.nav);
    leadPane.scroller.scrollTop = 0;
    interact();
    send({ t: "nav", s: state.nav });
  });

  let scrollFrame = 0;
  leadPane.scroller.addEventListener("scroll", () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (state.level >= 2) send({ t: "scroll", y: scrollPos() });
    });
  }, { passive: true });

  let pointerFrame = 0;
  leadPane.scroller.addEventListener("pointermove", (e) => {
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      const r = leadPane.content.getBoundingClientRect();
      state.ptr = { x: round((e.clientX - r.left) / r.width), y: round((e.clientY - r.top) / r.height) };
      if (state.level >= 3) send({ t: "ptr", x: state.ptr.x, y: state.ptr.y });
    });
  }, { passive: true });
  leadPane.scroller.addEventListener("pointerleave", () => {
    state.ptr = null;
    if (state.level >= 3) send({ t: "ptr" });
  });
  leadPane.scroller.addEventListener("pointerdown", interact);

  leadPane.content.addEventListener("focusin", (e) => {
    state.focus = e.target.dataset.field || null;
    if (state.level >= 4) send({ t: "focus", f: state.focus });
  });
  leadPane.content.addEventListener("focusout", () => {
    state.focus = null;
    if (state.level >= 4) send({ t: "focus", f: null });
  });
  leadPane.content.addEventListener("input", (e) => {
    const name = e.target.dataset.field;
    if (!name) return;
    state.values[name] = e.target.value;
    interact();
    if (state.level >= 5) send({ t: "input", f: name, v: e.target.value });
  });

  // The pane next door: a real data channel if the browser allows it
  showLevel();
  try {
    const channel = await loopback((text) => apply(JSON.parse(text)));
    links.push(channel);
    stat("link").textContent = "rechtstreeks, via WebRTC";
    stat("note").textContent = "De twee vlakken praten via een echte WebRTC-verbinding, binnen deze pagina. Er gaat niets naar een server.";
  } catch (err) {
    links.push({ send: (text) => queueMicrotask(() => apply(JSON.parse(text))) });
    stat("link").textContent = "zonder WebRTC";
    stat("note").textContent = "Deze browser staat hier geen WebRTC-verbinding toe. De berichten zijn dezelfde, maar gaan nu rechtstreeks van het ene vlak naar het andere.";
  }
  send(snapshot());

  // A second window of the same browser: the introduction goes through a BroadcastChannel
  const room = Math.random().toString(36).slice(2, 10);
  const windowButton = root.querySelector('[data-action="window"]');
  if (!("BroadcastChannel" in window) || !("RTCPeerConnection" in window)) {
    windowButton.hidden = true;
    return;
  }
  const signal = new BroadcastChannel("hexz-follow-" + room);
  let remote = null; // { pc, channel }
  signal.onmessage = async (e) => {
    const m = e.data;
    if (m.type === "hello") {
      if (remote) remote.pc.close();
      const pc = new RTCPeerConnection();
      const channel = pc.createDataChannel("follow");
      remote = { pc, channel };
      pc.onicecandidate = (c) => c.candidate && signal.postMessage({ type: "ice", from: "lead", candidate: c.candidate.toJSON() });
      channel.onopen = () => {
        links.push(channel);
        windowButton.textContent = "het tweede venster kijkt mee";
        send(snapshot());
      };
      channel.onclose = () => {
        const i = links.indexOf(channel);
        if (i >= 0) links.splice(i, 1);
        windowButton.textContent = "open een tweede venster";
      };
      await pc.setLocalDescription(await pc.createOffer());
      signal.postMessage({ type: "offer", sdp: pc.localDescription.toJSON() });
    } else if (m.type === "answer" && remote) {
      await remote.pc.setRemoteDescription(m.sdp);
    } else if (m.type === "ice" && m.from === "view" && remote) {
      remote.pc.addIceCandidate(m.candidate).catch(() => {});
    }
  };
  windowButton.addEventListener("click", () => {
    window.open(location.pathname + "?view=" + room, "hexz-follow", "width=560,height=720");
    use("window");
  });
}

if (root) {
  if (viewRoom) watch();
  else lead();
}
