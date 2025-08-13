# Ad Variation Creator

A modern, drag‑and‑drop web app to compose **ad variations** from reusable sections (Hook Lines, Intros, Bodies, Transitions, CTAs, or anything you add). Explore every combination, edit any single variation in‑browser, exclude sections per‑ad, then export as individual `.txt` files or a combined `.zip`.

---

## ✨ Features
- **Custom sections**: Add, rename, remove, enable/disable sections. Bulk‑paste lines.
- **Reorder with drag & drop**: Section order controls ad flow.
- **All combinations**: Efficient, index‑based generator (no heavy precompute).
- **Per‑ad editing**: Edit a single ad’s text; your change overrides the auto‑composed version.
- **Per‑ad exclusions**: Toggle which sections appear in the current ad.
- **Search & jump**: Find the next ad matching a term; jump directly to #N.
- **Quick flow diagram**: See the path through sections for the current ad.
- **Downloads**: ZIP of all ads, one combined `.txt`, or individual files.
- **Persistence**: Everything saves to your browser’s `localStorage`.

> **Note**: Very large combination counts can be heavy. A configurable safety cap is built in for ZIP generation.

---

## 🧩 Tech Stack
- **React** (Create React App)
- **Tailwind CSS** (v3) for styling
- **@dnd-kit** for drag & drop
- **JSZip** for ZIP creation
- **file-saver** for downloads

---

## 🚀 Quick Start (Development)

> Requires **Node.js v18+** and **npm**.

```bash
# 1) Install deps
npm install

# 2) Start the dev server
npm start
# App runs at http://localhost:3000
```

## ⚙️ Configuration & Tips
- **Default sections**: Defined in `src/App.js` (`DEFAULT_SECTIONS`). Modify to set your own starter content.
- **Headings**: Toggle “Include section headings” in the Output panel.
- **Separators**: Customize the separator string between sections.
- **Safety cap**: Adjust “Safety cap for ZIP (files)” before exporting huge sets.
- **Persistence**: Data stored under `avb.*` keys in `localStorage`.
- **Editing behavior**: If you edit an ad’s text, that specific ad uses your override; toggling section inclusions clears conflicts so composition updates immediately.

## 🔐 Privacy
Everything runs in your browser. Content is stored locally via `localStorage` and never uploaded unless you deploy the site or share files.

---

## 📄 License
MIT — do whatever you like, with attribution appreciated.

---

## 🙌 Acknowledgements
Built with ❤️ to make ad creation fast, flexible, and fun.

