import React, { useEffect, useMemo, useState, useCallback } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, Download, FolderDown, FileText, Settings, CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";
import JSZip from "jszip";
// IMPORTANT: default import for file-saver for CDN + ESM compatibility
import saveAs from "file-saver";

/**
 * @typedef {{ id: string, text: string }} SectionItem
 * @typedef {{ id: string, name: string, items: SectionItem[], enabled: boolean }} Section
 * @typedef {{ name: string, pass: boolean, details?: string }} TestResult
 * @typedef {{ text?: string, excludedIds?: string[] }} AdOverride
 */

// ---------- Utilities ----------
const uid = () => Math.random().toString(36).slice(2, 10);

/** @type {Section[]} */
const DEFAULT_SECTIONS = [
  { id: uid(), name: "Hook Lines", enabled: true, items: [
    { id: uid(), text: "What do you do when the job you prayed for becomes the life you can’t stand?" },
  ]},
  { id: uid(), name: "Intros", enabled: true, items: [
    { id: uid(), text: "I stopped asking myself how I felt, because the answer never changed." },
  ]},
  { id: uid(), name: "Bodies", enabled: true, items: [
    { id: uid(), text: "I didn’t leave the medical field with a well-thought-out plan. I left it in pieces—and rebuilt a life that actually fits." },
  ]},
  { id: uid(), name: "Transitions", enabled: true, items: [
    { id: uid(), text: "Here’s what changed everything…" },
  ]},
  { id: uid(), name: "CTAs", enabled: true, items: [
    { id: uid(), text: "DM me ‘INFO’ to see how this works." },
  ]},
];

/** @param {Section[]} sections */
function productCount(sections) {
  const active = sections.filter(s => s.enabled);
  if (active.length === 0) return 0;
  return active.reduce((acc, s) => acc * Math.max(1, s.items.length), 1);
}

/** @param {SectionItem[][]} lists */
function *cartesianGenerator(lists) {
  if (lists.length === 0) { yield []; return; }
  const [first, ...rest] = lists;
  for (const f of first) {
    if (rest.length === 0) {
      yield [f];
    } else {
      for (const combo of cartesianGenerator(rest)) {
        yield [f, ...combo];
      }
    }
  }
}

function normalizeFileName(text, max = 40) {
  const clean = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^a-z0-9 \-_.]/gi, " "); // turn invalid chars into spaces so they become hyphens later
  return (clean.slice(0, max) || "ad").replace(/\s+/g, "-").toLowerCase();
}

function downloadBlob(blob, filename) {
  // Robust: prefer file-saver if present; fallback to anchor method
  try {
    if (typeof saveAs === "function") {
      saveAs(blob, filename);
      return;
    }
  } catch (_) {}
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Get the nth combination without generating all previous ones
function getCombinationAt(index, lists) {
  const sizes = lists.map(l => l.length);
  const total = sizes.reduce((a, b) => a * b, 1) || 0;
  if (index < 0 || index >= total) return null;
  const choiceIdx = [];
  for (let i = sizes.length - 1; i >= 0; i--) {
    const size = sizes[i];
    const pos = index % size;
    choiceIdx[i] = pos;
    index = Math.floor(index / size);
  }
  return choiceIdx.map((pos, i) => lists[i][pos]);
}

// ---------- Sortable Components ----------
function SortableSection({ section, onChange, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white/80 backdrop-blur border rounded-2xl shadow-sm p-4 mb-4">
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-md hover:bg-gray-100 cursor-grab" {...attributes} {...listeners} aria-label="Drag section">
          <GripVertical className="w-5 h-5" />
        </button>
        <input
          className="flex-1 bg-transparent outline-none font-semibold text-lg"
          value={section.name}
          onChange={(e) => onChange({ ...section, name: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm mr-2">
          <input type="checkbox" checked={section.enabled} onChange={(e) => onChange({ ...section, enabled: e.target.checked })} />
          Use
        </label>
        <button className="p-2 rounded-lg hover:bg-red-50 text-red-600" onClick={onDelete} aria-label="Delete section">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <ItemsEditor section={section} onChange={onChange} />
    </div>
  );
}

function ItemsEditor({ section, onChange }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const updateItem = (id, text) => {
    onChange({ ...section, items: section.items.map(it => it.id === id ? { ...it, text } : it) });
  };

  const addItem = (text = "") => {
    onChange({ ...section, items: [...section.items, { id: uid(), text }] });
  };

  const bulkAdd = (blob) => {
    const lines = blob.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length) {
      onChange({ ...section, items: [...section.items, ...lines.map(text => ({ id: uid(), text }))] });
    }
  };

  const onDragEnd = (e) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = section.items.findIndex(i => i.id === active.id);
    const newIndex = section.items.findIndex(i => i.id === over.id);
    onChange({ ...section, items: arrayMove(section.items, oldIndex, newIndex) });
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => addItem("")} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black text-white shadow-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> Add line
        </button>
        <details className="ml-2">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">Bulk paste</summary>
          <div className="mt-2">
            <textarea
              className="w-full border rounded-xl p-3 text-sm"
              placeholder="Paste one option per line"
              rows={4}
              onBlur={(e) => bulkAdd(e.target.value)}
            />
            <div className="text-xs text-gray-500 mt-1">Tip: paste, click outside to add.</div>
          </div>
        </details>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={section.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {section.items.map((it) => (
              <SortableLine
                key={it.id}
                item={it}
                onChangeText={(txt) => updateItem(it.id, txt)}
                onDelete={() => onChange({ ...section, items: section.items.filter(x => x.id !== it.id) })}
                sectionName={section.name}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableLine({ item, onChangeText, onDelete, sectionName }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group flex items-start gap-2 bg-gray-50 rounded-xl p-3 border">
      <button className="mt-0.5 p-1 rounded-md hover:bg-gray-100 cursor-grab" {...attributes} {...listeners} aria-label="Drag line">
        <GripVertical className="w-4 h-4" />
      </button>
      <textarea
        className="flex-1 bg-transparent outline-none resize-vertical min-h-[48px]"
        value={item.text}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder={`Write a ${sectionName.toLowerCase()} option...`}
      />
      <button className="opacity-100 transition p-2 rounded-md hover:bg-red-50 text-red-600" onClick={onDelete} aria-label="Delete line">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---------- Main App ----------
export default function AdVariationsBuilder() {
  const sensorsMain = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  /** @type {[Section[], Function]} */
  const [sections, setSections] = useState(() => {
    try {
      const raw = localStorage.getItem("avb.sections");
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_SECTIONS;
  });

  const [includeHeadings, setIncludeHeadings] = useState(() => localStorage.getItem("avb.headings") === "1");
  const [separator, setSeparator] = useState(() => localStorage.getItem("avb.sep") ?? "\n\n");
  const [maxForPreview, setMaxForPreview] = useState(20);
  const [maxForZip, setMaxForZip] = useState(3000);

  /** @type {[Record<string, AdOverride>, Function]} */
  const [overrides, setOverrides] = useState(() => {
    try {
      const raw = localStorage.getItem("avb.overrides");
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  // Explorer state
  const [currentIndex, setCurrentIndex] = useState(0); // zero-based
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    localStorage.setItem("avb.sections", JSON.stringify(sections));
  }, [sections]);
  useEffect(() => { localStorage.setItem("avb.headings", includeHeadings ? "1" : "0"); }, [includeHeadings]);
  useEffect(() => { localStorage.setItem("avb.sep", separator); }, [separator]);
  useEffect(() => { localStorage.setItem("avb.overrides", JSON.stringify(overrides)); }, [overrides]);

  const activeSections = useMemo(() => sections.filter(s => s.enabled && s.items.length > 0), [sections]);
  const lists = useMemo(() => activeSections.map(s => s.items), [activeSections]);
  const totalCombos = useMemo(() => productCount(sections), [sections]);

  // keep currentIndex in bounds
  useEffect(() => {
    if (currentIndex >= Math.max(totalCombos - 1, 0)) {
      setCurrentIndex(0);
    }
  }, [totalCombos]);

  // when sections change (reorder/add/remove/toggle), clear overrides so editor reflects new composition
  useEffect(() => { setOverrides({}); setCurrentIndex(0); }, [sections]);

  const addSection = () => {
    setSections(prev => [...prev, { id: uid(), name: "New Section", items: [], enabled: true }]);
  };

  const resetDefaults = () => {
    setSections(DEFAULT_SECTIONS.map(s => ({ ...s, id: uid(), items: s.items.map(i => ({ ...i, id: uid() })) })));
    setOverrides({});
    setCurrentIndex(0);
  };

  // pure function so we can test easily
  const buildTextFromParts = (parts, withHeadings, sep) => {
    const chunks = parts.map(p => withHeadings ? `${p.name}\n${p.text}` : p.text);
    return chunks.join(sep || "\n\n").trim() + "\n";
  };

  const buildText = useCallback((parts) => buildTextFromParts(parts, includeHeadings, separator), [includeHeadings, separator]);

  const effectiveOverride = (idx) => overrides[idx] || { excludedIds: [] };

  const buildAdByIndex = useCallback((idx) => {
    const combo = getCombinationAt(idx, lists);
    if (!combo) return "";
    const ov = effectiveOverride(idx);
    if (ov && typeof ov.text === "string") return ov.text; // full override
    const filteredParts = combo.map((it, i) => ({ name: activeSections[i].name, text: it.text, secId: activeSections[i].id }))
      .filter(p => !(ov.excludedIds || []).includes(p.secId))
      .map(({ name, text }) => ({ name, text }));
    return buildText(filteredParts);
  }, [lists, activeSections, overrides, buildText]);

  const generatePreview = () => {
    const out = [];
    const max = Math.min(maxForPreview, totalCombos);
    for (let i = 0; i < max; i++) {
      out.push(buildAdByIndex(i));
    }
    return out;
  };

  const toggleExcludeSectionForCurrent = (secId) => {
    setOverrides(prev => {
      const ov = { ...(prev[currentIndex] || { excludedIds: [] }) };
      ov.excludedIds = Array.from(new Set(ov.excludedIds || []));
      if (ov.excludedIds.includes(secId)) {
        ov.excludedIds = ov.excludedIds.filter(id => id !== secId);
      } else {
        ov.excludedIds.push(secId);
      }
      // when exclusions change, drop any full-text override so the composed text updates
      if (ov.text) delete ov.text;
      return { ...prev, [currentIndex]: ov };
    });
  };

  const setOverrideTextForCurrent = (text) => {
    setOverrides(prev => ({ ...prev, [currentIndex]: { ...(prev[currentIndex] || {}), text } }));
  };

  const nextIndex = () => setCurrentIndex(i => Math.min(i + 1, Math.max(totalCombos - 1, 0)));
  const prevIndex = () => setCurrentIndex(i => Math.max(i - 1, 0));

  const findNext = () => {
    if (!searchTerm) return;
    const term = searchTerm.toLowerCase();
    for (let step = 1; step <= totalCombos; step++) {
      const idx = (currentIndex + step) % Math.max(totalCombos, 1);
      const text = buildAdByIndex(idx).toLowerCase();
      if (text.includes(term)) { setCurrentIndex(idx); return; }
    }
    window.alert("No matches found");
  };

  const downloadZip = async () => {
    const count = totalCombos;
    if (count === 0) return;
    if (count > maxForZip) {
      const ok = window.confirm(`You are about to generate ${count.toLocaleString()} files. This may be slow or crash your browser. Continue?`);
      if (!ok) return;
    }
    const zip = new JSZip();
    const pad = String(count).length;
    let index = 0;
    for (let adIdx = 0; adIdx < totalCombos; adIdx++) {
      const content = buildAdByIndex(adIdx);
      const first = content.split(/\n|\r/).find(Boolean) || "ad";
      const fname = `${String(++index).padStart(pad, "0")}_${normalizeFileName(first)}.txt`;
      zip.file(fname, content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `ad_variations_${new Date().toISOString().slice(0,10)}.zip`);
  };

  const downloadCombined = () => {
    const count = totalCombos;
    if (count === 0) return;
    const pieces = [];
    let i = 1;
    for (let adIdx = 0; adIdx < totalCombos; adIdx++) {
      const body = buildAdByIndex(adIdx);
      const edited = overrides[adIdx]?.text ? " [Edited]" : "";
      pieces.push(`### Ad ${i}${edited}\n\n${body}`);
      i++;
    }
    const blob = new Blob([pieces.join("\n\n---\n\n")], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `ad_variations_combined_${new Date().toISOString().slice(0,10)}.txt`);
  };

  const downloadIndividually = async () => {
    const count = totalCombos;
    if (count === 0) return;
    const go = window.confirm("This will trigger many download prompts (one per file). Continue?");
    if (!go) return;
    const pad = String(count).length;
    let i = 0;
    for (let adIdx = 0; adIdx < totalCombos; adIdx++) {
      const content = buildAdByIndex(adIdx);
      const first = content.split(/\n|\r/).find(Boolean) || "ad";
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const fname = `${String(++i).padStart(pad, "0")}_${normalizeFileName(first)}.txt`;
      downloadBlob(blob, fname);
      // allow UI to breathe
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 5));
    }
  };

  const preview = useMemo(() => generatePreview(), [sections, includeHeadings, separator, maxForPreview, overrides, currentIndex]);

  // ---------- Tiny Test Runner (dev) ----------
  const testResults = useMemo(() => {
    /** @type {TestResult[]} */
    const results = [];

    // productCount tests
    const s1 = { id: "a", name: "A", enabled: true, items: [{ id: "1", text: "x" }, { id: "2", text: "y" }] };
    const s2 = { id: "b", name: "B", enabled: true, items: [{ id: "3", text: "z" }] };
    const s3 = { id: "c", name: "C", enabled: false, items: [{ id: "4", text: "q" }] };
    const pc = productCount([s1, s2, s3]);
    results.push({ name: "productCount basic", pass: pc === 2 });

    // cartesianGenerator tests
    const listsTest = [[{ id: "1", text: "A" }, { id: "2", text: "B" }], [{ id: "3", text: "C" }]];
    const combos = Array.from(cartesianGenerator(listsTest)).map(c => c.map(x => x.id).join("-"));
    results.push({ name: "cartesian order", pass: combos.length === 2 && combos[0] === "1-3" && combos[1] === "2-3" });

    // normalizeFileName tests
    results.push({ name: "normalize trims & cleans", pass: normalizeFileName("  Hello*/World  ") === "hello-world" });

    // buildTextFromParts tests (with and without headings)
    const parts = [{ name: "Hook", text: "H1" }, { name: "Body", text: "B1" }];
    const t1 = buildTextFromParts(parts, false, "\n\n");
    const t2 = buildTextFromParts(parts, true, " -- ");
    results.push({ name: "buildText no headings", pass: t1 === "H1\n\nB1\n" });
    results.push({ name: "buildText with headings", pass: t2 === "Hook\nH1 -- Body\nB1\n" });

    // getCombinationAt test
    const got = getCombinationAt(1, [[{id:"a"},{id:"b"}], [{id:"c"}]]);
    results.push({ name: "getCombinationAt index 1", pass: Array.isArray(got) && got[0].id === "b" && got[1].id === "c" });

    return results;
  }, []);

  const allPass = testResults.every(t => t.pass);

  // Flow diagram for current ad
  const Flow = () => {
    const combo = getCombinationAt(currentIndex, lists) || [];
    const ov = effectiveOverride(currentIndex);
    const excluded = new Set(ov.excludedIds || []);
    const nodes = combo.map((it, i) => ({ id: activeSections[i].id, label: activeSections[i].name, text: it.text }));
    const visible = nodes.filter((n) => !excluded.has(n.id));
    const width = 760; const height = 140; const pad = 20;
    const step = visible.length ? (width - pad * 2) / visible.length : 1;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full border rounded-xl bg-white">
        {visible.map((n, i) => {
          const x = pad + i * step + step / 2; const y = height / 2;
          const nextX = pad + (i + 1) * step + step / 2;
          return (
            <g key={n.id}>
              <rect x={x - 100} y={y - 30} rx={12} ry={12} width={200} height={60} fill="#f8fafc" stroke="#e5e7eb" />
              <text x={x} y={y - 6} textAnchor="middle" fontSize="12" fill="#111827">{n.label}</text>
              <text x={x} y={y + 12} textAnchor="middle" fontSize="10" fill="#6b7280">{(n.text || "").slice(0, 22)}</text>
              {i < visible.length - 1 && (
                <line x1={x + 100} y1={y} x2={nextX - 100} y2={y} stroke="#9ca3af" strokeWidth={2} markerEnd="url(#arrow)" />
              )}
            </g>
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#9ca3af" />
          </marker>
        </defs>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-black text-white grid place-content-center text-sm font-bold">AV</div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Ad Variations Builder</h1>
              <p className="text-xs text-gray-600">Compose sections • Drag to reorder • Edit, search, and export every combination</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={resetDefaults} className="px-3 py-2 rounded-xl border hover:bg-gray-50 text-sm" title="Reset to defaults">
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-2 gap-6">
        {/* Left: Sections Builder */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Sections</h2>
            <button onClick={addSection} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black text-white shadow-sm hover:opacity-90">
              <Plus className="w-4 h-4" /> Add section
            </button>
          </div>

          <DndContext sensors={sensorsMain} collisionDetection={closestCenter} onDragEnd={(event) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            const oldIndex = sections.findIndex(s => s.id === active.id);
            const newIndex = sections.findIndex(s => s.id === over.id);
            setSections(arrayMove(sections, oldIndex, newIndex));
          }}>
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((s) => (
                <SortableSection
                  key={s.id}
                  section={s}
                  onChange={(next) => setSections(prev => prev.map(x => x.id === next.id ? next : x))}
                  onDelete={() => setSections(prev => prev.filter(x => x.id !== s.id))}
                />
              ))}
            </SortableContext>
          </DndContext>
        </section>

        {/* Right: Explorer, Output & Export */}
        <section className="lg:sticky lg:top-16 h-fit space-y-6">
          {/* Explorer */}
          <div className="bg-white/80 backdrop-blur border rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-semibold">Ad Explorer</h2>
              <div className="flex items-center gap-2">
                <button onClick={prevIndex} className="px-2 py-2 rounded-xl border hover:bg-gray-50" title="Previous"><ChevronLeft className="w-4 h-4"/></button>
                <div className="text-sm">{totalCombos === 0 ? 0 : currentIndex + 1} / {totalCombos}</div>
                <button onClick={nextIndex} className="px-2 py-2 rounded-xl border hover:bg-gray-50" title="Next"><ChevronRight className="w-4 h-4"/></button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="p-3 border rounded-xl flex items-center gap-2">
                <Search className="w-4 h-4"/>
                <input className="flex-1 outline-none" placeholder="Find text…" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') findNext(); }} />
                <button onClick={findNext} className="px-3 py-1 rounded-lg border hover:bg-gray-50 text-sm">Find next</button>
              </label>
              <label className="p-3 border rounded-xl flex items-center gap-2">
                <input type="number" min={1} max={Math.max(totalCombos,1)} className="w-24 border rounded-lg p-1" value={totalCombos===0?0:currentIndex+1} onChange={(e)=> setCurrentIndex(Math.min(Math.max(0, (Number(e.target.value)||1)-1), Math.max(totalCombos-1,0)))} />
                <span className="text-sm text-gray-600">Jump to #</span>
              </label>
            </div>

            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-1">Include/Exclude sections for this ad</div>
              <div className="flex flex-wrap gap-2">
                {activeSections.map(sec => {
                  const ov = effectiveOverride(currentIndex);
                  const excluded = (ov.excludedIds||[]).includes(sec.id);
                  return (
                    <button key={sec.id} onClick={() => toggleExcludeSectionForCurrent(sec.id)} className={`px-3 py-1 rounded-full border text-sm ${excluded? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                      {excluded? 'Excluded: ' : 'Include: '}{sec.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Edit this ad</div>
              <textarea
                className="w-full border rounded-xl p-3 text-sm min-h-[220px] whitespace-pre-wrap"
                value={buildAdByIndex(currentIndex)}
                onChange={(e)=> setOverrideTextForCurrent(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-1">Tip: typing here creates a saved override for this specific ad.</div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Flow</div>
              <Flow />
            </div>
          </div>

          {/* Output Settings & Export */}
          <div className="bg-white/80 backdrop-blur border rounded-2xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5" />
              <h2 className="font-semibold">Output</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-3 p-3 border rounded-xl">
                <span className="text-sm">Include section headings</span>
                <input type="checkbox" checked={includeHeadings} onChange={(e) => setIncludeHeadings(e.target.checked)} />
              </label>
              <label className="p-3 border rounded-xl">
                <div className="text-sm mb-1">Separator between sections</div>
                <input className="w-full border rounded-lg p-2" value={separator} onChange={(e) => setSeparator(e.target.value)} />
                <div className="text-xs text-gray-500 mt-1">Default is a blank line. You can use spaces, dashes, or any text.</div>
              </label>
              <label className="p-3 border rounded-xl">
                <div className="text-sm mb-1">Preview up to</div>
                <input type="number" min={1} className="w-full border rounded-lg p-2" value={maxForPreview} onChange={(e) => setMaxForPreview(Number(e.target.value || 1))} />
              </label>
              <label className="p-3 border rounded-xl">
                <div className="text-sm mb-1">Safety cap for ZIP (files)</div>
                <input type="number" min={100} className="w-full border rounded-lg p-2" value={maxForZip} onChange={(e) => setMaxForZip(Number(e.target.value || 100))} />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="px-2 py-1 rounded-lg bg-gray-100">Sections used: {activeSections.length}</span>
              <span className="px-2 py-1 rounded-lg bg-gray-100">Total variations: <strong>{totalCombos.toLocaleString()}</strong></span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={downloadZip} disabled={totalCombos === 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white hover:opacity-90 disabled:opacity-50">
                <FolderDown className="w-4 h-4" /> Download all as ZIP
              </button>
              <button onClick={downloadCombined} disabled={totalCombos === 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50">
                <FileText className="w-4 h-4" /> Download one combined .txt
              </button>
              <button onClick={downloadIndividually} disabled={totalCombos === 0} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border hover:bg-gray-50 disabled:opacity-50">
                <Download className="w-4 h-4" /> Download files individually
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white/80 backdrop-blur border rounded-2xl shadow-sm p-5">
            <h3 className="font-semibold mb-2">Preview</h3>
            {preview.length === 0 ? (
              <p className="text-sm text-gray-500">Add at least one option to each enabled section to see preview combinations.</p>
            ) : (
              <ul className="space-y-4">
                {preview.map((p, idx) => (
                  <li key={idx} className="border rounded-xl p-3 text-sm whitespace-pre-wrap">
                    <div className="text-xs text-gray-500 mb-2">Ad {idx + 1}{overrides[idx]?.text ? " [Edited]" : ""}</div>
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Dev: Tests */}
          <div className="bg-white/70 backdrop-blur border rounded-2xl shadow-sm p-5">
            <details>
              <summary className="cursor-pointer font-semibold">Tests (dev)</summary>
              <ul className="mt-3 space-y-2 text-sm">
                {testResults.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {t.pass ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span>{t.name}{t.details ? `: ${t.details}` : ""}</span>
                  </li>
                ))}
              </ul>
              <div className={`mt-3 text-sm ${allPass ? "text-green-700" : "text-red-700"}`}>{allPass ? "All tests passed." : "Some tests failed. See above."}</div>
            </details>
          </div>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-8 text-center text-xs text-gray-500">
        Pro tip: Toggle sections off to exclude them from combinations. Everything saves automatically to your browser.
      </footer>
    </div>
  );
}
