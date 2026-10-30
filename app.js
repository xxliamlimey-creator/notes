/* --------------------------------------------------------------------------
   Notes — a local-first Apple Notes experience for Windows
   No frameworks. No network. Everything lives in localStorage.
   -------------------------------------------------------------------------- */

(() => {
  "use strict";

  const STORAGE_KEY = "notes.pwa.state.v1";
  const STORAGE_VERSION = 1;
  const INSTALL_DISMISS_KEY = "notes.pwa.installBannerDismissed";
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const els = {
    html: document.documentElement,
    body: document.body,
    themeColorMeta: $("#themeColorMeta"),
    appWindow: $("#appWindow"),
    appBody: $("#appBody"),
    sidebar: $("#sidebar"),
    sidebarBackdrop: $("#sidebarBackdrop"),
    sidebarToggleBtn: $("#sidebarToggleBtn"),
    folderNav: $(".folder-nav"),
    folderList: $("#folderList"),
    allNotesRow: $("#allNotesRow"),
    trashRow: $("#trashRow"),
    allNotesCount: $("#allNotesCount"),
    trashCount: $("#trashCount"),
    newFolderBtn: $("#newFolderBtn"),
    installCard: $("#installCard"),
    titlebarInstallBtn: $("#titlebarInstallBtn"),
    installBanner: $("#installBanner"),
    installBannerBtn: $("#installBannerBtn"),
    dismissInstallBtn: $("#dismissInstallBtn"),
    appearanceBtn: $("#appearanceBtn"),
    themeToggleBtn: $("#themeToggleBtn"),
    shortcutsBtn: $("#shortcutsBtn"),
    aboutBtn: $("#aboutBtn"),
    notesPanel: $("#notesPanel"),
    notesPanelTitle: $("#notesPanelTitle"),
    notesPanelCount: $("#notesPanelCount"),
    notesPanelSubtitle: $("#notesPanelSubtitle"),
    notesScroll: $("#notesScroll"),
    notesList: $("#notesList"),
    notesFooterCount: $("#notesFooterCount"),
    viewOptionsBtn: $("#viewOptionsBtn"),
    newNoteBtn: $("#newNoteBtn"),
    searchInput: $("#searchInput"),
    searchClearBtn: $("#searchClearBtn"),
    emptyEditor: $("#emptyEditor"),
    emptyNewNoteBtn: $("#emptyNewNoteBtn"),
    noteEditor: $("#noteEditor"),
    backToListBtn: $("#backToListBtn"),
    formatBtn: $("#formatBtn"),
    boldBtn: $("#boldBtn"),
    italicBtn: $("#italicBtn"),
    underlineBtn: $("#underlineBtn"),
    strikeBtn: $("#strikeBtn"),
    checklistBtn: $("#checklistBtn"),
    bulletsBtn: $("#bulletsBtn"),
    numbersBtn: $("#numbersBtn"),
    dashBtn: $("#dashBtn"),
    formatPopover: $("#formatPopover"),
    popoverBoldBtn: $("#popoverBoldBtn"),
    popoverItalicBtn: $("#popoverItalicBtn"),
    popoverUnderlineBtn: $("#popoverUnderlineBtn"),
    popoverStrikeBtn: $("#popoverStrikeBtn"),
    popoverChecklistBtn: $("#popoverChecklistBtn"),
    popoverBulletsBtn: $("#popoverBulletsBtn"),
    popoverNumbersBtn: $("#popoverNumbersBtn"),
    popoverDashBtn: $("#popoverDashBtn"),
    pinNoteBtn: $("#pinNoteBtn"),
    moveNoteBtn: $("#moveNoteBtn"),
    shareNoteBtn: $("#shareNoteBtn"),
    noteMoreBtn: $("#noteMoreBtn"),
    editorScroll: $("#editorScroll"),
    noteDocumentMeta: $("#noteDocumentMeta"),
    noteContent: $("#noteContent"),
    trashBanner: $("#trashBanner"),
    restoreNoteBtn: $("#restoreNoteBtn"),
    deleteForeverBtn: $("#deleteForeverBtn"),
    saveIndicator: $("#saveIndicator"),
    saveStatus: $("#saveStatus"),
    wordCount: $("#wordCount"),
    charCount: $("#charCount"),
    modifiedLabel: $("#modifiedLabel"),
    contextMenu: $("#contextMenu"),
    appDialog: $("#appDialog"),
    appDialogForm: $("#appDialogForm"),
    appDialogIcon: $("#appDialogIcon"),
    appDialogTitle: $("#appDialogTitle"),
    appDialogDescription: $("#appDialogDescription"),
    appDialogBody: $("#appDialogBody"),
    appDialogCancel: $("#appDialogCancel"),
    appDialogConfirm: $("#appDialogConfirm"),
    toastRegion: $("#toastRegion"),
  };

  const SYSTEM_DARK = window.matchMedia("(prefers-color-scheme: dark)");
  const NARROW_SIDEBAR = window.matchMedia("(max-width: 900px)");
  const MOBILE_LAYOUT = window.matchMedia("(max-width: 720px)");

  const DEFAULT_PREFERENCES = Object.freeze({
    theme: "auto",
    sort: "modified",
    showPinnedSection: true,
    sidebarCollapsed: false,
  });

  const ui = {
    query: "",
    deferredPrompt: null,
    installBannerDismissed: false,
    installPromptUsed: false,
    menuItems: [],
    menuReturnFocus: null,
    menuOutsideHandler: null,
    menuKeyHandler: null,
    dialog: null,
    dialogReturnFocus: null,
    saveTimer: null,
    listRenderTimer: null,
    editorDirty: false,
    saveState: "saved",
    mobileEditorOpen: false,
    sidebarOpen: false,
    lastDeleted: null,
    toastTimer: null,
    storageFailureShown: false,
    selectionFrame: null,
    justCreatedNote: false,
  };

  let state = null;

  /* --------------------------------------------------------------------------
     Seeds and small utilities
     -------------------------------------------------------------------------- */

  function uid(prefix = "id") {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pluralize(count, singular, plural = `${singular}s`) {
    return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(undefined).format(value);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function normalizeSpaces(value) {
    return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function iconMarkup(name, className = "icon") {
    return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function createSeedState() {
    const now = Date.now();

    const folders = [
      { id: "folder-notes", name: "Notes", createdAt: now - 120 * DAY },
      { id: "folder-work", name: "Work", createdAt: now - 112 * DAY },
      { id: "folder-personal", name: "Personal", createdAt: now - 101 * DAY },
      { id: "folder-ideas", name: "Ideas", createdAt: now - 86 * DAY },
      { id: "folder-travel", name: "Travel", createdAt: now - 64 * DAY },
    ];

    const notes = [
      {
        id: "note-welcome",
        folderId: "folder-notes",
        title: "Welcome to Notes",
        content: `<h1>Welcome to Notes</h1>
<p>Everything you write is saved automatically — no save button, no cloud account, no friction.</p>
<h2>A few things to try</h2>
<ul class="checklist">
<li data-checked="true">Pin a note to keep it above the rest</li>
<li>Click a circle to check an item off</li>
<li>Drag a note onto a folder to move it</li>
<li>Search everything with <b>Ctrl K</b></li>
</ul>
<blockquote>Use the <b>Aa</b> menu to switch between Title, Heading, Subheading, Body, and Monospaced text.</blockquote>
<p>Your notes live safely in this browser on this PC, and Notes keeps working even when the internet does not.</p>`,
        createdAt: now - 47 * DAY,
        updatedAt: now - 39 * MINUTE,
        pinned: true,
        pinnedAt: now - 5 * DAY,
        deletedAt: null,
      },
      {
        id: "note-aurora",
        folderId: "folder-work",
        title: "Aurora — launch plan",
        content: `<h1>Aurora — launch plan</h1>
<p>Final stretch for the desktop release. Keep this note pinned until we ship.</p>
<h2>This week</h2>
<ul class="checklist">
<li data-checked="true">Lock the onboarding copy</li>
<li data-checked="true">QA on Windows 11 + Chrome</li>
<li>Record the 40-second demo</li>
<li>Publish release notes</li>
</ul>
<h2>Open questions</h2>
<ul class="dashed-list">
<li>Do we keep the old import flow?</li>
<li>Can the updater run silently on first launch?</li>
<li>Who owns the support inbox during launch week?</li>
</ul>
<blockquote>Ship the calm version. Polish what people touch every day.</blockquote>`,
        createdAt: now - 22 * DAY,
        updatedAt: now - 2 * HOUR - 14 * MINUTE,
        pinned: true,
        pinnedAt: now - 8 * HOUR,
        deletedAt: null,
      },
      {
        id: "note-design-review",
        folderId: "folder-work",
        title: "Design review · Thursday",
        content: `<h1>Design review · Thursday</h1>
<p><b>Attendees:</b> Maya, Jonas, Priya, me</p>
<h2>Decisions</h2>
<ol>
<li>Keep the new sidebar width at 252 px.</li>
<li>Move export into the note's more menu.</li>
<li>Use the warmer paper background in light mode.</li>
</ol>
<h2>Follow-up</h2>
<ul class="checklist">
<li data-checked="true">Share updated tokens</li>
<li>Prototype the empty state</li>
<li>Check contrast in the dark editor</li>
</ul>
<p>Next review is Tuesday at 10:30.</p>`,
        createdAt: now - 18 * DAY,
        updatedAt: now - 27 * HOUR,
        pinned: false,
        pinnedAt: null,
        deletedAt: null,
      },
      {
        id: "note-copenhagen",
        folderId: "folder-travel",
        title: "Weekend in Copenhagen",
        content: `<h1>Weekend in Copenhagen</h1>
<p>Three nights in late November. Cold, bright, and hopefully full of good pastries.</p>
<h2>Plan</h2>
<ul class="dashed-list">
<li>Friday — arrive, check in, harbour walk</li>
<li>Saturday — Louisiana Museum in the morning</li>
<li>Sunday — Torvehallerne, then bike to Assistens</li>
</ul>
<h2>To book</h2>
<ul class="checklist">
<li>Train from Hamburg</li>
<li>Table at the small place near Nørrebro</li>
<li data-checked="true">Museum tickets</li>
</ul>
<p><i>Bring:</i> wool socks, the small camera, a notebook.</p>`,
        createdAt: now - 33 * DAY,
        updatedAt: now - 50 * HOUR,
        pinned: false,
        pinnedAt: null,
        deletedAt: null,
      },
      {
        id: "note-groceries",
        folderId: "folder-personal",
        title: "Grocery list",
        content: `<h1>Grocery list</h1>
<ul class="checklist">
<li data-checked="true">Coffee beans</li>
<li data-checked="true">Oat milk</li>
<li>Lemons</li>
<li>Rye bread</li>
<li>Good butter</li>
<li>Tomatoes on the vine</li>
<li>Something green</li>
</ul>
<p>Saturday market, before 11.</p>`,
        createdAt: now - 12 * DAY,
        updatedAt: now - 3 * DAY - 2 * HOUR,
        pinned: false,
        pinnedAt: null,
        deletedAt: null,
      },
      {
        id: "note-books",
        folderId: "folder-ideas",
        title: "Books to read this autumn",
        content: `<h1>Books to read this autumn</h1>
<p>A short list. No pressure, no reading challenges.</p>
<ol>
<li><b>The Left Hand of Darkness</b> — Ursula K. Le Guin</li>
<li><b>Piranesi</b> — Susanna Clarke</li>
<li><b>Ways of Seeing</b> — John Berger</li>
<li><b>The Creative Act</b> — Rick Rubin</li>
</ol>
<h2>Notes</h2>
<p>Buy the Berger from the shop on the corner instead of ordering it online.</p>`,
        createdAt: now - 29 * DAY,
        updatedAt: now - 6 * DAY - 4 * HOUR,
        pinned: false,
        pinnedAt: null,
        deletedAt: null,
      },
      {
        id: "note-sunday",
        folderId: "folder-personal",
        title: "A slow Sunday",
        content: `<h1>A slow Sunday</h1>
<p>Woke up without an alarm. Made coffee twice because the first cup went cold while I was reading.</p>
<p>The light in the kitchen was unusually good, so I stayed at the table longer than planned and wrote down a few things worth keeping:</p>
<ul class="dashed-list">
<li>Walk the long way to the bakery.</li>
<li>Call Mum before dinner.</li>
<li>Finish the book on the bedside table.</li>
</ul>
<p>Nothing urgent. A good day for that.</p>`,
        createdAt: now - 44 * DAY,
        updatedAt: now - 9 * DAY - 7 * HOUR,
        pinned: false,
        pinnedAt: null,
        deletedAt: null,
      },
      {
        id: "note-friction",
        folderId: "folder-ideas",
        title: "Friction log",
        content: `<h1>Friction log</h1>
<p>Small annoyances worth collecting. Not every one needs a fix.</p>
<ul class="dashed-list">
<li>The update button appears before the download is actually ready.</li>
<li>Dragging a file onto the window opens it in a tab instead of importing.</li>
<li>The command palette forgets the last search.</li>
<li>“New folder” should land in rename mode, not just select the folder.</li>
</ul>
<h2>Maybe next</h2>
<ul class="checklist">
<li data-checked="true">Rename this note</li>
<li>Try a weekly review on Friday</li>
</ul>`,
        createdAt: now - 70 * DAY,
        updatedAt: now - 17 * DAY - 3 * HOUR,
        pinned: false,
        pinnedAt: null,
        deletedAt: null,
      },
    ];

    return {
      version: STORAGE_VERSION,
      folders,
      notes,
      selectedFolderId: "all",
      selectedNoteId: "note-welcome",
      preferences: { ...DEFAULT_PREFERENCES },
    };
  }

  /* --------------------------------------------------------------------------
     Content sanitizing and text helpers
     -------------------------------------------------------------------------- */

  const ALLOWED_TAGS = new Set([
    "H1", "H2", "H3", "P", "DIV", "BR", "B", "STRONG", "I", "EM",
    "U", "S", "STRIKE", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "SPAN",
  ]);

  const BLOCKED_TAGS = new Set([
    "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH", "FORM",
    "INPUT", "BUTTON", "TEXTAREA", "SELECT", "OPTION", "A", "IMG", "VIDEO",
    "AUDIO", "SOURCE", "TRACK", "LINK", "META", "BASE", "CANVAS", "TEMPLATE",
  ]);

  function sanitizeNoteHtml(html) {
    const input = typeof html === "string" ? html : "";
    if (!input) return "";

    const parser = new DOMParser();
    const sourceDoc = parser.parseFromString(`<!doctype html><body>${input}</body>`, "text/html");
    const cleanDoc = document.implementation.createHTMLDocument("");
    const output = cleanDoc.body;

    const copyChildren = (sourceParent, targetParent) => {
      Array.from(sourceParent.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          targetParent.appendChild(cleanDoc.createTextNode(node.nodeValue || ""));
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName.toUpperCase();
        if (BLOCKED_TAGS.has(tag)) return;

        if (!ALLOWED_TAGS.has(tag)) {
          copyChildren(node, targetParent);
          return;
        }

        const el = cleanDoc.createElement(tag.toLowerCase());
        if (tag === "UL") {
          if (node.classList.contains("checklist")) el.classList.add("checklist");
          if (node.classList.contains("dashed-list")) el.classList.add("dashed-list");
        }
        if (tag === "LI") {
          const checked = node.getAttribute("data-checked");
          if (checked === "true" || checked === "false") {
            el.setAttribute("data-checked", checked);
          }
        }

        copyChildren(node, el);
        targetParent.appendChild(el);
      });
    };

    copyChildren(sourceDoc.body, output);

    output.querySelectorAll("ul.checklist > li").forEach((li) => {
      if (!li.hasAttribute("data-checked")) li.setAttribute("data-checked", "false");
    });

    return output.innerHTML;
  };

  function htmlToText(html) {
    if (!html) return "";
    const template = document.createElement("template");
    template.innerHTML = sanitizeNoteHtml(html);
    template.content.querySelectorAll("br").forEach((br) => {
      br.replaceWith(document.createTextNode("\n"));
    });
    const text = template.content.textContent || "";
    return text
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function extractTitle(html) {
    if (!html) return "New Note";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = sanitizeNoteHtml(html);

    const blocks = Array.from(wrapper.children);
    for (const block of blocks) {
      const text = normalizeSpaces(block.textContent);
      if (text) return text.slice(0, 180);
    }

    const fallback = normalizeSpaces(wrapper.textContent);
    return fallback ? fallback.slice(0, 180) : "New Note";
  }

  function noteSnippet(note, maxLength = 150) {
    const full = htmlToText(note.content);
    if (!full) return "No additional text";

    const title = note.title || extractTitle(note.content);
    let rest = full;
    const index = rest.toLowerCase().indexOf(title.toLowerCase());
    if (index >= 0) {
      rest = `${rest.slice(0, index)} ${rest.slice(index + title.length)}`;
    }
    rest = normalizeSpaces(rest);
    if (!rest) return "No additional text";
    return rest.length > maxLength ? `${rest.slice(0, maxLength).trimEnd()}…` : rest;
  }

  function searchableText(note) {
    const folder = state.folders.find((item) => item.id === note.folderId);
    return `${note.title}\n${htmlToText(note.content)}\n${folder ? folder.name : ""}`.toLowerCase();
  }

  function countWords(text) {
    const normalized = String(text || "").trim();
    if (!normalized) return 0;
    if (typeof Intl.Segmenter === "function") {
      try {
        const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
        let count = 0;
        for (const segment of segmenter.segment(normalized)) {
          if (segment.isWordLike) count += 1;
        }
        return count;
      } catch (_) {
        // Fall through to a unicode-aware approximation.
      }
    }
    return (normalized.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
  }

  function highlightText(value, query) {
    const text = String(value ?? "");
    const term = String(query ?? "").trim();
    if (!term) return escapeHtml(text);

    const safe = escapeHtml(text);
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      return safe.replace(new RegExp(`(${escapedTerm})`, "gi"), '<mark class="search-mark">$1</mark>');
    } catch (_) {
      return safe;
    }
  }

  /* --------------------------------------------------------------------------
     Date helpers
     -------------------------------------------------------------------------- */

  function startOfDay(timestamp) {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  function calendarDayDifference(timestamp) {
    return Math.round((startOfDay(Date.now()) - startOfDay(timestamp)) / DAY);
  }

  function formatClock(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  }

  function formatListDate(timestamp) {
    const difference = calendarDayDifference(timestamp);
    if (difference <= 0) return formatClock(timestamp);
    if (difference === 1) return "Yesterday";
    if (difference < 7) {
      return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(timestamp));
    }
    const date = new Date(timestamp);
    const now = new Date();
    if (date.getFullYear() === now.getFullYear()) {
      return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
    }).format(date);
  }

  function dateBucket(timestamp) {
    const difference = calendarDayDifference(timestamp);
    if (difference <= 0) return "Today";
    if (difference === 1) return "Yesterday";
    if (difference < 7) return "Previous 7 Days";
    if (difference < 30) return "Previous 30 Days";
    return "Earlier";
  }

  function formatEditedLabel(timestamp) {
    const distance = Math.max(0, Date.now() - timestamp);
    if (distance < 45_000) return "Edited just now";
    if (distance < HOUR) return `Edited ${Math.max(1, Math.floor(distance / MINUTE))} min ago`;

    const difference = calendarDayDifference(timestamp);
    if (difference <= 0) return `Edited today at ${formatClock(timestamp)}`;
    if (difference === 1) return `Edited yesterday at ${formatClock(timestamp)}`;
    if (difference < 7) {
      const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(timestamp));
      return `Edited ${weekday} at ${formatClock(timestamp)}`;
    }

    const date = new Date(timestamp);
    const now = new Date();
    if (date.getFullYear() === now.getFullYear()) {
      return `Edited ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)}`;
    }
    return `Edited ${new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)}`;
  }

  function formatCreatedLabel(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(timestamp));
  }

  function formatFullTimestamp(timestamp) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));
  }

  /* --------------------------------------------------------------------------
     Persistence
     -------------------------------------------------------------------------- */

  function getFolder(folderId) {
    return state.folders.find((folder) => folder.id === folderId) || null;
  }

  function getNote(noteId) {
    return state.notes.find((note) => note.id === noteId) || null;
  }

  function getSelectedNote() {
    return state ? getNote(state.selectedNoteId) : null;
  }

  function getDefaultFolder() {
    return state.folders.find((folder) => folder.name === "Notes") || state.folders[0] || null;
  }

  function ensureFolderExists() {
    if (!state.folders.length) {
      state.folders.push({
        id: uid("folder"),
        name: "Notes",
        createdAt: Date.now(),
      });
    }
    return state.folders[0];
  }

  function activeNotesForFolder(folderId) {
    return state.notes.filter((note) => !note.deletedAt && note.folderId === folderId);
  }

  function trashNotes() {
    return state.notes
      .filter((note) => Boolean(note.deletedAt))
      .sort((a, b) => b.deletedAt - a.deletedAt);
  }

  function loadStoredState() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      return normalizeStoredState(parsed);
    } catch (_) {
      return null;
    }
  }

  function normalizeStoredState(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (!Array.isArray(raw.folders) || !Array.isArray(raw.notes)) return null;

    const seenFolderIds = new Set();
    const folders = [];
    raw.folders.forEach((folder) => {
      if (!folder || typeof folder !== "object") return;
      const id = typeof folder.id === "string" ? folder.id : "";
      const name = normalizeSpaces(folder.name);
      if (!id || !name || seenFolderIds.has(id)) return;
      seenFolderIds.add(id);
      folders.push({
        id,
        name: name.slice(0, 60),
        createdAt: Number.isFinite(folder.createdAt) ? folder.createdAt : Date.now(),
      });
    });

    if (!folders.length) {
      folders.push({ id: "folder-notes", name: "Notes", createdAt: Date.now() });
    }

    const folderIds = new Set(folders.map((folder) => folder.id));
    const seenNoteIds = new Set();
    const notes = [];

    raw.notes.forEach((note) => {
      if (!note || typeof note !== "object") return;
      const id = typeof note.id === "string" ? note.id : "";
      if (!id || seenNoteIds.has(id)) return;
      seenNoteIds.add(id);

      const folderId = folderIds.has(note.folderId) ? note.folderId : folders[0].id;
      const content = sanitizeNoteHtml(typeof note.content === "string" ? note.content : "");
      const createdAt = Number.isFinite(note.createdAt) ? note.createdAt : Date.now();
      const updatedAt = Number.isFinite(note.updatedAt) ? note.updatedAt : createdAt;

      notes.push({
        id,
        folderId,
        title: extractTitle(content) || normalizeSpaces(note.title) || "New Note",
        content,
        createdAt,
        updatedAt,
        pinned: Boolean(note.pinned) && !note.deletedAt,
        pinnedAt: Number.isFinite(note.pinnedAt) ? note.pinnedAt : null,
        deletedAt: Number.isFinite(note.deletedAt) ? note.deletedAt : null,
      });
    });

    const prefs = raw.preferences && typeof raw.preferences === "object" ? raw.preferences : {};
    const preferences = {
      theme: ["auto", "light", "dark"].includes(prefs.theme) ? prefs.theme : "auto",
      sort: ["modified", "created", "title"].includes(prefs.sort) ? prefs.sort : "modified",
      showPinnedSection: prefs.showPinnedSection !== false,
      sidebarCollapsed: prefs.sidebarCollapsed === true,
    };

    const selectedFolderId =
      raw.selectedFolderId === "all" ||
      raw.selectedFolderId === "trash" ||
      folderIds.has(raw.selectedFolderId)
        ? raw.selectedFolderId
        : "all";

    let selectedNoteId = typeof raw.selectedNoteId === "string" ? raw.selectedNoteId : null;
    const selected = notes.find((note) => note.id === selectedNoteId);
    if (!selected) {
      const first = notes
        .filter((note) => !note.deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      selectedNoteId = first ? first.id : null;
    }

    return {
      version: STORAGE_VERSION,
      folders,
      notes,
      selectedFolderId,
      selectedNoteId,
      preferences,
    };
  }

  function serializableState() {
    return {
      version: STORAGE_VERSION,
      folders: state.folders,
      notes: state.notes,
      selectedFolderId: state.selectedFolderId,
      selectedNoteId: state.selectedNoteId,
      preferences: state.preferences,
    };
  }

  function persistNow({ silent = false } = {}) {
    if (ui.saveTimer) {
      clearTimeout(ui.saveTimer);
      ui.saveTimer = null;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()));
      if (!silent) setSaveState("saved", "Saved");
      return true;
    } catch (error) {
      setSaveState("error", "Not saved");
      if (!ui.storageFailureShown) {
        ui.storageFailureShown = true;
        showToast("Notes could not save to this browser's storage.", {
          icon: "trash",
          duration: 6500,
        });
      }
      console.error("Notes could not persist state:", error);
      return false;
    }
  }

  function queuePersist() {
    setSaveState("saving", "Saving…");
    if (ui.saveTimer) clearTimeout(ui.saveTimer);
    ui.saveTimer = window.setTimeout(() => {
      persistNow();
    }, 420);
  }

  /* --------------------------------------------------------------------------
     Save state, theme, layout, install and shared UI primitives
     -------------------------------------------------------------------------- */

  function setSaveState(kind, label) {
    ui.saveState = kind;
    if (!els.saveIndicator) return;
    els.saveIndicator.classList.toggle("is-saving", kind === "saving");
    els.saveIndicator.classList.toggle("is-error", kind === "error");
    if (els.saveStatus.textContent !== label) els.saveStatus.textContent = label;
  }

  function getEffectiveTheme() {
    const preference = state?.preferences?.theme || "auto";
    if (preference === "auto") return SYSTEM_DARK.matches ? "dark" : "light";
    return preference;
  }

  function applyTheme() {
    const effective = getEffectiveTheme();
    els.html.dataset.theme = effective;
    els.html.style.colorScheme = effective;
    if (els.themeColorMeta) {
      els.themeColorMeta.setAttribute("content", effective === "dark" ? "#1c1c1e" : "#fbf9f4");
    }
    if (els.themeToggleBtn) {
      els.themeToggleBtn.setAttribute(
        "aria-label",
        effective === "dark" ? "Switch to light appearance" : "Switch to dark appearance"
      );
      els.themeToggleBtn.title =
        effective === "dark" ? "Switch to light appearance" : "Switch to dark appearance";
    }
  }

  function setThemePreference(preference) {
    if (!["auto", "light", "dark"].includes(preference)) return;
    state.preferences.theme = preference;
    applyTheme();
    persistNow({ silent: true });
  }

  function toggleTheme() {
    const effective = getEffectiveTheme();
    setThemePreference(effective === "dark" ? "light" : "dark");
  }

  function openAppearanceMenu(anchor = els.appearanceBtn) {
    openContextMenu({
      anchor,
      align: "left",
      items: [
        { heading: "Appearance" },
        {
          icon: "monitor",
          label: "Automatic",
          checked: state.preferences.theme === "auto",
          action: () => setThemePreference("auto"),
        },
        {
          icon: "sun",
          label: "Light",
          checked: state.preferences.theme === "light",
          action: () => setThemePreference("light"),
        },
        {
          icon: "moon",
          label: "Dark",
          checked: state.preferences.theme === "dark",
          action: () => setThemePreference("dark"),
        },
      ],
    });
  }

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.navigator.standalone === true
    );
  }

  function updateInstallUI() {
    const standalone = isStandalone();
    if (els.installCard) els.installCard.hidden = standalone;
    if (els.titlebarInstallBtn) {
      els.titlebarInstallBtn.hidden = standalone || !ui.deferredPrompt;
    }
    if (standalone || ui.installBannerDismissed || !ui.deferredPrompt) {
      if (els.installBanner) els.installBanner.hidden = true;
    } else if (els.installBanner) {
      els.installBanner.hidden = false;
    }
  }

  function dismissInstallBanner() {
    ui.installBannerDismissed = true;
    try {
      sessionStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch (_) {
      // Session storage may be blocked; the in-memory flag is enough.
    }
    if (els.installBanner) els.installBanner.hidden = true;
  }

  async function promptInstall() {
    if (isStandalone()) {
      updateInstallUI();
      return;
    }

    if (!ui.deferredPrompt) {
      openInstallHelp();
      return;
    }

    const promptEvent = ui.deferredPrompt;
    ui.deferredPrompt = null;
    ui.installPromptUsed = true;
    if (els.installBanner) els.installBanner.hidden = true;
    if (els.titlebarInstallBtn) els.titlebarInstallBtn.hidden = true;

    try {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === "accepted") {
        showToast("Installing Notes…", { icon: "download", duration: 3200 });
      }
    } catch (error) {
      console.warn("The install prompt could not be shown:", error);
      openInstallHelp();
    } finally {
      updateInstallUI();
    }
  }

  function openInstallHelp() {
    openAppDialog({
      icon: "download",
      title: "Install Notes",
      description: "Add Notes to your desktop for a focused, app-like window that works offline.",
      cancelLabel: "Close",
      confirmHidden: true,
      body: `
        <div class="about-copy">
          <div class="about-feature-row">
            ${iconMarkup("notes")}
            <span><strong>Notes for Windows</strong><br>Launches from the Start menu without browser tabs or distractions.</span>
          </div>
          <p>In Chrome, open the <strong>⋮</strong> menu and choose <strong>Cast, save, and share → Install Notes</strong>. You can also use the install icon in the address bar when it appears.</p>
          <p>If Notes is already open in a standalone window, the install banner disappears automatically.</p>
        </div>`,
    });
  }

  function syncLayout() {
    if (!state) return;
    const narrow = NARROW_SIDEBAR.matches;
    if (!narrow) {
      ui.sidebarOpen = false;
      els.appWindow.classList.remove("sidebar-open");
    }
    els.appWindow.classList.toggle(
      "sidebar-collapsed",
      !narrow && Boolean(state.preferences.sidebarCollapsed)
    );
    els.appWindow.classList.toggle(
      "mobile-editor-open",
      MOBILE_LAYOUT.matches && Boolean(ui.mobileEditorOpen)
    );

    const isCollapsed = !narrow && Boolean(state.preferences.sidebarCollapsed);
    const expanded = narrow ? Boolean(ui.sidebarOpen) : !isCollapsed;
    const label = expanded ? "Hide sidebar" : "Show sidebar";
    els.sidebarToggleBtn.setAttribute("aria-label", label);
    els.sidebarToggleBtn.title = label;
    els.sidebarToggleBtn.setAttribute("aria-expanded", String(expanded));
  }

  function toggleSidebar() {
    if (NARROW_SIDEBAR.matches) {
      ui.sidebarOpen = !ui.sidebarOpen;
      els.appWindow.classList.toggle("sidebar-open", ui.sidebarOpen);
      syncLayout();
      return;
    }

    state.preferences.sidebarCollapsed = !state.preferences.sidebarCollapsed;
    syncLayout();
    persistNow({ silent: true });
  }

  function closeSidebar() {
    if (!NARROW_SIDEBAR.matches) return;
    ui.sidebarOpen = false;
    els.appWindow.classList.remove("sidebar-open");
    syncLayout();
  }

  function focusSearch() {
    if (MOBILE_LAYOUT.matches) {
      ui.mobileEditorOpen = false;
      syncLayout();
    }
    closeSidebar();
    els.searchInput.focus({ preventScroll: true });
    els.searchInput.select();
  }

  /* --------------------------------------------------------------------------
     Toasts
     -------------------------------------------------------------------------- */

  function removeToast(toast) {
    if (!toast || !toast.isConnected) return;
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 190);
  }

  function showToast(message, options = {}) {
    const {
      icon = "check",
      actionLabel = "",
      onAction = null,
      duration = 4200,
    } = options;

    if (!els.toastRegion) return;
    if (ui.toastTimer) {
      clearTimeout(ui.toastTimer);
      ui.toastTimer = null;
    }
    $$(".toast", els.toastRegion).forEach(removeToast);

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");

    const iconEl = document.createElement("span");
    iconEl.innerHTML = iconMarkup(icon, "icon toast-icon");

    const messageEl = document.createElement("span");
    messageEl.className = "toast-message";
    messageEl.textContent = message;

    toast.appendChild(iconEl.firstElementChild);
    toast.appendChild(messageEl);

    if (actionLabel && typeof onAction === "function") {
      const action = document.createElement("button");
      action.className = "toast-action";
      action.type = "button";
      action.textContent = actionLabel;
      action.addEventListener("click", () => {
        removeToast(toast);
        onAction();
      });
      toast.appendChild(action);
    }

    els.toastRegion.appendChild(toast);

    ui.toastTimer = window.setTimeout(() => {
      removeToast(toast);
    }, duration);
  }

  /* --------------------------------------------------------------------------
     Context menus
     -------------------------------------------------------------------------- */

  function closeContextMenu({ restoreFocus = false } = {}) {
    if (!els.contextMenu) return;
    if (ui.menuOutsideHandler) {
      document.removeEventListener("pointerdown", ui.menuOutsideHandler, true);
      ui.menuOutsideHandler = null;
    }
    const wasOpen = !els.contextMenu.hidden;
    els.contextMenu.hidden = true;
    els.contextMenu.innerHTML = "";
    ui.menuItems = [];
    if (wasOpen && restoreFocus && ui.menuReturnFocus?.isConnected) {
      ui.menuReturnFocus.focus({ preventScroll: true });
    }
    ui.menuReturnFocus = null;
  }

  function menuItemMarkup(item, index) {
    if (!item) return "";
    if (item.heading) {
      return `<div class="menu-heading" role="presentation">${escapeHtml(item.heading)}</div>`;
    }
    if (item.separator) {
      return `<div class="menu-separator" role="separator"></div>`;
    }

    const classes = [
      "menu-item",
      item.checked ? "is-checked" : "",
      item.danger ? "is-danger" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `<button class="${classes}" type="button" role="menuitem" data-menu-index="${index}"${
      item.disabled ? " disabled" : ""
    }>
      ${item.icon ? iconMarkup(item.icon, "icon menu-icon") : ""}
      <span class="menu-label">${escapeHtml(item.label || "")}</span>
      ${item.meta ? `<span class="menu-meta">${escapeHtml(item.meta)}</span>` : ""}
      ${item.checked ? iconMarkup("check", "icon menu-check") : ""}
    </button>`;
  }

  function openContextMenu({ x = 0, y = 0, anchor = null, align = "left", prefer = "below", items = [] }) {
    if (!els.contextMenu || !items.length) return;
    closeContextMenu();
    closeFormatPopover();

    ui.menuItems = items;
    ui.menuReturnFocus = document.activeElement;
    els.contextMenu.innerHTML = items.map(menuItemMarkup).join("");
    els.contextMenu.hidden = false;
    els.contextMenu.style.visibility = "hidden";
    els.contextMenu.style.left = "0px";
    els.contextMenu.style.top = "0px";

    const menuRect = els.contextMenu.getBoundingClientRect();
    const viewportPadding = 8;
    let left = x;
    let top = y;

    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      left = align === "right" ? rect.right - menuRect.width : rect.left;
      if (prefer === "above") {
        top = rect.top - menuRect.height - 6;
      } else {
        top = rect.bottom + 6;
      }
    }

    if (left + menuRect.width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - menuRect.width - viewportPadding;
    }
    if (left < viewportPadding) left = viewportPadding;

    if (top + menuRect.height > window.innerHeight - viewportPadding) {
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        top = rect.top - menuRect.height - 6;
      } else {
        top = y - menuRect.height;
      }
    }
    if (top < viewportPadding) top = viewportPadding;

    els.contextMenu.style.left = `${Math.round(left)}px`;
    els.contextMenu.style.top = `${Math.round(top)}px`;
    els.contextMenu.style.visibility = "";

    const firstItem = els.contextMenu.querySelector(".menu-item:not(:disabled)");
    firstItem?.focus({ preventScroll: true });

    ui.menuOutsideHandler = (event) => {
      if (!els.contextMenu.contains(event.target)) {
        closeContextMenu();
      }
    };
    window.setTimeout(() => {
      if (!els.contextMenu.hidden && ui.menuOutsideHandler) {
        document.addEventListener("pointerdown", ui.menuOutsideHandler, true);
      }
    }, 0);
  }

  function handleMenuKeydown(event) {
    if (els.contextMenu.hidden) return;
    const items = $$(".menu-item:not(:disabled)", els.contextMenu);
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1].focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeContextMenu({ restoreFocus: true });
    } else if (event.key === "Tab") {
      closeContextMenu();
    }
  }

  function handleMenuClick(event) {
    const button = event.target.closest("[data-menu-index]");
    if (!button || !els.contextMenu.contains(button)) return;
    const index = Number(button.dataset.menuIndex);
    const item = ui.menuItems[index];
    if (!item || item.disabled) return;
    closeContextMenu();
    if (typeof item.action === "function") {
      window.setTimeout(() => item.action(), 0);
    }
  }

  /* --------------------------------------------------------------------------
     Dialogs
     -------------------------------------------------------------------------- */

  function openAppDialog(options = {}) {
    if (!els.appDialog) return;

    const {
      icon = "folder-fill",
      title = "Notes",
      description = "",
      body = "",
      confirmLabel = "OK",
      cancelLabel = "Cancel",
      danger = false,
      confirmHidden = false,
      cancelHidden = false,
      onConfirm = null,
      onCancel = null,
      onOpen = null,
    } = options;

    if (els.appDialog.open) els.appDialog.close();

    ui.dialog = {
      onConfirm,
      onCancel,
      returnFocus: document.activeElement,
    };

    els.appDialogIcon.classList.toggle("is-danger", danger);
    els.appDialogIcon.innerHTML = iconMarkup(icon);
    els.appDialogTitle.textContent = title;
    els.appDialogDescription.textContent = description;
    els.appDialogDescription.hidden = !description;
    els.appDialogBody.innerHTML = body;

    els.appDialogConfirm.textContent = confirmLabel;
    els.appDialogConfirm.className = `button ${danger ? "button-danger" : "button-primary"}`;
    els.appDialogConfirm.hidden = confirmHidden;

    els.appDialogCancel.textContent = cancelLabel;
    els.appDialogCancel.hidden = cancelHidden;

    els.appDialogCancel.onclick = () => {
      const callback = ui.dialog?.onCancel;
      els.appDialog.close();
      if (typeof callback === "function") callback();
    };

    els.appDialogConfirm.onclick = async () => {
      const dialog = ui.dialog;
      if (!dialog || dialog.busy) return;
      dialog.busy = true;
      try {
        const result = dialog.onConfirm
          ? await dialog.onConfirm({
              body: els.appDialogBody,
              dialog: els.appDialog,
              confirmButton: els.appDialogConfirm,
            })
          : true;
        if (result !== false) els.appDialog.close();
      } finally {
        if (ui.dialog) ui.dialog.busy = false;
      }
    };

    els.appDialogForm.onsubmit = (event) => {
      event.preventDefault();
      if (!els.appDialogConfirm.hidden) els.appDialogConfirm.click();
    };

    els.appDialog.showModal();
    els.appDialogBody.scrollTop = 0;

    window.setTimeout(() => {
      const focusTarget =
        els.appDialogBody.querySelector("[autofocus]") ||
        els.appDialogBody.querySelector("input, button, [tabindex]");
      focusTarget?.focus({ preventScroll: true });
      if (focusTarget instanceof HTMLInputElement) focusTarget.select();
      if (typeof onOpen === "function") onOpen(els.appDialogBody, els.appDialog);
    }, 40);
  }

  function handleDialogClosed() {
    const returnFocus = ui.dialog?.returnFocus;
    els.appDialogBody.innerHTML = "";
    els.appDialogForm.onsubmit = null;
    els.appDialogConfirm.onclick = null;
    els.appDialogCancel.onclick = null;
    ui.dialog = null;
    if (returnFocus?.isConnected) {
      window.setTimeout(() => returnFocus.focus({ preventScroll: true }), 0);
    }
  }

  /* --------------------------------------------------------------------------
     Format popover
     -------------------------------------------------------------------------- */

  function closeFormatPopover({ restoreFocus = false } = {}) {
    if (!els.formatPopover || els.formatPopover.hidden) return;
    els.formatPopover.hidden = true;
    els.formatBtn.setAttribute("aria-expanded", "false");
    if (restoreFocus) els.formatBtn.focus({ preventScroll: true });
  }

  function openFormatPopover() {
    if (!getSelectedNote() || getSelectedNote()?.deletedAt) return;
    closeContextMenu();
    updateToolbarState();
    els.formatPopover.hidden = false;
    els.formatBtn.setAttribute("aria-expanded", "true");
  }

  function toggleFormatPopover() {
    if (els.formatPopover.hidden) openFormatPopover();
    else closeFormatPopover({ restoreFocus: true });
  }

  /* --------------------------------------------------------------------------
     Folder and note rendering
     -------------------------------------------------------------------------- */

  function sortNotes(notes) {
    const sort = state.preferences.sort;
    return notes.slice().sort((a, b) => {
      if (sort === "title") {
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
      }
      if (sort === "created") return b.createdAt - a.createdAt;
      return b.updatedAt - a.updatedAt;
    });
  }

  function getVisibleNotes() {
    const query = ui.query.trim().toLowerCase();
    let pool;

    if (state.selectedFolderId === "trash") {
      pool = state.notes.filter((note) => Boolean(note.deletedAt));
    } else if (query) {
      pool = state.notes.filter((note) => !note.deletedAt);
    } else if (state.selectedFolderId === "all") {
      pool = state.notes.filter((note) => !note.deletedAt);
    } else {
      pool = state.notes.filter(
        (note) => !note.deletedAt && note.folderId === state.selectedFolderId
      );
    }

    if (query) {
      pool = pool.filter((note) => searchableText(note).includes(query));
    }

    return sortNotes(pool);
  }

  function renderFolders() {
    const allCount = state.notes.filter((note) => !note.deletedAt).length;
    const deletedCount = state.notes.filter((note) => Boolean(note.deletedAt)).length;

    els.allNotesCount.textContent = formatNumber(allCount);
    els.trashCount.textContent = formatNumber(deletedCount);

    els.allNotesRow.classList.toggle("is-active", state.selectedFolderId === "all");
    els.trashRow.classList.toggle("is-active", state.selectedFolderId === "trash");
    els.allNotesRow.setAttribute(
      "aria-current",
      state.selectedFolderId === "all" ? "page" : "false"
    );
    els.trashRow.setAttribute(
      "aria-current",
      state.selectedFolderId === "trash" ? "page" : "false"
    );

    els.folderList.innerHTML = state.folders
      .map((folder) => {
        const isActive = state.selectedFolderId === folder.id;
        const count = activeNotesForFolder(folder.id).length;
        return `<div class="folder-row${isActive ? " is-active" : ""}" role="button" tabindex="0"
          data-folder-id="${escapeAttribute(folder.id)}"
          aria-current="${isActive ? "page" : "false"}"
          title="${escapeAttribute(folder.name)}">
          <span class="folder-glyph">${iconMarkup("folder-fill")}</span>
          <span class="folder-name">${escapeHtml(folder.name)}</span>
          <span class="folder-count">${formatNumber(count)}</span>
          <button class="folder-action" type="button" data-folder-action="menu"
            data-folder-id="${escapeAttribute(folder.id)}"
            aria-label="More actions for ${escapeAttribute(folder.name)}" title="More">
            ${iconMarkup("ellipsis")}
          </button>
        </div>`;
      })
      .join("");
  }

  function noteRowMarkup(note, { focusable = false, showFolder = false } = {}) {
    const selected = note.id === state.selectedNoteId;
    const title = note.title || extractTitle(note.content);
    const titleHtml = highlightText(title, ui.query);
    const snippet = noteSnippet(note);
    const snippetHtml = highlightText(snippet, ui.query);
    const folder = getFolder(note.folderId);
    const folderHtml =
      showFolder && folder
        ? `<span class="note-row-folder">${escapeHtml(folder.name)}</span>`
        : "";
    const isTrash = Boolean(note.deletedAt);

    return `<div class="note-row${selected ? " is-selected" : ""}${note.pinned ? " is-pinned" : ""}"
      data-note-id="${escapeAttribute(note.id)}"
      role="option"
      aria-selected="${selected ? "true" : "false"}"
      tabindex="${selected || focusable ? "0" : "-1"}"
      draggable="${isTrash ? "false" : "true"}"
      title="${escapeAttribute(title)}">
      <div class="note-row-top">
        ${note.pinned ? `<span class="note-row-title-pin">${iconMarkup("pin-filled")}</span>` : ""}
        <span class="note-row-title">${titleHtml}</span>
        <span class="note-row-date" title="${escapeAttribute(formatFullTimestamp(note.updatedAt))}">${formatListDate(note.updatedAt)}</span>
      </div>
      <div class="note-row-bottom">
        <span class="note-row-snippet${snippet === "No additional text" ? " is-empty" : ""}">${snippetHtml}</span>
        ${folderHtml}
      </div>
      ${
        isTrash
          ? ""
          : `<button class="note-row-pin-button${note.pinned ? " is-pinned" : ""}" type="button"
              data-note-action="pin" data-note-id="${escapeAttribute(note.id)}"
              aria-label="${note.pinned ? "Unpin note" : "Pin note"}"
              title="${note.pinned ? "Unpin note" : "Pin note"}">
              ${iconMarkup(note.pinned ? "pin-filled" : "pin")}
            </button>`
      }
    </div>`;
  }

  function sectionHeading(label, icon = "") {
    return `<div class="list-section-heading" role="presentation">
      ${icon ? iconMarkup(icon) : ""}
      <span>${escapeHtml(label)}</span>
    </div>`;
  }

  function emptyNotesMarkup() {
    if (ui.query.trim()) {
      return `<div class="notes-empty">
        <div class="notes-empty-icon">${iconMarkup("search")}</div>
        <h2>No Results</h2>
        <p>No notes match “${escapeHtml(ui.query.trim())}”. Try a different word or search everything again.</p>
        <button class="button" type="button" data-empty-action="clear-search">Clear Search</button>
      </div>`;
    }

    if (state.selectedFolderId === "trash") {
      return `<div class="notes-empty">
        <div class="notes-empty-icon">${iconMarkup("trash")}</div>
        <h2>Recently Deleted is Empty</h2>
        <p>Notes you delete will appear here until you choose to remove them permanently.</p>
      </div>`;
    }

    const folderName =
      state.selectedFolderId === "all"
        ? "All Notes"
        : getFolder(state.selectedFolderId)?.name || "this folder";

    return `<div class="notes-empty">
      <div class="notes-empty-icon">${iconMarkup("note")}</div>
      <h2>No Notes</h2>
      <p>There is nothing in ${escapeHtml(folderName)} yet. Start with a blank page.</p>
      <button class="button" type="button" data-empty-action="new-note">
        ${iconMarkup("plus")} New Note
      </button>
    </div>`;
  }

  function renderNotesHeader(count = 0) {
    let title = "All Notes";
    let subtitle = "On this device";

    if (ui.query.trim()) {
      title = "Search";
      subtitle =
        count > 0
          ? `${pluralize(count, "result")} across all notes`
          : "No results across all notes";
    } else if (state.selectedFolderId === "trash") {
      title = "Recently Deleted";
      subtitle = "Kept until permanently removed";
    } else if (state.selectedFolderId !== "all") {
      const folder = getFolder(state.selectedFolderId);
      title = folder?.name || "Notes";
      subtitle = "On this device";
    }

    els.notesPanelTitle.textContent = title;
    els.notesPanelCount.textContent = formatNumber(count);
    els.notesPanelSubtitle.textContent = subtitle;
    els.notesFooterCount.textContent = pluralize(count, "note");
  }

  function renderNotesList({ preserveScroll = false, scrollToSelected = false } = {}) {
    const previousScroll = els.notesScroll.scrollTop;
    const notes = getVisibleNotes();
    const queryActive = Boolean(ui.query.trim());
    const showFolder = state.selectedFolderId === "all" || queryActive;
    const showPinnedSection =
      state.selectedFolderId !== "trash" && state.preferences.showPinnedSection;

    renderNotesHeader(notes.length);

    if (!notes.length) {
      els.notesList.setAttribute("role", "region");
      els.notesList.innerHTML = emptyNotesMarkup();
      if (!preserveScroll) els.notesScroll.scrollTop = 0;
      return;
    }

    els.notesList.setAttribute("role", "listbox");

    const pinned = showPinnedSection ? notes.filter((note) => note.pinned) : [];
    const regular = showPinnedSection ? notes.filter((note) => !note.pinned) : notes;
    const focusableId = notes.some((note) => note.id === state.selectedNoteId)
      ? state.selectedNoteId
      : notes[0]?.id;

    const parts = [];

    if (pinned.length) {
      parts.push(sectionHeading("Pinned", "pin-filled"));
      parts.push(
        pinned
          .map((note) =>
            noteRowMarkup(note, {
              focusable: note.id === focusableId,
              showFolder,
            })
          )
          .join("")
      );
    }

    if (regular.length) {
      if (state.preferences.sort === "title") {
        parts.push(sectionHeading("Notes"));
        parts.push(
          regular
            .map((note) =>
              noteRowMarkup(note, {
                focusable: note.id === focusableId,
                showFolder,
              })
            )
            .join("")
        );
      } else {
        let currentBucket = "";
        regular.forEach((note) => {
          const date =
            state.preferences.sort === "created" ? note.createdAt : note.updatedAt;
          const bucket = dateBucket(date);
          if (bucket !== currentBucket) {
            currentBucket = bucket;
            parts.push(sectionHeading(bucket));
          }
          parts.push(
            noteRowMarkup(note, {
              focusable: note.id === focusableId,
              showFolder,
            })
          );
        });
      }
    }

    els.notesList.innerHTML = parts.join("");

    if (preserveScroll) {
      els.notesScroll.scrollTop = previousScroll;
    } else {
      els.notesScroll.scrollTop = 0;
    }

    if (scrollToSelected) {
      window.requestAnimationFrame(() => {
        const selectedRow = els.notesList.querySelector(".note-row.is-selected");
        selectedRow?.scrollIntoView({ block: "nearest" });
      });
    }
  }

  function renderEditor({ focusTitle = false, resetScroll = false } = {}) {
    const note = getSelectedNote();
    closeFormatPopover();

    if (!note) {
      els.emptyEditor.hidden = false;
      els.noteEditor.hidden = true;
      els.noteContent.innerHTML = "";
      els.trashBanner.hidden = true;
      document.title = "Notes";
      setSaveState("saved", "Saved");
      return;
    }

    const readOnly = Boolean(note.deletedAt);
    const folder = getFolder(note.folderId);

    els.emptyEditor.hidden = true;
    els.noteEditor.hidden = false;
    els.noteContent.innerHTML = note.content || "<h1><br></h1>";
    els.noteContent.contentEditable = readOnly ? "false" : "true";
    els.noteContent.spellcheck = !readOnly;
    els.noteContent.dataset.noteId = note.id;
    els.trashBanner.hidden = !readOnly;

    const metaBits = [
      folder
        ? `<span class="meta-folder">${iconMarkup("folder-fill")} ${escapeHtml(folder.name)}</span>`
        : "",
      `<span>${readOnly ? `Deleted ${formatCreatedLabel(note.deletedAt)}` : `Created ${formatCreatedLabel(note.createdAt)}`}</span>`,
    ].filter(Boolean);
    els.noteDocumentMeta.innerHTML = metaBits.join('<span class="meta-separator">·</span>');

    const formattingControls = [
      els.formatBtn,
      els.boldBtn,
      els.italicBtn,
      els.underlineBtn,
      els.strikeBtn,
      els.checklistBtn,
      els.bulletsBtn,
      els.numbersBtn,
      els.dashBtn,
      els.pinNoteBtn,
      els.moveNoteBtn,
    ];
    formattingControls.forEach((button) => {
      if (!button) return;
      button.disabled = readOnly;
      button.setAttribute("aria-disabled", String(readOnly));
      button.classList.toggle("is-disabled", readOnly);
    });

    els.pinNoteBtn.setAttribute("aria-pressed", String(Boolean(note.pinned)));
    els.pinNoteBtn.setAttribute(
      "aria-label",
      note.pinned ? "Unpin note" : "Pin note"
    );
    els.pinNoteBtn.title = note.pinned ? "Unpin Note" : "Pin Note";
    els.trashBanner.hidden = !readOnly;

    document.title = `${note.title || "New Note"} — Notes`;
    els.modifiedLabel.title = formatFullTimestamp(note.updatedAt);

    if (readOnly) {
      setSaveState("saved", "Read only");
    } else {
      setSaveState("saved", "Saved");
    }

    updateStats();
    updateToolbarState();

    if (resetScroll) els.editorScroll.scrollTop = 0;

    if (focusTitle) {
      window.requestAnimationFrame(() => {
        const heading = els.noteContent.querySelector("h1");
        els.noteContent.focus({ preventScroll: true });
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        if (heading) {
          range.selectNodeContents(heading);
          range.collapse(false);
        } else {
          range.selectNodeContents(els.noteContent);
          range.collapse(true);
        }
        selection.removeAllRanges();
        selection.addRange(range);
        try {
          document.execCommand("defaultParagraphSeparator", false, "p");
        } catch (_) {
          // Not critical.
        }
      });
    }
  }

  function updateStats() {
    const note = getSelectedNote();
    if (!note) return;

    const text = htmlToText(
      els.noteContent.innerHTML || note.content || ""
    ).replace(/\s+/g, " ").trim();
    const words = countWords(text);
    const characters = text.length;

    els.wordCount.textContent = pluralize(words, "word");
    els.charCount.textContent = pluralize(characters, "character");
    els.modifiedLabel.textContent = formatEditedLabel(note.updatedAt);
    els.modifiedLabel.title = formatFullTimestamp(note.updatedAt);
  }

  /* --------------------------------------------------------------------------
     Selection and toolbar state
     -------------------------------------------------------------------------- */

  function selectionElement() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const node = selection.anchorNode;
    if (!node) return null;
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  }

  function selectionInsideEditor() {
    const anchor = selectionElement();
    return Boolean(anchor && els.noteContent.contains(anchor));
  }

  function currentBlockElement() {
    const anchor = selectionElement();
    if (!anchor || !els.noteContent.contains(anchor)) return null;
    if (anchor === els.noteContent) return els.noteContent;
    const block = anchor.closest("h1, h2, h3, p, pre, blockquote, li, div");
    if (block && block !== els.noteContent && els.noteContent.contains(block)) return block;
    return els.noteContent;
  }

  function currentListElement() {
    const anchor = selectionElement();
    if (!anchor || !els.noteContent.contains(anchor)) return null;
    return anchor.closest("ul, ol");
  }

  function blockStyleFromElement(element) {
    if (!element) return "p";
    const tag = element.tagName?.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "pre") return tag;
    return "p";
  }

  function setPressed(button, pressed) {
    if (!button) return;
    button.setAttribute("aria-pressed", String(Boolean(pressed)));
  }

  function safeQueryCommandState(command) {
    try {
      return document.queryCommandState(command);
    } catch (_) {
      return false;
    }
  }

  function updateToolbarState() {
    const note = getSelectedNote();
    const readOnly = !note || Boolean(note.deletedAt);

    if (readOnly) {
      [
        els.boldBtn,
        els.italicBtn,
        els.underlineBtn,
        els.strikeBtn,
        els.checklistBtn,
        els.bulletsBtn,
        els.numbersBtn,
        els.dashBtn,
        els.popoverBoldBtn,
        els.popoverItalicBtn,
        els.popoverUnderlineBtn,
        els.popoverStrikeBtn,
      ].forEach((button) => setPressed(button, false));
      return;
    }

    const inside = selectionInsideEditor();
    const bold = inside && safeQueryCommandState("bold");
    const italic = inside && safeQueryCommandState("italic");
    const underline = inside && safeQueryCommandState("underline");
    const strike = inside && safeQueryCommandState("strikeThrough");

    [els.boldBtn, els.popoverBoldBtn].forEach((button) => setPressed(button, bold));
    [els.italicBtn, els.popoverItalicBtn].forEach((button) => setPressed(button, italic));
    [els.underlineBtn, els.popoverUnderlineBtn].forEach((button) => setPressed(button, underline));
    [els.strikeBtn, els.popoverStrikeBtn].forEach((button) => setPressed(button, strike));

    const list = currentListElement();
    const isChecklist = Boolean(list?.classList.contains("checklist"));
    const isDashed = Boolean(list?.classList.contains("dashed-list"));
    const isOrdered = list?.tagName === "OL";
    const isBullets = Boolean(list && !isChecklist && !isDashed && !isOrdered);

    setPressed(els.checklistBtn, isChecklist);
    setPressed(els.dashBtn, isDashed);
    setPressed(els.numbersBtn, isOrdered);
    setPressed(els.bulletsBtn, isBullets);

    const activeStyle = blockStyleFromElement(currentBlockElement());
    $$("[data-block-style]", els.formatPopover).forEach((button) => {
      button.classList.toggle("is-active", button.dataset.blockStyle === activeStyle);
    });
  }

  function scheduleToolbarUpdate() {
    if (ui.selectionFrame) cancelAnimationFrame(ui.selectionFrame);
    ui.selectionFrame = requestAnimationFrame(() => {
      ui.selectionFrame = null;
      updateToolbarState();
    });
  }

  /* --------------------------------------------------------------------------
     Folder and note selection
     -------------------------------------------------------------------------- */

  function ensureSelectionVisible() {
    const visible = getVisibleNotes();
    if (!visible.some((note) => note.id === state.selectedNoteId)) {
      state.selectedNoteId = visible[0]?.id || null;
    }
  }

  function closeMobileEditor() {
    ui.mobileEditorOpen = false;
    syncLayout();
  }

  function openMobileEditor() {
    if (!MOBILE_LAYOUT.matches) return;
    ui.mobileEditorOpen = true;
    syncLayout();
  }

  function selectFolder(folderId) {
    if (folderId !== "all" && folderId !== "trash" && !getFolder(folderId)) return;
    flushActiveNote();

    ui.query = "";
    els.searchInput.value = "";
    updateSearchChrome();

    state.selectedFolderId = folderId;
    const pool = getVisibleNotes();
    const remainsVisible = pool.some((note) => note.id === state.selectedNoteId);
    state.selectedNoteId = remainsVisible ? state.selectedNoteId : pool[0]?.id || null;

    ui.mobileEditorOpen = false;
    renderFolders();
    renderNotesList();
    renderEditor({ resetScroll: true });
    syncLayout();
    closeSidebar();
    persistNow({ silent: true });
  }

  function selectNote(noteId, { focusEditor = false, openEditor = true } = {}) {
    const note = getNote(noteId);
    if (!note) return;
    if (note.id !== state.selectedNoteId) flushActiveNote();

    state.selectedNoteId = note.id;
    if (note.deletedAt) state.selectedFolderId = "trash";

    renderNotesList({ preserveScroll: true, scrollToSelected: true });
    renderEditor({ resetScroll: true, focusTitle: focusEditor });
    if (openEditor) openMobileEditor();
    else closeMobileEditor();
    persistNow({ silent: true });
    closeSidebar();
  }

  /* --------------------------------------------------------------------------
     Editor state synchronization
     -------------------------------------------------------------------------- */

  function normalizeEditorChecklists() {
    $$("ul.checklist > li", els.noteContent).forEach((li) => {
      if (!li.hasAttribute("data-checked")) li.setAttribute("data-checked", "false");
    });
  }

  function syncEditorToState() {
    const note = getSelectedNote();
    if (!note || note.deletedAt || els.noteEditor.hidden) return;
    if (!ui.editorDirty) return;

    const rawHtml = els.noteContent.innerHTML;
    note.content = sanitizeNoteHtml(rawHtml);
    note.title = extractTitle(note.content);
    note.updatedAt = Date.now();
    ui.editorDirty = false;
  }

  function handleEditorInput() {
    const note = getSelectedNote();
    if (!note || note.deletedAt) return;

    normalizeEditorChecklists();
    ui.editorDirty = true;
    syncEditorToState();

    const fresh = getSelectedNote();
    if (fresh) {
      document.title = `${fresh.title || "New Note"} — Notes`;
      updateStats();
    }

    queuePersist();
    if (ui.listRenderTimer) clearTimeout(ui.listRenderTimer);
    ui.listRenderTimer = window.setTimeout(() => {
      renderNotesList({ preserveScroll: true });
    }, 180);
  }

  function flushActiveNote() {
    if (!ui.editorDirty) return;
    syncEditorToState();
    if (ui.listRenderTimer) {
      clearTimeout(ui.listRenderTimer);
      ui.listRenderTimer = null;
    }
    persistNow({ silent: true });
  }

  function triggerEditorInput() {
    els.noteContent.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* --------------------------------------------------------------------------
     Editor commands
     -------------------------------------------------------------------------- */

  function activeNoteIsReadOnly() {
    const note = getSelectedNote();
    return !note || Boolean(note.deletedAt);
  }

  function placeCaretAtEnd() {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(els.noteContent);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function ensureEditorSelection() {
    if (activeNoteIsReadOnly()) return false;
    if (!selectionInsideEditor()) {
      els.noteContent.focus({ preventScroll: true });
      placeCaretAtEnd();
    }
    return true;
  }

  function executeInlineCommand(command) {
    if (!ensureEditorSelection()) return;
    els.noteContent.focus({ preventScroll: true });
    try {
      document.execCommand("styleWithCSS", false, false);
      document.execCommand(command, false, null);
    } catch (error) {
      console.warn("Formatting command failed:", command, error);
    }
    updateToolbarState();
    handleEditorInput();
  }

  function applyBlockStyle(style) {
    if (!ensureEditorSelection()) return;
    const allowed = new Set(["h1", "h2", "h3", "p", "pre"]);
    if (!allowed.has(style)) return;

    try {
      document.execCommand("formatBlock", false, `<${style}>`);
    } catch (error) {
      console.warn("Paragraph style failed:", style, error);
    }
    closeFormatPopover();
    updateToolbarState();
    handleEditorInput();
  }

  function caretTextOffset(root, node = null, offset = 0) {
    if (!root) return 0;
    try {
      const range = document.createRange();
      range.selectNodeContents(root);
      if (node && root.contains(node)) range.setEnd(node, offset);
      return range.toString().length;
    } catch (_) {
      return 0;
    }
  }

  function placeCaretAtTextOffset(root, offset) {
    if (!root) return;
    const selection = window.getSelection();
    if (!selection) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, offset);
    let node = walker.nextNode();
    let lastText = null;

    while (node) {
      const length = node.nodeValue?.length || 0;
      if (remaining <= length) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= length;
      lastText = node;
      node = walker.nextNode();
    }

    const range = document.createRange();
    if (lastText) {
      range.setStart(lastText, lastText.nodeValue.length);
      range.collapse(true);
    } else {
      range.selectNodeContents(root);
      range.collapse(root.childNodes.length === 0);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function currentCaretOffset(root) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return caretTextOffset(root);
    return caretTextOffset(root, selection.focusNode, selection.focusOffset);
  }

  function currentCaretListItem() {
    const anchor = selectionElement();
    if (!anchor || !els.noteContent.contains(anchor)) return null;
    return anchor.closest("li");
  }

  function markListItem(li, kind) {
    li.classList.remove("is-checked-item");
    if (kind === "checklist") {
      if (!li.hasAttribute("data-checked")) li.setAttribute("data-checked", "false");
    } else {
      li.removeAttribute("data-checked");
    }
  }

  function createList(kind, li) {
    const list = document.createElement(kind === "numbers" ? "ol" : "ul");
    if (kind === "checklist") list.classList.add("checklist");
    if (kind === "dashed") list.classList.add("dashed-list");
    if (li) list.appendChild(li);
    return list;
  }

  function convertBlockToList(block, kind) {
    if (!block || block === els.noteContent) return false;
    if (!["P", "DIV", "H1", "H2", "H3", "PRE", "BLOCKQUOTE"].includes(block.tagName)) {
      return false;
    }

    const offset = currentCaretOffset(block);
    const li = document.createElement("li");
    while (block.firstChild) li.appendChild(block.firstChild);
    if (!li.textContent && !li.querySelector("br")) li.appendChild(document.createElement("br"));
    markListItem(li, kind);

    const list = createList(kind, li);
    block.replaceWith(list);
    placeCaretAtTextOffset(li, offset);
    return true;
  }

  function retagList(list, kind) {
    const currentLi = currentCaretListItem();
    const offset = currentLi ? currentCaretOffset(currentLi) : 0;
    const replacement = createList(kind);

    $$(":scope > li", list).forEach((li) => {
      markListItem(li, kind);
      replacement.appendChild(li);
    });

    if (!replacement.children.length) {
      const li = document.createElement("li");
      li.appendChild(document.createElement("br"));
      markListItem(li, kind);
      replacement.appendChild(li);
    }

    list.replaceWith(replacement);

    const targetItem =
      currentLi && replacement.contains(currentLi)
        ? currentLi
        : replacement.children[0];
    placeCaretAtTextOffset(targetItem, offset);
    return true;
  }

  function unmakeList(list) {
    const currentLi = currentCaretListItem();
    const offset = currentLi ? currentCaretOffset(currentLi) : 0;
    const items = $$(":scope > li", list);
    const currentIndex = Math.max(0, items.indexOf(currentLi));
    const paragraphs = items.map((li) => {
      const paragraph = document.createElement("p");
      while (li.firstChild) paragraph.appendChild(li.firstChild);
      if (!paragraph.textContent && !paragraph.querySelector("br")) {
        paragraph.appendChild(document.createElement("br"));
      }
      return paragraph;
    });

    if (!paragraphs.length) {
      const paragraph = document.createElement("p");
      paragraph.appendChild(document.createElement("br"));
      paragraphs.push(paragraph);
    }

    list.replaceWith(...paragraphs);
    placeCaretAtTextOffset(paragraphs[Math.min(currentIndex, paragraphs.length - 1)], offset);
    return true;
  }

  function listKind(list) {
    if (!list) return null;
    if (list.tagName === "OL") return "numbers";
    if (list.classList.contains("checklist")) return "checklist";
    if (list.classList.contains("dashed-list")) return "dashed";
    return "bullets";
  }

  function toggleList(kind) {
    if (!ensureEditorSelection()) return;
    const list = currentListElement();

    if (list) {
      if (listKind(list) === kind) {
        unmakeList(list);
      } else {
        retagList(list, kind);
      }
    } else {
      const block = currentBlockElement();
      if (!block || !convertBlockToList(block, kind)) return;
    }

    updateToolbarState();
    handleEditorInput();
  }

  function currentChecklistItem() {
    const anchor = selectionElement();
    if (!anchor || !els.noteContent.contains(anchor)) return null;
    const item = anchor.closest("ul.checklist > li");
    return item && els.noteContent.contains(item) ? item : null;
  }

  function toggleChecklistItem(item) {
    if (!item || activeNoteIsReadOnly()) return;
    const next = item.getAttribute("data-checked") !== "true";
    item.setAttribute("data-checked", String(next));
    handleEditorInput();
  }

  function handleChecklistEnter(item) {
    if (!item) return false;
    const list = item.closest("ul.checklist");
    if (!list) return false;

    const text = normalizeSpaces(item.textContent);
    if (text) {
      window.requestAnimationFrame(() => {
        const current = currentChecklistItem();
        if (current && current !== item && !normalizeSpaces(current.textContent)) {
          current.setAttribute("data-checked", "false");
        }
      });
      return false;
    }

    const items = Array.from(list.children).filter((child) => child.tagName === "LI");
    if (item !== items[items.length - 1]) return false;

    const paragraph = document.createElement("p");
    paragraph.appendChild(document.createElement("br"));

    if (items.length === 1) {
      list.replaceWith(paragraph);
    } else {
      item.remove();
      list.after(paragraph);
    }

    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.setStart(paragraph, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    handleEditorInput();
    return true;
  }

  function handleTitleEnter(event) {
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
    const block = currentBlockElement();
    if (!block || block.tagName !== "H1" || block !== els.noteContent.firstElementChild) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0);

    event.preventDefault();
    if (!selection.isCollapsed) range.deleteContents();

    const paragraph = document.createElement("p");
    const after = document.createRange();
    after.selectNodeContents(block);
    try {
      after.setStart(range.endContainer, range.endOffset);
    } catch (_) {
      after.setStart(block, block.childNodes.length);
    }
    after.setEnd(block, block.childNodes.length);
    const fragment = after.extractContents();
    if (fragment.textContent || fragment.querySelector?.("br, *")) {
      paragraph.appendChild(fragment);
    }
    if (!paragraph.textContent && !paragraph.querySelector("br")) {
      paragraph.appendChild(document.createElement("br"));
    }

    block.after(paragraph);

    const nextRange = document.createRange();
    nextRange.setStart(paragraph, 0);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    handleEditorInput();
    return true;
  }

  function handleEditorKeydown(event) {
    if (event.key === "Enter" && !event.isComposing) {
      const checklistItem = currentChecklistItem();
      if (checklistItem && handleChecklistEnter(checklistItem)) {
        event.preventDefault();
        return;
      }

      if (handleTitleEnter(event)) return;
    }

    if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const list = currentListElement();
      if (list) {
        event.preventDefault();
        try {
          document.execCommand(event.shiftKey ? "outdent" : "indent", false, null);
        } catch (_) {
          // Ignore unsupported indentation.
        }
        handleEditorInput();
      }
    }
  }

  function handleEditorPointerDown(event) {
    if (event.button !== 0 || activeNoteIsReadOnly()) return;
    const item = event.target.closest?.("ul.checklist > li");
    if (!item || !els.noteContent.contains(item)) return;
    const rect = item.getBoundingClientRect();
    if (event.clientX - rect.left <= 30) {
      event.preventDefault();
      toggleChecklistItem(item);
    }
  }

  function handleEditorPaste(event) {
    if (activeNoteIsReadOnly()) return;
    const text = event.clipboardData?.getData("text/plain");
    if (typeof text !== "string") return;
    event.preventDefault();
    if (!selectionInsideEditor()) {
      els.noteContent.focus({ preventScroll: true });
      placeCaretAtEnd();
    }
    try {
      document.execCommand("insertText", false, text);
    } catch (_) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
      }
    }
    handleEditorInput();
  }

  /* --------------------------------------------------------------------------
     Search
     -------------------------------------------------------------------------- */

  function updateSearchChrome() {
    const hasQuery = Boolean(els.searchInput.value.trim());
    els.searchClearBtn.hidden = !hasQuery;
    els.searchInput.closest(".search-field")?.classList.toggle("has-query", hasQuery);
  }

  function handleSearchInput() {
    ui.query = els.searchInput.value;
    updateSearchChrome();

    const results = getVisibleNotes();
    if (ui.query.trim()) {
      const current = getNote(state.selectedNoteId);
      const currentInResults = results.some((note) => note.id === state.selectedNoteId);
      if (!currentInResults && results[0]) {
        state.selectedNoteId = results[0].id;
        renderEditor({ resetScroll: true });
      } else if (!results.length && current?.deletedAt && state.selectedFolderId !== "trash") {
        // Keep the current note open when a search has no matches.
      }
    } else if (!results.some((note) => note.id === state.selectedNoteId)) {
      state.selectedNoteId = results[0]?.id || null;
      renderEditor({ resetScroll: true });
    }

    renderNotesList({ resetScroll: true });
    persistNow({ silent: true });
  }

  function clearSearch({ focus = true } = {}) {
    els.searchInput.value = "";
    ui.query = "";
    updateSearchChrome();
    const results = getVisibleNotes();
    if (!results.some((note) => note.id === state.selectedNoteId)) {
      state.selectedNoteId = results[0]?.id || null;
      renderEditor({ resetScroll: true });
    }
    renderNotesList({ resetScroll: true });
    persistNow({ silent: true });
    if (focus) els.searchInput.focus({ preventScroll: true });
  }

  /* --------------------------------------------------------------------------
     Note actions
     -------------------------------------------------------------------------- */

  function updatePinButton(note) {
    if (!note) return;
    els.pinNoteBtn.setAttribute("aria-pressed", String(Boolean(note.pinned)));
    els.pinNoteBtn.setAttribute(
      "aria-label",
      note.pinned ? "Unpin note" : "Pin note"
    );
    els.pinNoteBtn.title = note.pinned ? "Unpin Note" : "Pin Note";
  }

  function togglePin(noteId) {
    const note = getNote(noteId);
    if (!note || note.deletedAt) return;
    flushActiveNote();
    note.pinned = !note.pinned;
    note.pinnedAt = note.pinned ? Date.now() : null;
    persistNow({ silent: true });
    if (note.id === state.selectedNoteId) updatePinButton(note);
    renderNotesList({ preserveScroll: true, scrollToSelected: true });
    renderFolders();
  }

  function openMoveDialog(note) {
    if (!note || note.deletedAt) return;
    const choices = state.folders
      .map((folder) => {
        const current = folder.id === note.folderId;
        return `<button class="folder-choice${current ? " is-current" : ""}" type="button"
          data-move-to="${escapeAttribute(folder.id)}">
          <span class="folder-glyph">${iconMarkup("folder-fill")}</span>
          <span class="folder-choice-name">${escapeHtml(folder.name)}</span>
          ${iconMarkup("check", "icon folder-choice-check")}
        </button>`;
      })
      .join("");

    openAppDialog({
      icon: "move",
      title: "Move Note",
      description: `Choose a folder for “${note.title || "New Note"}”.`,
      body: `<div class="folder-choice-list">${choices}</div>`,
      confirmHidden: true,
      cancelLabel: "Cancel",
      onOpen: (body, dialog) => {
        $$("[data-move-to]", body).forEach((button) => {
          button.addEventListener("click", () => {
            const folderId = button.dataset.moveTo;
            dialog.close();
            moveNote(note.id, folderId);
          });
        });
      },
    });
  }

  function moveNote(noteId, folderId) {
    const note = getNote(noteId);
    const folder = getFolder(folderId);
    if (!note || note.deletedAt || !folder) return;
    if (note.folderId === folderId) {
      closeSidebar();
      return;
    }

    flushActiveNote();
    const wasSelected = note.id === state.selectedNoteId;
    note.folderId = folderId;

    const noteStillVisible =
      state.selectedFolderId === "all" ||
      state.selectedFolderId === "trash" ||
      state.selectedFolderId === folderId;

    if (!noteStillVisible) ensureSelectionVisible();

    persistNow({ silent: true });
    renderFolders();
    renderNotesList({ preserveScroll: true, scrollToSelected: true });
    if (!noteStillVisible || wasSelected) {
      renderEditor({ resetScroll: true });
    }
    if (MOBILE_LAYOUT.matches && !noteStillVisible) closeMobileEditor();
    showToast(`Moved to ${folder.name}`, { icon: "move", duration: 2800 });
    closeSidebar();
  }

  function duplicateNote(noteId) {
    const source = getNote(noteId);
    if (!source) return;
    flushActiveNote();

    const wrapper = document.createElement("div");
    wrapper.innerHTML = sanitizeNoteHtml(source.content);
    const firstBlock = wrapper.querySelector("h1, h2, h3, p, pre, blockquote, li");
    if (firstBlock) {
      const text = normalizeSpaces(firstBlock.textContent);
      firstBlock.textContent = text ? `${text} copy` : "Untitled copy";
    }

    const copyContent = sanitizeNoteHtml(wrapper.innerHTML || "<h1>Untitled copy</h1>");
    const now = Date.now();
    const copy = {
      id: uid("note"),
      folderId: source.folderId,
      title: extractTitle(copyContent),
      content: copyContent,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      pinnedAt: null,
      deletedAt: null,
    };

    state.notes.push(copy);
    ui.query = "";
    els.searchInput.value = "";
    updateSearchChrome();
    state.selectedNoteId = copy.id;
    if (state.selectedFolderId === "trash") state.selectedFolderId = "all";

    renderFolders();
    renderNotesList({ scrollToSelected: true });
    renderEditor({ resetScroll: true });
    openMobileEditor();
    persistNow({ silent: true });
    showToast("Note duplicated", { icon: "copy", duration: 2500 });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch (_) {
        copied = false;
      }
      textarea.remove();
      return copied;
    }
  }

  async function shareNote(noteId) {
    const note = getNote(noteId);
    if (!note) return;
    const text = `${note.title || "New Note"}\n\n${htmlToText(note.content)}`.trim();

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: note.title || "New Note", text });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const copied = await copyText(text);
    showToast(copied ? "Note copied to clipboard" : "The note could not be copied.", {
      icon: copied ? "copy" : "info",
      duration: 2800,
    });
  }

  function trashNote(noteId) {
    const note = getNote(noteId);
    if (!note) return;
    if (note.deletedAt) {
      confirmDeleteForever(noteId);
      return;
    }

    flushActiveNote();
    const previousPinned = note.pinned;
    const previousPinnedAt = note.pinnedAt;
    const title = note.title || "Note";

    note.deletedAt = Date.now();
    note.pinned = false;
    note.pinnedAt = null;

    ensureSelectionVisible();
    persistNow({ silent: true });
    renderFolders();
    renderNotesList({ preserveScroll: true, scrollToSelected: true });
    renderEditor({ resetScroll: true });

    showToast(`“${title}” moved to Recently Deleted`, {
      icon: "trash",
      actionLabel: "Undo",
      duration: 5600,
      onAction: () => {
        const target = getNote(noteId);
        if (!target) return;
        target.deletedAt = null;
        target.pinned = previousPinned;
        target.pinnedAt = previousPinnedAt;
        if (!getFolder(target.folderId)) target.folderId = getDefaultFolder().id;
        if (state.selectedFolderId === "trash") state.selectedFolderId = "all";
        state.selectedNoteId = target.id;
        ensureSelectionVisible();
        persistNow({ silent: true });
        renderFolders();
        renderNotesList({ scrollToSelected: true });
        renderEditor({ resetScroll: true });
        showToast("Note restored", { icon: "restore", duration: 2200 });
      },
    });
  }

  function confirmDeleteForever(noteId) {
    const note = getNote(noteId);
    if (!note) return;
    openAppDialog({
      icon: "trash",
      danger: true,
      title: "Delete Permanently?",
      description: "This note will be removed from this device. This cannot be undone.",
      body: `<div class="about-feature-row">${iconMarkup("note")}<span><strong>${escapeHtml(note.title || "New Note")}</strong><br>Deleted notes are not uploaded anywhere.</span></div>`,
      confirmLabel: "Delete Note",
      onConfirm: () => {
        state.notes = state.notes.filter((item) => item.id !== noteId);
        if (state.selectedNoteId === noteId) state.selectedNoteId = null;
        ensureSelectionVisible();
        persistNow({ silent: true });
        renderFolders();
        renderNotesList({ scrollToSelected: true });
        renderEditor({ resetScroll: true });
        showToast("Note deleted permanently", { icon: "trash", duration: 3000 });
      },
    });
  }

  function restoreNote(noteId) {
    const note = getNote(noteId);
    if (!note || !note.deletedAt) return;
    flushActiveNote();
    if (!getFolder(note.folderId)) note.folderId = getDefaultFolder().id;
    note.deletedAt = null;
    note.pinned = false;
    note.pinnedAt = null;
    ensureSelectionVisible();
    persistNow({ silent: true });
    renderFolders();
    renderNotesList({ preserveScroll: true, scrollToSelected: true });
    renderEditor({ resetScroll: true });
    showToast(`“${note.title || "Note"}” restored`, {
      icon: "restore",
      actionLabel: "Show",
      duration: 4200,
      onAction: () => {
        state.selectedFolderId = "all";
        state.selectedNoteId = note.id;
        renderFolders();
        renderNotesList({ scrollToSelected: true });
        renderEditor({ resetScroll: true });
        persistNow({ silent: true });
      },
    });
  }

  function confirmEmptyTrash() {
    const count = trashNotes().length;
    if (!count) return;
    openAppDialog({
      icon: "trash",
      danger: true,
      title: "Empty Recently Deleted?",
      description: `${pluralize(count, "note")} will be removed from this device permanently. This cannot be undone.`,
      confirmLabel: "Empty Trash",
      onConfirm: () => {
        state.notes = state.notes.filter((note) => !note.deletedAt);
        if (!getNote(state.selectedNoteId)) state.selectedNoteId = null;
        ensureSelectionVisible();
        persistNow({ silent: true });
        renderFolders();
        renderNotesList();
        renderEditor({ resetScroll: true });
        showToast("Recently Deleted emptied", { icon: "trash", duration: 2600 });
      },
    });
  }

  /* --------------------------------------------------------------------------
     Folder actions
     -------------------------------------------------------------------------- */

  function openFolderDialog({ folder = null } = {}) {
    const renaming = Boolean(folder);
    const initialValue = folder?.name || "";

    openAppDialog({
      icon: "folder-fill",
      title: renaming ? "Rename Folder" : "New Folder",
      description: renaming
        ? "Give this folder a new name. Notes inside stay where they are."
        : "Folders keep related notes together.",
      body: `<label class="dialog-field">
        <span>Folder name</span>
        <input class="dialog-input" id="folderNameInput" type="text" maxlength="60"
          autocomplete="off" spellcheck="false" value="${escapeAttribute(initialValue)}"
          placeholder="e.g. Projects" autofocus>
      </label>
      <p class="dialog-error" id="folderDialogError" hidden></p>`,
      confirmLabel: renaming ? "Rename" : "Create",
      onOpen: (body) => {
        const input = $("#folderNameInput", body);
        input?.focus();
        input?.select();
        input?.addEventListener("input", () => {
          input.classList.remove("has-error");
          const error = $("#folderDialogError", body);
          if (error) error.hidden = true;
        });
      },
      onConfirm: ({ body }) => {
        const input = $("#folderNameInput", body);
        const error = $("#folderDialogError", body);
        const name = normalizeSpaces(input?.value);
        const duplicate = state.folders.some(
          (item) =>
            item.id !== folder?.id &&
            item.name.toLocaleLowerCase() === name.toLocaleLowerCase()
        );

        if (!name) {
          if (input) input.classList.add("has-error");
          if (error) {
            error.textContent = "Enter a name for this folder.";
            error.hidden = false;
          }
          input?.focus();
          return false;
        }

        if (duplicate) {
          if (input) input.classList.add("has-error");
          if (error) {
            error.textContent = "A folder with that name already exists.";
            error.hidden = false;
          }
          input?.focus();
          return false;
        }

        flushActiveNote();

        if (renaming) {
          folder.name = name;
          renderFolders();
          renderNotesList({ preserveScroll: true });
          renderEditor();
          showToast("Folder renamed", { icon: "folder", duration: 2300 });
        } else {
          const newFolder = {
            id: uid("folder"),
            name,
            createdAt: Date.now(),
          };
          state.folders.push(newFolder);
          state.selectedFolderId = newFolder.id;
          state.selectedNoteId = null;
          ui.query = "";
          els.searchInput.value = "";
          updateSearchChrome();
          ui.mobileEditorOpen = false;
          renderFolders();
          renderNotesList();
          renderEditor({ resetScroll: true });
          syncLayout();
          showToast("Folder created", { icon: "folder", duration: 2300 });
        }

        persistNow({ silent: true });
        closeSidebar();
        return true;
      },
    });
  }

  function deleteFolder(folder) {
    if (!folder) return;
    const count = activeNotesForFolder(folder.id).length;
    openAppDialog({
      icon: "trash",
      danger: true,
      title: `Delete “${folder.name}”?`,
      description: count
        ? `${pluralize(count, "note")} inside this folder will be moved to Recently Deleted. The folder itself will be removed.`
        : "This empty folder will be removed.",
      confirmLabel: "Delete Folder",
      onConfirm: () => {
        flushActiveNote();
        const now = Date.now();
        state.notes.forEach((note) => {
          if (!note.deletedAt && note.folderId === folder.id) {
            note.deletedAt = now;
            note.pinned = false;
            note.pinnedAt = null;
          }
        });
        state.folders = state.folders.filter((item) => item.id !== folder.id);
        ensureFolderExists();
        if (state.selectedFolderId === folder.id) state.selectedFolderId = "all";
        ensureSelectionVisible();
        persistNow({ silent: true });
        renderFolders();
        renderNotesList();
        renderEditor({ resetScroll: true });
        closeSidebar();
        showToast(
          count
            ? `Folder deleted · ${pluralize(count, "note")} moved to Recently Deleted`
            : "Folder deleted",
          {
            icon: "trash",
            actionLabel: "View Trash",
            duration: 5000,
            onAction: () => selectFolder("trash"),
          }
        );
      },
    });
  }

  /* --------------------------------------------------------------------------
     New note
     -------------------------------------------------------------------------- */

  function createNote(folderId = null) {
    flushActiveNote();
    ensureFolderExists();

    let targetFolder = folderId ? getFolder(folderId) : null;

    if (!targetFolder) {
      if (state.selectedFolderId !== "all" && state.selectedFolderId !== "trash") {
        targetFolder = getFolder(state.selectedFolderId);
      }
      if (!targetFolder) targetFolder = getDefaultFolder();
    }

    if (!targetFolder) return;

    if (folderId) {
      state.selectedFolderId = targetFolder.id;
    } else if (state.selectedFolderId === "trash") {
      state.selectedFolderId = "all";
    }

    const now = Date.now();
    const note = {
      id: uid("note"),
      folderId: targetFolder.id,
      title: "New Note",
      content: "<h1><br></h1>",
      createdAt: now,
      updatedAt: now,
      pinned: false,
      pinnedAt: null,
      deletedAt: null,
    };

    state.notes.push(note);
    state.selectedNoteId = note.id;
    ui.query = "";
    els.searchInput.value = "";
    updateSearchChrome();
    ui.mobileEditorOpen = true;

    persistNow({ silent: true });
    renderFolders();
    renderNotesList({ scrollToSelected: true });
    renderEditor({ resetScroll: true, focusTitle: true });
    syncLayout();
    closeSidebar();
  }

  /* --------------------------------------------------------------------------
     Menus
     -------------------------------------------------------------------------- */

  function openNoteMenu(note, { x = 0, y = 0, anchor = null } = {}) {
    if (!note) return;
    const openMenu = (items) => openContextMenu({ x, y, anchor, align: "right", items });

    if (note.deletedAt) {
      openMenu([
        { heading: note.title || "Note" },
        { icon: "restore", label: "Restore Note", action: () => restoreNote(note.id) },
        { icon: "share", label: "Share", action: () => shareNote(note.id) },
        { separator: true },
        {
          icon: "trash",
          label: "Delete Permanently",
          danger: true,
          action: () => confirmDeleteForever(note.id),
        },
      ]);
      return;
    }

    openMenu([
      { heading: note.title || "Note" },
      {
        icon: note.pinned ? "pin-filled" : "pin",
        label: note.pinned ? "Unpin Note" : "Pin Note",
        action: () => togglePin(note.id),
      },
      { icon: "move", label: "Move to Folder…", action: () => openMoveDialog(note) },
      { icon: "copy", label: "Duplicate", action: () => duplicateNote(note.id) },
      { icon: "share", label: "Share", action: () => shareNote(note.id) },
      { separator: true },
      { icon: "trash", label: "Delete Note", danger: true, action: () => trashNote(note.id) },
    ]);
  }

  function openSelectedNoteMenu(anchor) {
    const note = getSelectedNote();
    if (!note) return;
    openNoteMenu(note, { anchor });
  }

  function openFolderMenu(folder, { x = 0, y = 0, anchor = null } = {}) {
    if (!folder) return;
    openContextMenu({
      x,
      y,
      anchor,
      align: "right",
      items: [
        { heading: folder.name },
        { icon: "compose", label: "New Note in Folder", action: () => createNote(folder.id) },
        { icon: "pencil", label: "Rename Folder…", action: () => openFolderDialog({ folder }) },
        { separator: true },
        {
          icon: "trash",
          label: "Delete Folder",
          danger: true,
          action: () => deleteFolder(folder),
        },
      ],
    });
  }

  function openTrashMenu({ anchor = null, x = 0, y = 0 } = {}) {
    openContextMenu({
      x,
      y,
      anchor,
      align: "right",
      items: [
        { heading: "Recently Deleted" },
        {
          icon: "trash",
          label: "Empty Recently Deleted",
          danger: true,
          disabled: !trashNotes().length,
          action: confirmEmptyTrash,
        },
      ],
    });
  }

  function openViewOptionsMenu(anchor) {
    const setSort = (sort) => {
      state.preferences.sort = sort;
      persistNow({ silent: true });
      renderNotesList({ resetScroll: true });
    };

    openContextMenu({
      anchor,
      align: "right",
      prefer: "below",
      items: [
        { heading: "Sort Notes" },
        {
          label: "Date Edited",
          checked: state.preferences.sort === "modified",
          action: () => setSort("modified"),
        },
        {
          label: "Date Created",
          checked: state.preferences.sort === "created",
          action: () => setSort("created"),
        },
        {
          label: "Title",
          checked: state.preferences.sort === "title",
          action: () => setSort("title"),
        },
        { separator: true },
        {
          icon: state.preferences.showPinnedSection ? "pin-filled" : "pin",
          label: state.preferences.showPinnedSection
            ? "Hide Pinned Section"
            : "Show Pinned Section",
          action: () => {
            state.preferences.showPinnedSection = !state.preferences.showPinnedSection;
            persistNow({ silent: true });
            renderNotesList({ preserveScroll: true, scrollToSelected: true });
          },
        },
        { icon: "folder", label: "New Folder…", action: () => openFolderDialog() },
        ...(trashNotes().length
          ? [
              { separator: true },
              {
                icon: "trash",
                label: "Empty Recently Deleted",
                danger: true,
                action: confirmEmptyTrash,
              },
            ]
          : []),
      ],
    });
  }

  /* --------------------------------------------------------------------------
     Info dialogs
     -------------------------------------------------------------------------- */

  function shortcutRow(keys, label) {
    const keyMarkup = keys
      .map((key) => `<kbd>${escapeHtml(key)}</kbd>`)
      .join("");
    return `<div class="shortcut-row"><span>${escapeHtml(label)}</span><span class="shortcut-keys">${keyMarkup}</span></div>`;
  }

  function openShortcutsDialog() {
    openAppDialog({
      icon: "keyboard",
      title: "Keyboard Shortcuts",
      description: "A few shortcuts make Notes feel at home on Windows.",
      cancelLabel: "Done",
      confirmHidden: true,
      body: `<div class="shortcut-groups">
        <section>
          <p class="shortcut-group-title">Notes</p>
          ${shortcutRow(["Ctrl", "N"], "New note")}
          ${shortcutRow(["Ctrl", "Shift", "N"], "New folder")}
          ${shortcutRow(["Ctrl", "K"], "Search all notes")}
          ${shortcutRow(["Ctrl", "S"], "Save now")}
          ${shortcutRow(["Esc"], "Close menus or search")}
        </section>
        <section>
          <p class="shortcut-group-title">Writing</p>
          ${shortcutRow(["Ctrl", "B"], "Bold")}
          ${shortcutRow(["Ctrl", "I"], "Italic")}
          ${shortcutRow(["Ctrl", "U"], "Underline")}
          ${shortcutRow(["Ctrl", "Shift", "X"], "Strikethrough")}
          ${shortcutRow(["Ctrl", "Shift", "L"], "Checklist")}
          ${shortcutRow(["Tab"], "Indent list item")}
        </section>
        <section>
          <p class="shortcut-group-title">Paragraph styles</p>
          ${shortcutRow(["Ctrl", "Alt", "1"], "Title")}
          ${shortcutRow(["Ctrl", "Alt", "2"], "Heading")}
          ${shortcutRow(["Ctrl", "Alt", "3"], "Subheading")}
          ${shortcutRow(["Ctrl", "Alt", "4"], "Body")}
          ${shortcutRow(["Ctrl", "Alt", "5"], "Monospaced")}
        </section>
      </div>`,
    });
  }

  function openAboutDialog() {
    openAppDialog({
      icon: "notes",
      title: "About Notes",
      description: "A faithful local-first notebook for Windows.",
      cancelLabel: "Close",
      confirmHidden: true,
      body: `<div class="about-copy">
        <div class="about-feature-row">
          ${iconMarkup("lock")}
          <span><strong>Private by design.</strong><br>Your folders and notes stay in this browser's local storage. Nothing is uploaded.</span>
        </div>
        <div class="about-feature-row">
          ${iconMarkup("download")}
          <span><strong>Built to be installed.</strong><br>Install Notes from Chrome to launch it in its own window and keep writing offline.</span>
        </div>
        <p><strong>Notes PWA</strong> · Version 1.0 · Rich text, checklists, pinned notes, folders, search, and automatic saving.</p>
        <p style="color: var(--text-tertiary)">Designed as a loving tribute to Apple Notes. Not affiliated with Apple Inc.</p>
      </div>`,
    });
  }

  /* --------------------------------------------------------------------------
     Drag and drop
     -------------------------------------------------------------------------- */

  function clearDropTargets() {
    $$(".is-drop-target", els.appWindow).forEach((element) => {
      element.classList.remove("is-drop-target");
    });
  }

  function handleDragStart(event) {
    const row = event.target.closest?.(".note-row");
    if (!row || row.getAttribute("draggable") === "false") return;
    if (event.target.closest(".note-row-pin-button")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-notes-note", row.dataset.noteId);
    event.dataTransfer.setData("text/plain", row.dataset.noteId);
    row.classList.add("is-dragging");
  }

  function handleDragEnd(event) {
    event.target.closest?.(".note-row")?.classList.remove("is-dragging");
    clearDropTargets();
  }

  function handleFolderDragOver(event) {
    const target = event.target.closest?.("[data-folder-id], [data-smart-folder='trash']");
    if (!target) return;
    if (target.matches("[data-smart-folder='all']")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearDropTargets();
    target.classList.add("is-drop-target");
  }

  function handleFolderDragLeave(event) {
    const target = event.target.closest?.("[data-folder-id], [data-smart-folder='trash']");
    if (!target) return;
    if (event.relatedTarget && target.contains(event.relatedTarget)) return;
    target.classList.remove("is-drop-target");
  }

  function handleFolderDrop(event) {
    const target = event.target.closest?.("[data-folder-id], [data-smart-folder='trash']");
    if (!target) return;
    const noteId =
      event.dataTransfer.getData("application/x-notes-note") ||
      event.dataTransfer.getData("text/plain");
    if (!noteId) return;
    event.preventDefault();
    clearDropTargets();

    if (target.matches("[data-smart-folder='trash']")) {
      trashNote(noteId);
      return;
    }

    const folderId = target.dataset.folderId;
    if (folderId) moveNote(noteId, folderId);
  }

  /* --------------------------------------------------------------------------
     List interactions
     -------------------------------------------------------------------------- */

  function handleNotesListClick(event) {
    const emptyAction = event.target.closest("[data-empty-action]");
    if (emptyAction) {
      if (emptyAction.dataset.emptyAction === "clear-search") clearSearch();
      if (emptyAction.dataset.emptyAction === "new-note") createNote();
      return;
    }

    const pinButton = event.target.closest("[data-note-action='pin']");
    if (pinButton) {
      event.stopPropagation();
      togglePin(pinButton.dataset.noteId);
      return;
    }

    const row = event.target.closest(".note-row");
    if (row) selectNote(row.dataset.noteId);
  }

  function handleNotesListContextMenu(event) {
    const row = event.target.closest(".note-row");
    if (!row) return;
    event.preventDefault();
    const note = getNote(row.dataset.noteId);
    if (!note) return;
    if (state.selectedNoteId !== note.id) {
      selectNote(note.id, { openEditor: false });
    }
    openNoteMenu(note, { x: event.clientX, y: event.clientY });
  }

  function focusNoteRow(noteId) {
    window.requestAnimationFrame(() => {
      const row = $(`.note-row[data-note-id="${CSS.escape(noteId)}"]`, els.notesList);
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: "nearest" });
    });
  }

  function handleNotesListKeydown(event) {
    const row = event.target.closest(".note-row");
    if (!row || event.target !== row) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectNote(row.dataset.noteId);
      focusNoteRow(row.dataset.noteId);
      return;
    }

    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const rows = $$(".note-row", els.notesList);
      const index = rows.indexOf(row);
      let nextIndex = index;
      if (event.key === "ArrowDown") nextIndex = Math.min(rows.length - 1, index + 1);
      if (event.key === "ArrowUp") nextIndex = Math.max(0, index - 1);
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = rows.length - 1;
      const next = rows[nextIndex];
      if (!next || next === row) return;
      selectNote(next.dataset.noteId);
      focusNoteRow(next.dataset.noteId);
      return;
    }

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const rect = row.getBoundingClientRect();
      const note = getNote(row.dataset.noteId);
      if (note) openNoteMenu(note, { x: rect.left + 24, y: rect.top + 18 });
    }
  }

  function handleFolderNavClick(event) {
    const action = event.target.closest("[data-folder-action='menu']");
    if (action) {
      event.stopPropagation();
      const folder = getFolder(action.dataset.folderId);
      if (folder) openFolderMenu(folder, { anchor: action });
      return;
    }

    const smart = event.target.closest("[data-smart-folder]");
    if (smart) {
      selectFolder(smart.dataset.smartFolder);
      return;
    }

    const row = event.target.closest("[data-folder-id]");
    if (row) selectFolder(row.dataset.folderId);
  }

  function handleFolderNavKeydown(event) {
    if (event.target.closest(".folder-action")) return;
    const row = event.target.closest(".folder-row[data-folder-id]");
    if (!row) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectFolder(row.dataset.folderId);
    }
  }

  function handleFolderNavContextMenu(event) {
    const trash = event.target.closest("[data-smart-folder='trash']");
    if (trash) {
      event.preventDefault();
      openTrashMenu({ x: event.clientX, y: event.clientY });
      return;
    }

    const row = event.target.closest("[data-folder-id]");
    if (!row) return;
    event.preventDefault();
    const folder = getFolder(row.dataset.folderId);
    if (folder) openFolderMenu(folder, { x: event.clientX, y: event.clientY });
  }

  /* --------------------------------------------------------------------------
     Global interaction handlers
     -------------------------------------------------------------------------- */

  function handleDocumentPointerDown(event) {
    const target = event.target;
    if (
      !els.formatPopover.hidden &&
      !els.formatPopover.contains(target) &&
      !els.formatBtn.contains(target)
    ) {
      closeFormatPopover();
    }

    if (
      NARROW_SIDEBAR.matches &&
      ui.sidebarOpen &&
      !els.sidebar.contains(target) &&
      !els.sidebarToggleBtn.contains(target)
    ) {
      closeSidebar();
    }
  }

  function handleGlobalKeydown(event) {
    if (els.appDialog.open) return;

    const target = event.target;
    const inEditor =
      target === els.noteContent || els.noteContent.contains(target);
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (event.key === "Escape") {
      if (!els.contextMenu.hidden) {
        event.preventDefault();
        closeContextMenu({ restoreFocus: true });
        return;
      }
      if (!els.formatPopover.hidden) {
        event.preventDefault();
        closeFormatPopover({ restoreFocus: true });
        return;
      }
      if (NARROW_SIDEBAR.matches && ui.sidebarOpen) {
        event.preventDefault();
        closeSidebar();
        return;
      }
    }

    if (modifier && event.altKey && inEditor) {
      const styleMap = {
        "1": "h1",
        "2": "h2",
        "3": "h3",
        "4": "p",
        "5": "pre",
      };
      if (styleMap[event.key]) {
        event.preventDefault();
        applyBlockStyle(styleMap[event.key]);
        return;
      }
    }

    if (!modifier) return;

    if (key === "n" && event.shiftKey) {
      event.preventDefault();
      openFolderDialog();
      return;
    }

    if (key === "n") {
      event.preventDefault();
      createNote();
      return;
    }

    if (key === "k" || key === "f") {
      event.preventDefault();
      focusSearch();
      return;
    }

    if (key === "s") {
      event.preventDefault();
      flushActiveNote();
      persistNow();
      return;
    }

    if (!inEditor) return;

    if (key === "b" && !event.shiftKey) {
      event.preventDefault();
      executeInlineCommand("bold");
    } else if (key === "i" && !event.shiftKey) {
      event.preventDefault();
      executeInlineCommand("italic");
    } else if (key === "u" && !event.shiftKey) {
      event.preventDefault();
      executeInlineCommand("underline");
    } else if (key === "x" && event.shiftKey) {
      event.preventDefault();
      executeInlineCommand("strikeThrough");
    } else if (key === "l" && event.shiftKey) {
      event.preventDefault();
      toggleList("checklist");
    }
  }

  function handleSearchKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (els.searchInput.value) clearSearch({ focus: false });
      else els.searchInput.blur();
    }
  }

  /* --------------------------------------------------------------------------
     PWA
     -------------------------------------------------------------------------- */

  function captureInstallPrompt(event) {
    event.preventDefault();
    ui.deferredPrompt = event;
    updateInstallUI();
  }

  function handleAppInstalled() {
    ui.deferredPrompt = null;
    ui.installPromptUsed = true;
    updateInstallUI();
    showToast("Notes is installed. Find it in your Start menu.", {
      icon: "download",
      duration: 6000,
    });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!["http:", "https:"].includes(window.location.protocol)) return;

    try {
      const registration = await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
      });

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state !== "installed" || !navigator.serviceWorker.controller) return;
          showToast("A new version of Notes is ready.", {
            icon: "download",
            actionLabel: "Reload",
            duration: 10_000,
            onAction: () => {
              worker.postMessage({ type: "SKIP_WAITING" });
            },
          });
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (error) {
      console.warn("Service worker registration failed:", error);
    }
  }

  /* --------------------------------------------------------------------------
     Bindings and startup
     -------------------------------------------------------------------------- */

  function bindEvents() {
    els.themeToggleBtn.addEventListener("click", toggleTheme);
    els.appearanceBtn.addEventListener("click", () => openAppearanceMenu(els.appearanceBtn));
    els.shortcutsBtn.addEventListener("click", openShortcutsDialog);
    els.aboutBtn.addEventListener("click", openAboutDialog);
    els.sidebarToggleBtn.addEventListener("click", toggleSidebar);
    els.sidebarBackdrop.addEventListener("click", closeSidebar);
    els.newFolderBtn.addEventListener("click", () => openFolderDialog());
    els.viewOptionsBtn.addEventListener("click", () => openViewOptionsMenu(els.viewOptionsBtn));
    els.newNoteBtn.addEventListener("click", () => createNote());
    els.emptyNewNoteBtn.addEventListener("click", () => createNote());
    els.backToListBtn.addEventListener("click", closeMobileEditor);

    els.installCard.addEventListener("click", promptInstall);
    els.titlebarInstallBtn.addEventListener("click", promptInstall);
    els.installBannerBtn.addEventListener("click", promptInstall);
    els.dismissInstallBtn.addEventListener("click", dismissInstallBanner);

    els.searchInput.addEventListener("input", handleSearchInput);
    els.searchInput.addEventListener("keydown", handleSearchKeydown);
    els.searchClearBtn.addEventListener("click", () => clearSearch());

    els.folderNav.addEventListener("click", handleFolderNavClick);
    els.folderNav.addEventListener("keydown", handleFolderNavKeydown);
    els.folderNav.addEventListener("contextmenu", handleFolderNavContextMenu);
    els.folderNav.addEventListener("dragover", handleFolderDragOver);
    els.folderNav.addEventListener("dragleave", handleFolderDragLeave);
    els.folderNav.addEventListener("drop", handleFolderDrop);
    els.trashRow.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openTrashMenu({ anchor: els.trashRow });
    });

    els.notesList.addEventListener("click", handleNotesListClick);
    els.notesList.addEventListener("contextmenu", handleNotesListContextMenu);
    els.notesList.addEventListener("keydown", handleNotesListKeydown);
    els.notesList.addEventListener("dragstart", handleDragStart);
    els.notesList.addEventListener("dragend", handleDragEnd);

    els.noteContent.addEventListener("input", handleEditorInput);
    els.noteContent.addEventListener("keydown", handleEditorKeydown);
    els.noteContent.addEventListener("pointerdown", handleEditorPointerDown);
    els.noteContent.addEventListener("paste", handleEditorPaste);
    document.addEventListener("selectionchange", scheduleToolbarUpdate);

    $$(".editor-toolbar button, .format-popover button").forEach((button) => {
      button.addEventListener("mousedown", (event) => event.preventDefault());
    });

    els.formatBtn.addEventListener("click", toggleFormatPopover);
    els.boldBtn.addEventListener("click", () => executeInlineCommand("bold"));
    els.italicBtn.addEventListener("click", () => executeInlineCommand("italic"));
    els.underlineBtn.addEventListener("click", () => executeInlineCommand("underline"));
    els.strikeBtn.addEventListener("click", () => executeInlineCommand("strikeThrough"));
    els.checklistBtn.addEventListener("click", () => toggleList("checklist"));
    els.bulletsBtn.addEventListener("click", () => toggleList("bullets"));
    els.numbersBtn.addEventListener("click", () => toggleList("numbers"));
    els.dashBtn.addEventListener("click", () => toggleList("dashed"));
    els.popoverBoldBtn.addEventListener("click", () => executeInlineCommand("bold"));
    els.popoverItalicBtn.addEventListener("click", () => executeInlineCommand("italic"));
    els.popoverUnderlineBtn.addEventListener("click", () => executeInlineCommand("underline"));
    els.popoverStrikeBtn.addEventListener("click", () => executeInlineCommand("strikeThrough"));
    els.popoverChecklistBtn.addEventListener("click", () => toggleList("checklist"));
    els.popoverBulletsBtn.addEventListener("click", () => toggleList("bullets"));
    els.popoverNumbersBtn.addEventListener("click", () => toggleList("numbers"));
    els.popoverDashBtn.addEventListener("click", () => toggleList("dashed"));

    els.formatPopover.addEventListener("click", (event) => {
      const styleButton = event.target.closest("[data-block-style]");
      if (styleButton) applyBlockStyle(styleButton.dataset.blockStyle);
    });

    els.pinNoteBtn.addEventListener("click", () => {
      const note = getSelectedNote();
      if (note) togglePin(note.id);
    });
    els.moveNoteBtn.addEventListener("click", () => {
      const note = getSelectedNote();
      if (note) openMoveDialog(note);
    });
    els.shareNoteBtn.addEventListener("click", () => {
      const note = getSelectedNote();
      if (note) shareNote(note.id);
    });
    els.noteMoreBtn.addEventListener("click", () => openSelectedNoteMenu(els.noteMoreBtn));

    els.restoreNoteBtn.addEventListener("click", () => {
      const note = getSelectedNote();
      if (note) restoreNote(note.id);
    });
    els.deleteForeverBtn.addEventListener("click", () => {
      const note = getSelectedNote();
      if (note) confirmDeleteForever(note.id);
    });

    els.editorScroll.addEventListener("scroll", () => closeFormatPopover(), { passive: true });
    els.contextMenu.addEventListener("click", handleMenuClick);
    els.contextMenu.addEventListener("keydown", handleMenuKeydown);
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    document.addEventListener("keydown", handleGlobalKeydown);

    els.appDialog.addEventListener("close", handleDialogClosed);

    window.addEventListener("resize", () => {
      syncLayout();
      closeContextMenu();
      closeFormatPopover();
    });
    NARROW_SIDEBAR.addEventListener("change", syncLayout);
    MOBILE_LAYOUT.addEventListener("change", syncLayout);
    SYSTEM_DARK.addEventListener("change", () => {
      if (state.preferences.theme === "auto") applyTheme();
    });

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", updateInstallUI);

    window.addEventListener("online", () => {
      showToast("Back online", { icon: "cloud", duration: 2400 });
    });
    window.addEventListener("offline", () => {
      showToast("You are offline — your notes are still here.", {
        icon: "cloud",
        duration: 3600,
      });
    });

    window.addEventListener("pagehide", () => {
      flushActiveNote();
      persistNow({ silent: true });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushActiveNote();
        persistNow({ silent: true });
      }
    });
    window.addEventListener("beforeunload", () => {
      flushActiveNote();
      persistNow({ silent: true });
    });
  }

  function handleShortcutRoute() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;
    params.delete("new");
    const query = params.toString();
    const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", cleanUrl);
    window.setTimeout(() => createNote(), 220);
  }

  function init() {
    try {
      ui.installBannerDismissed = sessionStorage.getItem(INSTALL_DISMISS_KEY) === "1";
    } catch (_) {
      ui.installBannerDismissed = false;
    }

    const stored = loadStoredState();
    state = stored || createSeedState();
    state.version = STORAGE_VERSION;
    state.preferences = { ...DEFAULT_PREFERENCES, ...state.preferences };
    ensureFolderExists();
    state.selectedNoteId = getNote(state.selectedNoteId) ? state.selectedNoteId : null;
    if (
      state.selectedFolderId !== "all" &&
      state.selectedFolderId !== "trash" &&
      !getFolder(state.selectedFolderId)
    ) {
      state.selectedFolderId = "all";
    }
    ensureSelectionVisible();

    applyTheme();
    bindEvents();
    syncLayout();
    renderFolders();
    renderNotesList();
    renderEditor();
    updateInstallUI();

    persistNow({ silent: true });
    registerServiceWorker();
    handleShortcutRoute();

    window.setInterval(() => {
      if (!els.noteEditor.hidden && getSelectedNote() && !ui.editorDirty) {
        updateStats();
      }
    }, 30_000);
  }

  init();
})();
