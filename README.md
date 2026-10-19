# Two browsers, one screen

Follow someone as if you were sitting next to them, without sharing your screen. No picture goes over the line, only what happens.

This is the code behind the article [Twee browsers, één scherm](https://www.hexz.net/meekijken/?utm_source=github&utm_medium=readme&utm_campaign=meekijken) on hexz.net (in Dutch). There you can try it: what you do on the left appears on the right.

## The question

Can you follow someone at a distance as if you were sitting next to them, without sharing your whole screen? And how little does that take?

Screen sharing is all or nothing. The other person sees your whole screen, as video. That is heavy on the line, and it is more than you usually want to show.

## What I did

I do not send a picture. I send what happens:

- **place:** which page you are on;
- **scrolling:** how far down you are;
- **pointer:** where your mouse or finger is;
- **attention:** which field you clicked;
- **text:** what you type in it.

The other person has the same page in front of them. Their browser builds the picture itself from those five things. In the example: you are on the left, the one who follows is on the right.

The first experiment was bigger. Several people worked in the same environment at the same time. Coloured dots in the menu showed who was where. One click on *follow*, and your screen moved along with the other one: the same page, the same place, the field that lights up, the text that appears. And you could break in at any moment with video, sound or a message.

In that experiment the following went through a server. The direct connection between two browsers, WebRTC, was only used for video, sound and chat. Here it is the other way round: this page has no server, so everything goes over the direct line.

## What surprised me

### How little goes over the line

Look at the counters under the two panes. Every movement of the pointer is one message of at most 31 bytes. Going to another tab: 22 bytes.

Typing costs the most. With every key the whole content of the field goes along. A sentence of 45 characters is 45 messages, together a little over 2.5 kB. That is still less than one small photo.

Video sends every frame again, even when nothing changes. This only sends something when something happens. Do nothing, and nothing goes over the line.

### A dot is enough

Set sharing to **pointer** and move. On the right only a dot moves. Still you know at once: someone is there, and they are looking at that part.

Set it to **place**. Now you only see which tab the other person is on. Even that is presence. In the first experiment, those were the dots in the menu.

### Sharing has a limit

Set it to **text** and type a sentence. Delete a word and type another. The one who follows sees all of it: also what you delete, also your doubt.

> You see the other person think.

That is exactly what you want when you are helping someone. And exactly what you do not want when you are just working. That is why there is a limit: you choose how much you share.

One step back, to **attention**, and the one who follows still sees where you are busy, but no longer what you write.

### Even two windows have to be introduced

Two browsers can talk to each other directly. But first they have to find each other. They exchange an offer and an answer, and the addresses where they can be reached. That introduction always goes through something else.

Between two computers that is a server. Here the two sides are in the same page, and simply hand it to each other. Press **open een tweede venster** (open a second window): then two windows of your browser do the same, through a channel the browser itself offers.

After the introduction, the go-between is no longer needed.

## How it works

What you do becomes a small message. This is scrolling ([demo/follow.js](demo/follow.js)):

```js
leadPane.scroller.addEventListener("scroll", () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    if (state.level >= 2) send({ t: "scroll", y: scrollPos() });
  });
}, { passive: true });
```

At most one message per frame, and only when you share scrolling. The number is a part of the page, from 0 to 1. That way it is also right when the other window has a different size.

And this is the introduction between the two sides in this page:

```js
const a = new RTCPeerConnection();
const b = new RTCPeerConnection();
a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate);
b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate);

const channel = a.createDataChannel("follow");
await a.setLocalDescription(await a.createOffer());
await b.setRemoteDescription(a.localDescription);
await b.setLocalDescription(await b.createAnswer());
await a.setRemoteDescription(b.localDescription);
```

An offer, an answer, and the addresses back and forth. After that, `channel` is a direct line you send text over.

## What is here

| File | What it is |
|---|---|
| [`index.html`](index.html) | The example on a page of its own |
| [`demo/follow.js`](demo/follow.js) | The two panes, the five levels of sharing, the counters, and the WebRTC connection |
| [`demo/follow.css`](demo/follow.css) | Its look |

The labels in the example are in Dutch, as on the site.

## Run it

No build step and no server code. Any static web server will do, for example:

```
python -m http.server 8000
```

Then open `http://localhost:8000/`. The second window needs a browser with `BroadcastChannel` and WebRTC; it works between two windows of the same browser, not between two computers.

## Made with the help of AI

The code, the example and this text were made with an AI assistant. The idea, the questions and the choices are mine.

## Licence

[MIT](LICENSE), copyright Hugo Scheepens.
