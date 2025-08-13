import React, { useEffect, useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, Download, FolderDown, FileText, Settings, CheckCircle2, XCircle } from "lucide-react";
import JSZip from "jszip";
// IMPORTANT: default import for file-saver for CDN + ESM compatibility
import saveAs from "file-saver";

// ---------- Types ----------
type SectionItem = { id: string; text: string };
type Section = { id: string; name: string; items: SectionItem[]; enabled: boolean };

type TestResult = { name: string; pass: boolean; details?: string };

// ---------- Utilities ----------
const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_SECTIONS: Section[] = [
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

function productCount(sections: Section[]): number {
  const active = sections.filter(s => s.enabled);
  if (active.length === 0) return 0;
  return active.reduce((acc, s) => acc * Math.max(1, s.items.length), 1);
}

function *cartesianGenerator(lists: SectionItem[][]): Generator<SectionItem[]> {
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

function normalizeFileName(text: string, max = 40) {
  const clean = text.replace(/\s+/g, " ").trim().replace(/[^a-z0-9 \-_.]/gi, "");
  return (clean.slice(0, max) || "ad").replace(/\s+/g, "-").toLowerCase();
}

function downloadBlob(blob: Blob, filename: string) {
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

// ---------- Sortable Components ----------
function SortableSection({ section, onChange, onDelete }: { section: Section; onChange: (s: Section) => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style: React.CSSProperties = {
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

function ItemsEditor({ section, onChange }: { section: Section; onChange: (s: Section) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const updateItem = (id: string, text: string) => {
    onChange({ ...section, items: section.items.map(it => it.id === id ? { ...it, text } : it) });
  };

  const addItem = (text = "") => {
    onChange({ ...section, items: [...section.items, { id: uid(), text }] });
  };

  const bulkAdd = (blob: string) => {
    const lines = blob.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length) {
      onChange({ ...section, items: [...section.items, ...lines.map(text => ({ id: uid(), text }))] });
    }
  };

  const onDragEnd = (e: any) => {
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

function SortableLine({ item, onChangeText, onDelete, sectionName }: { item: SectionItem; onChangeText: (t: string) => void; onDelete: () => void; sectionName: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [sections, setSections] = useState<Section[]>(() => {
    try {
      const raw = localStorage.getItem("avb.sections");
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_SECTIONS;
  });

  const [includeHeadings, setIncludeHeadings] = useState<boolean>(() => localStorage.getItem("avb.headings") === "1");
  const [separator, setSeparator] = useState<string>(() => localStorage.getItem("avb.sep") ?? "\n\n");
  const [maxForPreview, setMaxForPreview] = useState<number>(20);
  const [maxForZip, setMaxForZip] = useState<number>(3000);

  useEffect(() => {
    localStorage.setItem("avb.sections", JSON.stringify(sections));
  }, [sections]);
  useEffect(() => { localStorage.setItem("avb.headings", includeHeadings ? "1" : "0"); }, [includeHeadings]);
  useEffect(() => { localStorage.setItem("avb.sep", separator); }, [separator]);

  const sectionIds = sections.map(s => s.id);
  const totalCombos = useMemo(() => productCount(sections), [sections]);
  const activeSections = useMemo(() => sections.filter(s => s.enabled && s.items.length > 0), [sections]);

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    setSections(arrayMove(sections, oldIndex, newIndex));
  };

  const addSection = () => {
    setSections(prev => [...prev, { id: uid(), name: "New Section", items: [], enabled: true }]);
  };

  const resetDefaults = () => setSections(DEFAULT_SECTIONS.map(s => ({ ...s, id: uid(), items: s.items.map(i => ({ ...i, id: uid() })) })));

  // pure function so we can test easily
  const buildTextFromParts = (parts: { name: string; text: string }[], withHeadings: boolean, sep: string) => {
    const chunks = parts.map(p => withHeadings ? `${p.name}\n${p.text}` : p.text);
    return chunks.join(sep || "\n\n").trim() + "\n";
  };

  const buildText = (parts: { name: string; text: string }[]) => buildTextFromParts(parts, includeHeadings, separator);

  const generatePreview = (): string[] => {
    const lists = activeSections.map(s => s.items);
    const out: string[] = [];
    let i = 0;
    for (const combo of cartesianGenerator(lists)) {
      if (i++ >= maxForPreview) break;
      const parts = combo.map((it, idx) => ({ name: activeSections[idx].name, text: it.text }));
      out.push(buildText(parts));
    }
    return out;
  };

  const downloadZip = async () => {
    if (totalCombos === 0) return;
    if (totalCombos > maxForZip) {
      const ok = confirm(`You are about to generate ${totalCombos.toLocaleString()} files. This may be slow or crash your browser. Continue?`);
      if (!ok) return;
    }
    const zip = new JSZip();
    const lists = activeSections.map(s => s.items);
    let index = 1;
    const pad = String(totalCombos).length;
    for (const combo of cartesianGenerator(lists)) {
      const parts = combo.map((it, idx) => ({ name: activeSections[idx].name, text: it.text }));
      const content = buildText(parts);
      const first = combo[0]?.text || "ad";
      const fname = `${String(index).padStart(pad, "0")}_${normalizeFileName(first)}.txt`;
      zip.file(fname, content);
      index++;
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `ad_variations_${new Date().toISOString().slice(0,10)}.zip`);
  };

  const downloadCombined = () => {
    if (totalCombos === 0) return;
    const lists = activeSections.map(s => s.items);
    let i = 1;
    const pieces: string[] = [];
    for (const combo of cartesianGenerator(lists)) {
      const parts = combo.map((it, idx) => ({ name: activeSections[idx].name, text: it.text }));
      const body = buildText(parts);
      pieces.push(`### Ad ${i}\n\n${body}`);
      i++;
    }
    const blob = new Blob([pieces.join("\n\n---\n\n")], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `ad_variations_combined_${new Date().toISOString().slice(0,10)}.txt`);
  };

  const downloadIndividually = async () => {
    if (totalCombos === 0) return;
    const go = confirm("This will trigger many download prompts (one per file). Continue?");
    if (!go) return;
    const lists = activeSections.map(s => s.items);
    let index = 1;
    const pad = String(totalCombos).length;
    for (const combo of cartesianGenerator(lists)) {
      const parts = combo.map((it, idx) => ({ name: activeSections[idx].name, text: it.text }));
      const content = buildText(parts);
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const first = combo[0]?.text || "ad";
      const fname = `${String(index).padStart(pad, "0")}_${normalizeFileName(first)}.txt`;
      downloadBlob(blob, fname);
      // Allow UI to breathe a bit for huge batches
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 5));
      index++;
    }
  };

  const preview = useMemo(() => generatePreview(), [sections, includeHeadings, separator, maxForPreview]);

  // ---------- Tiny Test Runner (dev) ----------
  const testResults = useMemo<TestResult[]>(() => {
    const results: TestResult[] = [];

    // productCount tests
    const s1: Section = { id: "a", name: "A", enabled: true, items: [{ id: "1", text: "x" }, { id: "2", text: "y" }] };
    const s2: Section = { id: "b", name: "B", enabled: true, items: [{ id: "3", text: "z" }] };
    const s3: Section = { id: "c", name: "C", enabled: false, items: [{ id: "4", text: "q" }] };
    const pc = productCount([s1, s2, s3]);
    results.push({ name: "productCount basic", pass: pc === 2 });

    // cartesianGenerator tests
    const lists: SectionItem[][] = [[{ id: "1", text: "A" }, { id: "2", text: "B" }], [{ id: "3", text: "C" }]];
    const combos = Array.from(cartesianGenerator(lists)).map(c => c.map(x => x.id).join("-"));
    results.push({ name: "cartesian order", pass: combos.length === 2 && combos[0] === "1-3" && combos[1] === "2-3" });

    // normalizeFileName tests
    results.push({ name: "normalize trims & cleans", pass: normalizeFileName("  Hello*/World  ") === "hello/world".replace("/", "-") });

    // buildTextFromParts tests (with and without headings)
    const parts = [{ name: "Hook", text: "H1" }, { name: "Body", text: "B1" }];
    const t1 = buildTextFromParts(parts, false, "\n\n");
    const t2 = buildTextFromParts(parts, true, " -- ");
    results.push({ name: "buildText no headings", pass: t1 === "H1\n\nB1\n" });
    results.push({ name: "buildText with headings", pass: t2 === "Hook\nH1 -- Body\nB1\n" });

    return results;
  }, []);

  const allPass = testResults.every(t => t.pass);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white text-gray-900">
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-black text-white grid place-content-center text-sm font-bold">AV</div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Ad Variations Builder</h1>
              <p className="text-xs text-gray-600">Compose sections • Drag to reorder • Export every combination</p>
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

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
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

        {/* Right: Preview & Export */}
        <section className="lg:sticky lg:top-16 h-fit">
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

          <div className="mt-6 bg-white/80 backdrop-blur border rounded-2xl shadow-sm p-5">
            <h3 className="font-semibold mb-2">Preview</h3>
            {preview.length === 0 ? (
              <p className="text-sm text-gray-500">Add at least one option to each enabled section to see preview combinations.</p>
            ) : (
              <ul className="space-y-4">
                {preview.map((p, idx) => (
                  <li key={idx} className="border rounded-xl p-3 text-sm whitespace-pre-wrap">
                    <div className="text-xs text-gray-500 mb-2">Ad {idx + 1}</div>
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Dev: Tests */}
          <div className="mt-6 bg-white/70 backdrop-blur border rounded-2xl shadow-sm p-5">
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
