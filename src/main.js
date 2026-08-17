import './styles.css';
import '@phosphor-icons/web/regular';
import html2canvas from 'html2canvas';
import { createBlankPage, renderSample, renderPdf, renderWord, renderImage } from './documents.js';
import { createInkLayer } from './ink.js';
import { bindPress } from './input.js';
import { lookupWord, lookupCompleteWord, demoSentenceTranslation, normalizeWord } from './dictionary.js';
import { selectedText, wordAtPoint, wordFromTarget, isSentenceSelection } from './selection.js';
import { bookmarkStorageKey, normalizeBookmarkIndexes } from './navigation.js';
import { formatTimer, layerStorageKey, normalizeLayers, normalizePageNotes, noteStorageKey } from './study.js';
import { addExcerpt, addMistakeEntry, addOutlineNode, createMistakeBook, defaultWorkspaceState, normalizeWorkspaceState, tracePageIndexes } from './workspace-state.js';
import { createToolInstance, defaultToolInstances, normalizeToolInstances, toolDefinition, toolMode } from './tool-registry.js';

const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="纸上词间首页"><span class="brand-mark">P<span>／</span>L</span><span><b>纸上词间</b><small>PAPERLINGO</small></span></a>
      <div class="topbar-center">
        <nav class="primary-tabs" aria-label="主功能"><button data-app-view="library" class="active">${icon('folder-open')}<span>资料</span></button><button data-app-view="mistake-library">${icon('notebook')}<span>错题本</span></button></nav>
        <div class="doc-title" id="documentTitleBlock" hidden><span class="status-dot"></span><span id="docTitle">阅读练习 · Ways of Seeing</span><small id="saveState">仅保存在本机</small></div>
      </div>
      <label class="upload-button"><input id="fileInput" type="file" accept=".pdf,.doc,.docx,image/png,image/jpeg" hidden><span>＋</span> 上传试卷</label>
    </header>

    <main class="app-main">
      <section class="home-view library-view" id="libraryView">
        <div class="home-inner"><header class="home-heading"><div><span>LIBRARY</span><h1>资料</h1><p>上传试卷、讲义或创建空白笔记，所有学习内容都从这里开始。</p></div><label class="home-upload"><input type="file" data-library-upload accept=".pdf,.doc,.docx,image/png,image/jpeg" hidden>${icon('plus')} 上传资料</label></header><div class="resource-toolbar"><label>${icon('magnifying-glass')}<input id="resourceSearch" placeholder="搜索资料"></label><button id="newBlankDocument">${icon('file-plus')} 新建空白笔记</button></div><div class="resource-grid" id="resourceGrid"></div></div>
      </section>
      <section class="home-view mistake-library-view" id="mistakeLibraryView" hidden>
        <div class="home-inner"><header class="home-heading"><div><span>REVIEW</span><h1>错题本</h1><p>跨文件收集错题，按自己的复习方式分类整理。</p></div><button class="home-upload" id="createMistakeBookButton">${icon('plus')} 新建错题本</button></header><div class="mistake-books-grid" id="mistakeBooksGrid"></div></div>
      </section>
      <section class="workspace" id="documentWorkspace" hidden>
      <nav class="toolrail" aria-label="试卷工具">
        <div class="tool-group history-group">
          <button class="tool icon-only" id="backLibraryButton" aria-label="返回资料">${icon('arrow-left')}</button>
          <button class="tool icon-only" id="pagesButton" aria-label="页面缩略图">${icon('squares-four')}</button>
          <button class="tool icon-only" id="undoButton" aria-label="撤销">${icon('arrow-u-up-left')}</button>
          <button class="tool icon-only" id="redoButton" aria-label="重做">${icon('arrow-u-up-right')}</button>
        </div>
        <i class="rail-divider"></i>
        <div class="tool-group mode-group" id="toolInstanceGroup"></div>
        <i class="rail-divider"></i>
        <div class="tool-group utility-group">
          <button class="tool utility-action" id="addToolButton" aria-label="添加工具">${icon('plus-circle')}<span>添加</span></button>
          <button class="tool utility-action" id="layersButton" aria-label="管理图层">${icon('stack')}<span>图层</span></button>
          <button class="tool utility-action" id="timerButton" aria-label="考试计时器" aria-controls="timerPopover" aria-expanded="false">${icon('timer')}<span>计时</span></button>
          <button class="tool utility-action" id="settingsButton" aria-label="常用工具设置">${icon('gear-six')}<span>设置</span></button>
          <button class="tool utility-action clear-tool" id="clearButton" aria-label="清空全部标注" title="清空整份试卷的手写标注">${icon('trash')}<span>清空全部</span></button>
        </div>
      </nav>

      <section class="tool-popover" id="toolPopover" hidden aria-label="工具设置">
        <header><div><span>工具设置</span><strong id="settingsTitle">钢笔</strong></div><button id="closeSettings" aria-label="关闭">${icon('x')}</button></header>
        <div id="toolPicker" hidden><p class="picker-hint">选择一种工具，创建后会加入常用栏。</p><div class="tool-type-grid" id="toolTypeGrid"></div></div>
        <div id="instanceSettings">
          <label class="setting-row"><span>粗细</span><output id="widthValue">2.4</output><input id="widthRange" type="range" min="1" max="20" step="0.5" value="2.4"></label>
          <label class="setting-row"><span>浓度</span><output id="opacityValue">100%</output><input id="opacityRange" type="range" min="15" max="100" step="5" value="100"></label>
          <div class="palette-label">颜色</div>
          <div class="color-palette" id="colorPalette">
          <button class="swatch active" data-color="#173c36" style="--swatch:#173c36" aria-label="墨绿"></button>
          <button class="swatch" data-color="#1d4ed8" style="--swatch:#1d4ed8" aria-label="蓝色"></button>
          <button class="swatch" data-color="#dc3c3c" style="--swatch:#dc3c3c" aria-label="红色"></button>
          <button class="swatch" data-color="#8b5cf6" style="--swatch:#8b5cf6" aria-label="紫色"></button>
          <button class="swatch" data-color="#e2ef78" style="--swatch:#e2ef78" aria-label="黄色"></button>
          <button class="swatch" data-color="#86d8c9" style="--swatch:#86d8c9" aria-label="薄荷色"></button>
          </div>
          <label class="pressure-setting"><input id="pressureToggle" type="checkbox"><span>使用压感</span></label>
        </div>
        <div id="lassoSettings" hidden><p class="picker-hint">套索形状</p><div class="shape-switch"><button data-lasso-shape="rect">${icon('rectangle')}规则矩形</button><button data-lasso-shape="free">${icon('scribble')}自由套索</button></div></div>
      </section>

      <section class="timer-popover" id="timerPopover" hidden aria-label="考试计时器">
        <header><div><span>考试计时</span><strong id="timerDisplay">45:00</strong></div><button id="closeTimer" aria-label="关闭计时器">${icon('x')}</button></header>
        <div class="timer-presets" aria-label="计时预设">
          <button data-timer-minutes="45" class="active">45 分</button><button data-timer-minutes="60">60 分</button><button data-timer-minutes="90">90 分</button>
        </div>
        <div class="timer-actions"><button id="timerStart">开始</button><button id="timerReset">重置</button></div>
      </section>

      <section class="desk" id="desk">
        <div class="paper-stack" id="paperStack" aria-live="polite"></div>
      </section>

      <aside class="lookup-panel" id="lookupPanel" aria-live="polite">
        <button class="close-panel" id="closePanel" aria-label="关闭释义">×</button>
        <div class="panel-heading navigator-heading" id="panelHeading" hidden>
          <div class="navigator-title"><div><span>文档导航</span><strong>试卷目录</strong></div><button id="addPageButton" aria-label="新增笔记页">${icon('file-plus')}<span>加页</span></button></div>
          <div class="navigator-tabs" role="tablist" aria-label="文档导航">
            <button data-panel-tab="pages" role="tab">${icon('squares-four')}<b>页面</b></button>
            <button data-panel-tab="traces" role="tab">${icon('wave-sine')}<b>痕迹</b></button>
            <button data-panel-tab="excerpts" role="tab">${icon('quotes')}<b>书摘</b></button>
            <button data-panel-tab="outline" role="tab">${icon('list-dashes')}<b>大纲</b></button>
          </div>
          <label class="navigator-search">${icon('magnifying-glass')}<input id="documentSearchInput" type="search" placeholder="搜索本试卷" autocomplete="off"><span id="searchCount"></span></label>
        </div>
        <div class="panel-heading special-panel-heading" id="specialPanelHeading" hidden></div>
        <div class="lookup-empty" id="lookupEmpty">
          <span class="empty-glyph">Aa</span><h2>词义，就在笔尖旁</h2><p>切换到“查词”，轻点试卷中的英文单词；划选一句话后会直接显示参考翻译。</p>
          <div class="shortcut"><kbd>双击</kbd><span>也可以快速查词</span></div>
        </div>
        <div class="lookup-result" id="lookupResult" hidden></div>
      </aside>
      </section>
    </main>
    <div class="toast" id="toast"></div>
  </div>`;

let mode = 'ink';
let inkLayers = [];
let activeInkIndex = 0;
const WORKSPACE_KEY = 'paperlingo:workspace:v2';
const TOOLS_KEY = 'paperlingo:tools:v2';
const COMMON_TOOLS_KEY = 'paperlingo:common-tools:v1';
let workspaceState = loadWorkspaceState();
let toolInstances = loadToolInstances();
let commonTools = loadCommonTools();
let activeToolId = toolInstances.find(item => item.type === 'pen')?.id || toolInstances[0].id;
let currentDocumentId = 'sample';
let currentDoc = { id: 'sample', type: 'sample', pages: 1, title: '阅读练习 · Ways of Seeing' };
let lookupRequestId = 0;
let pageBookmarks = new Set();
let pageNotes = {};
let documentLayers = [{ id: 'layer-1', name: '图层 1', visible: true }];
let activeLayerId = 'layer-1';
let pageObserver = null;
let timerSeconds = 45 * 60;
let timerPresetSeconds = timerSeconds;
let timerInterval = null;
const stack = document.querySelector('#paperStack');
const panel = document.querySelector('#lookupPanel');

function loadWorkspaceState() {
  try { return normalizeWorkspaceState(JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null')); }
  catch { return defaultWorkspaceState(); }
}

function saveWorkspaceState() {
  try { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspaceState)); }
  catch { toast('当前浏览器无法保存资料库'); }
}

function loadToolInstances() {
  try { return normalizeToolInstances(JSON.parse(localStorage.getItem(TOOLS_KEY) || 'null')); }
  catch { return defaultToolInstances(); }
}

function saveToolInstances() {
  try { localStorage.setItem(TOOLS_KEY, JSON.stringify(toolInstances)); }
  catch { toast('当前浏览器无法保存工具设置'); }
}

function loadCommonTools() {
  try { return { layers: true, timer: true, clear: true, ...JSON.parse(localStorage.getItem(COMMON_TOOLS_KEY) || '{}') }; }
  catch { return { layers: true, timer: true, clear: true }; }
}

function saveCommonTools() {
  localStorage.setItem(COMMON_TOOLS_KEY, JSON.stringify(commonTools));
  applyCommonToolVisibility();
}

function applyCommonToolVisibility() {
  document.querySelector('#layersButton').hidden = !commonTools.layers;
  document.querySelector('#timerButton').hidden = !commonTools.timer;
  document.querySelector('#clearButton').hidden = !commonTools.clear;
}

function activeTool() { return toolInstances.find(item => item.id === activeToolId) || toolInstances[0]; }

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function showAppView(view) {
  const isDocument = view === 'document';
  document.querySelector('#libraryView').hidden = view !== 'library';
  document.querySelector('#mistakeLibraryView').hidden = view !== 'mistake-library';
  document.querySelector('#documentWorkspace').hidden = !isDocument;
  document.querySelector('#documentTitleBlock').hidden = !isDocument;
  const activePrimaryView = isDocument ? 'library' : view;
  document.querySelectorAll('[data-app-view]').forEach(button => button.classList.toggle('active', button.dataset.appView === activePrimaryView));
  document.body.dataset.appView = view;
  if (view === 'library') renderResourceLibrary();
  if (view === 'mistake-library') renderMistakeLibrary();
}

function renderResourceLibrary(query = '') {
  const target = document.querySelector('#resourceGrid');
  const normalized = query.trim().toLocaleLowerCase();
  const documents = workspaceState.documents.filter(doc => !normalized || `${doc.title} ${(doc.tags || []).join(' ')}`.toLocaleLowerCase().includes(normalized));
  target.innerHTML = documents.length ? documents.map(doc => `<button class="resource-card" data-resource-id="${escapeHtml(doc.id)}"><span class="resource-cover">${icon(doc.type === 'sample' ? 'book-open-text' : doc.type === 'blank' ? 'notepad' : 'file-text')}<small>${escapeHtml((doc.type || 'FILE').toUpperCase())}</small></span><span class="resource-info"><strong>${escapeHtml(doc.title)}</strong><small>${(doc.tags || []).map(tag => `#${escapeHtml(tag)}`).join(' ') || '本机资料'}</small></span>${icon('arrow-right')}</button>`).join('') : `<div class="home-empty">${icon('folder-dashed')}<strong>没有找到资料</strong><p>换一个关键词，或上传新的文件。</p></div>`;
  target.querySelectorAll('[data-resource-id]').forEach(button => button.addEventListener('click', () => openResource(button.dataset.resourceId)));
}

function renderMistakeLibrary() {
  const target = document.querySelector('#mistakeBooksGrid');
  target.innerHTML = workspaceState.mistakeBooks.map(book => {
    const entries = workspaceState.mistakeEntries.filter(item => item.bookId === book.id);
    return `<section class="mistake-book-card"><header><span style="--book-color:${escapeHtml(book.color || '#d8ef8f')}">${icon('notebook')}</span><div><strong>${escapeHtml(book.name)}</strong><small>${entries.length} 道错题 · 跨文件收录</small></div></header><div class="mistake-entry-grid">${entries.length ? entries.slice(0, 6).map(entry => `<button data-source-document="${escapeHtml(entry.documentId)}" data-source-page="${entry.pageIndex}"><img src="${entry.image}" alt="${escapeHtml(entry.documentTitle)}第 ${entry.pageIndex + 1} 页"><span>${escapeHtml(entry.documentTitle)} · 第 ${entry.pageIndex + 1} 页</span></button>`).join('') : `<p>还没有内容。可以在资料中用套索添加。</p>`}</div></section>`;
  }).join('');
  target.querySelectorAll('[data-source-document]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.sourceDocument !== 'sample' && button.dataset.sourceDocument !== currentDocumentId) return toast('该本地文件需要重新打开后才能跳转');
    openResource(button.dataset.sourceDocument, Number(button.dataset.sourcePage));
  }));
}

function registerDocument(doc) {
  const existing = workspaceState.documents.find(item => item.id === doc.id);
  const record = { id: doc.id, title: doc.title, type: doc.type, tags: doc.tags || [], createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(), lastOpenedAt: Date.now() };
  workspaceState = { ...workspaceState, documents: existing ? workspaceState.documents.map(item => item.id === doc.id ? { ...item, ...record } : item) : [record, ...workspaceState.documents] };
  saveWorkspaceState();
}

function openResource(id, pageIndex = 0) {
  const doc = workspaceState.documents.find(item => item.id === id);
  if (!doc) return;
  if (id === 'sample') {
    currentDocumentId = 'sample';
    const rendered = renderSample(stack);
    updateMeta({ ...rendered, id: 'sample' });
    showAppView('document');
    if (pageIndex) requestAnimationFrame(() => goToPage(pageIndex));
    return;
  }
  if (id === currentDocumentId && stack.children.length) {
    showAppView('document');
    requestAnimationFrame(() => goToPage(pageIndex));
    return;
  }
  toast('此本地资料需要重新上传后打开');
}

function createBlankResource() {
  const id = `blank-${Date.now()}`;
  const title = `空白笔记 ${new Date().toLocaleDateString('zh-CN')}`;
  stack.replaceChildren(createBlankPage(`${id}-1`));
  currentDocumentId = id;
  const doc = { id, type: 'blank', pages: 1, title, tags: ['笔记'] };
  registerDocument(doc);
  updateMeta(doc);
  showAppView('document');
}

function applyMode(nextMode) {
  mode = nextMode;
  document.body.dataset.mode = mode;
  document.querySelectorAll('button[data-tool-id]').forEach(button => {
    const active = button.dataset.toolId === activeToolId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  stack.querySelectorAll('.ink-layer').forEach(canvas => canvas.style.pointerEvents = ['ink', 'highlight', 'eraser'].includes(mode) ? 'auto' : 'none');
  stack.querySelectorAll('.lasso-layer').forEach(layer => layer.style.pointerEvents = mode === 'lasso' ? 'auto' : 'none');
  stack.querySelectorAll('.selectable-content').forEach(layer => layer.style.pointerEvents = mode === 'lookup' ? 'auto' : 'none');
}

function saveLayers() {
  try { localStorage.setItem(layerStorageKey(currentDoc.title), JSON.stringify(documentLayers)); }
  catch { toast('当前浏览器无法保存图层设置'); }
}

function loadLayers() {
  try { return normalizeLayers(JSON.parse(localStorage.getItem(layerStorageKey(currentDoc.title)) || '[]')); }
  catch { return normalizeLayers([]); }
}

async function captureSelectionImage(page, rect) {
  const pageRect = page.getBoundingClientRect();
  const source = await html2canvas(page, {
    backgroundColor: '#fff', scale: 1, logging: false,
    ignoreElements: element => element.classList?.contains('lasso-layer')
  });
  const scaleX = source.width / pageRect.width;
  const scaleY = source.height / pageRect.height;
  const sx = Math.max(0, (rect.left - pageRect.left) * scaleX);
  const sy = Math.max(0, (rect.top - pageRect.top) * scaleY);
  const sw = Math.min(source.width - sx, rect.width * scaleX);
  const sh = Math.min(source.height - sy, rect.height * scaleY);
  const output = document.createElement('canvas');
  const ratio = Math.min(1, 640 / sw);
  output.width = Math.max(1, Math.round(sw * ratio));
  output.height = Math.max(1, Math.round(sh * ratio));
  output.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, output.width, output.height);
  return output.toDataURL('image/jpeg', .8);
}

async function saveLassoCapture(page, pageIndex, rect, destination, bookId = '') {
  toast('正在生成选区截图…');
  try {
    const image = await captureSelectionImage(page, rect);
    if (destination === 'excerpt') {
      workspaceState = addExcerpt(workspaceState, currentDocumentId, { pageIndex, image }).state;
      saveWorkspaceState();
      toast('已保存为书摘，可在“书摘”中添加笔记');
      if (panel.dataset.view === 'excerpts') renderExcerpts();
      return;
    }
    const destinationId = bookId || workspaceState.mistakeBooks[0]?.id;
    workspaceState = addMistakeEntry(workspaceState, {
      bookId: destinationId,
      documentId: currentDocumentId,
      documentTitle: currentDoc.title,
      pageIndex,
      image
    });
    saveWorkspaceState();
    const book = workspaceState.mistakeBooks.find(item => item.id === destinationId);
    toast(`已收录到“${book?.name || '错题本'}”`);
  } catch (error) {
    console.warn('Selection capture failed', error);
    toast('截图失败，请缩小选区后重试');
  }
}

function mountLassoLayer(page, pageIndex) {
  page.querySelector('.lasso-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'lasso-layer';
  layer.setAttribute('aria-label', '套索选择区域');
  page.append(layer);
  let start = null;
  let selection = null;
  let points = [];
  let selectedStrokeIds = [];
  let moveStart = null;
  let moveDelta = { x: 0, y: 0 };

  const clearSelection = () => {
    layer.replaceChildren();
    selection = null;
    selectedStrokeIds = [];
    points = [];
    moveStart = null;
    moveDelta = { x: 0, y: 0 };
  };

  const selectionRect = () => selection?.getBoundingClientRect();

  const renderActions = rect => {
    const bounds = layer.getBoundingClientRect();
    const actions = document.createElement('div');
    actions.className = 'lasso-actions';
    actions.style.left = `${Math.max(8, Math.min(layer.clientWidth - 330, rect.left - bounds.left))}px`;
    actions.style.top = `${Math.max(8, rect.top - bounds.top - 54)}px`;
    actions.innerHTML = `<div class="lasso-primary-actions"><button data-lasso-action="copy" title="复制字迹">${icon('copy')}<span>复制</span></button><button data-lasso-action="move" title="移动字迹">${icon('arrows-out-cardinal')}<span>移动</span></button><button data-lasso-action="scale" title="放大字迹">${icon('arrows-out')}<span>放大</span></button><button data-lasso-action="delete" title="删除字迹">${icon('trash')}<span>删除</span></button></div><div class="lasso-capture-actions"><button data-lasso-action="excerpt">${icon('quotes')}书摘</button><label><select aria-label="选择错题本">${workspaceState.mistakeBooks.map(book => `<option value="${escapeHtml(book.id)}">${escapeHtml(book.name)}</option>`).join('')}</select><button data-lasso-action="mistake">${icon('notebook')}收录</button></label></div>`;
    layer.append(actions);
    actions.querySelectorAll('[data-lasso-action]').forEach(button => bindPress(button, async () => {
      const action = button.dataset.lassoAction;
      const ink = inkLayers[pageIndex];
      if (action === 'copy') {
        selectedStrokeIds = ink.duplicateSelection(selectedStrokeIds);
        toast(selectedStrokeIds.length ? '已复制字迹' : '选区中没有可复制的字迹');
      } else if (action === 'move') {
        if (!selectedStrokeIds.length) return toast('选区中没有可移动的字迹');
        selection.classList.add('move-armed');
        toast('拖动选区即可移动字迹');
      } else if (action === 'scale') {
        const current = selectionRect();
        ink.transformSelection(selectedStrokeIds, { scale: 1.12, origin: { x: (current.left - bounds.left + current.width / 2) / bounds.width, y: (current.top - bounds.top + current.height / 2) / bounds.height } });
        toast(selectedStrokeIds.length ? '已放大字迹' : '选区中没有可缩放的字迹');
      } else if (action === 'delete') {
        const deleted = ink.deleteSelection(selectedStrokeIds);
        clearSelection();
        toast(deleted ? '已删除选中字迹' : '选区中没有字迹，未删除原文');
      } else if (action === 'excerpt') {
        await saveLassoCapture(page, pageIndex, selectionRect(), 'excerpt');
        clearSelection();
      } else if (action === 'mistake') {
        await saveLassoCapture(page, pageIndex, selectionRect(), 'mistake', actions.querySelector('select').value);
        clearSelection();
      }
    }));
  };

  const updateSelection = (x, y) => {
    const left = Math.min(start.x, x);
    const top = Math.min(start.y, y);
    const width = Math.abs(x - start.x);
    const height = Math.abs(y - start.y);
    Object.assign(selection.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    if (activeTool()?.params?.shape === 'free') {
      points.push({ x, y });
      const relative = points.map(point => `${((point.x - left) / Math.max(width, 1)) * 100}% ${((point.y - top) / Math.max(height, 1)) * 100}%`);
      selection.style.clipPath = `polygon(${relative.join(',')})`;
    }
  };

  layer.addEventListener('pointerdown', event => {
    if (event.target.closest('.lasso-actions')) return;
    if (selection?.classList.contains('move-armed') && event.target === selection) {
      event.preventDefault();
      moveStart = { x: event.clientX, y: event.clientY };
      layer.setPointerCapture?.(event.pointerId);
      return;
    }
    event.preventDefault();
    layer.setPointerCapture?.(event.pointerId);
    const bounds = layer.getBoundingClientRect();
    start = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    selection = document.createElement('span');
    selection.className = `lasso-selection ${activeTool()?.params?.shape === 'free' ? 'free' : 'rect'}`;
    points = [start];
    layer.replaceChildren(selection);
  });
  layer.addEventListener('pointermove', event => {
    if (moveStart && selection) {
      moveDelta = { x: event.clientX - moveStart.x, y: event.clientY - moveStart.y };
      selection.style.transform = `translate(${moveDelta.x}px, ${moveDelta.y}px)`;
      return;
    }
    if (!start || !selection) return;
    const bounds = layer.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
    updateSelection(x, y);
  });
  layer.addEventListener('pointerup', () => {
    if (moveStart && selection) {
      const bounds = layer.getBoundingClientRect();
      inkLayers[pageIndex].transformSelection(selectedStrokeIds, { dx: moveDelta.x / bounds.width, dy: moveDelta.y / bounds.height });
      const left = Number.parseFloat(selection.style.left) + moveDelta.x;
      const top = Number.parseFloat(selection.style.top) + moveDelta.y;
      Object.assign(selection.style, { left: `${left}px`, top: `${top}px`, transform: '', clipPath: '' });
      selection.classList.remove('move-armed');
      moveStart = null;
      moveDelta = { x: 0, y: 0 };
      layer.querySelector('.lasso-actions')?.remove();
      renderActions(selectionRect());
      return;
    }
    if (!start || !selection) return;
    const rect = selection.getBoundingClientRect();
    start = null;
    if (rect.width < 36 || rect.height < 28) {
      clearSelection();
      return toast('请框选一个更大的区域');
    }
    const bounds = layer.getBoundingClientRect();
    selectedStrokeIds = inkLayers[pageIndex].selectInRect({ left: (rect.left - bounds.left) / bounds.width, right: (rect.right - bounds.left) / bounds.width, top: (rect.top - bounds.top) / bounds.height, bottom: (rect.bottom - bounds.top) / bounds.height }, activeLayerId);
    renderActions(rect);
  });
  layer.addEventListener('pointercancel', clearSelection);
}

function closeToolSettings() {
  document.querySelector('#toolPopover').hidden = true;
}

function openToolSettings(instance = activeTool()) {
  if (!toolDefinition(instance.type)?.configurable) return toast(`${instance.name}没有可调整参数`);
  syncSettings(instance, true);
}

function renderToolInstances() {
  const group = document.querySelector('#toolInstanceGroup');
  group.innerHTML = toolInstances.filter(item => item.visible).map(item => `<button class="tool ${item.id === activeToolId ? 'active' : ''}" data-tool-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)}" aria-pressed="${item.id === activeToolId}">${icon(item.icon)}<span>${escapeHtml(item.name)}</span></button>`).join('');
}

function mountInkLayers() {
  inkLayers.forEach(layer => layer.destroy());
  const pages = [...stack.querySelectorAll('.paper-page')];
  inkLayers = pages.map((page, index) => {
    let pageFrame = page.parentElement?.classList.contains('page-frame') ? page.parentElement : null;
    if (!pageFrame) {
      pageFrame = document.createElement('section');
      pageFrame.className = 'page-frame';
      pageFrame.setAttribute('aria-label', `第 ${index + 1} 页`);
      page.before(pageFrame);
      pageFrame.append(page);
    }
    pageFrame.querySelector('.page-jump-badge')?.remove();
    const pageBadge = document.createElement('button');
    pageBadge.className = 'page-jump-badge';
    pageBadge.type = 'button';
    pageBadge.setAttribute('aria-label', `当前第 ${index + 1} 页，共 ${pages.length} 页；打开页面目录`);
    pageBadge.innerHTML = `<strong>第 ${index + 1} / ${pages.length} 页</strong><span>点击跳转</span>${icon('caret-down')}`;
    bindPress(pageBadge, event => {
      event.stopPropagation();
      activeInkIndex = index;
      showPanelView('pages');
    });
    pageFrame.prepend(pageBadge);
    const canvas = page.querySelector('.ink-layer');
    mountLassoLayer(page, index);
    const markActive = () => { activeInkIndex = index; };
    canvas.addEventListener('pointerdown', markActive);
    canvas.addEventListener('touchstart', markActive, { passive: true });
    canvas.addEventListener('mousedown', markActive);
    return createInkLayer(canvas, `paperlingo:${currentDoc.title}:${index}`, () => ({
      mode, ...(activeTool()?.params || {}), toolId: activeToolId, layerId: activeLayerId,
      hiddenLayers: documentLayers.filter(layer => !layer.visible).map(layer => layer.id)
    }));
  });
  activeInkIndex = Math.min(activeInkIndex, Math.max(0, inkLayers.length - 1));
  pageObserver?.disconnect();
  pageObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const index = [...stack.querySelectorAll('.page-frame')].indexOf(visible.target);
    if (index < 0 || index === activeInkIndex) return;
    activeInkIndex = index;
    refreshNavigatorActiveState();
  }, { root: document.querySelector('#desk'), threshold: [.25, .5, .75] });
  stack.querySelectorAll('.page-frame').forEach(frame => pageObserver.observe(frame));
  applyMode(mode);
}

function updateMeta(doc) {
  currentDoc = { ...doc, id: doc.id || currentDocumentId };
  currentDocumentId = currentDoc.id;
  document.querySelector('#docTitle').textContent = doc.title;
  pageBookmarks = loadBookmarks();
  pageNotes = loadNotes();
  documentLayers = loadLayers();
  activeLayerId = documentLayers[0].id;
  mountInkLayers();
  if (isNavigatorView(panel.dataset.view)) renderNavigatorView(panel.dataset.view);
}

function isNavigatorView(view) {
  return ['pages', 'traces', 'excerpts', 'outline'].includes(view);
}

function loadBookmarks() {
  try {
    const stored = JSON.parse(localStorage.getItem(bookmarkStorageKey(currentDoc.title)) || '[]');
    return new Set(normalizeBookmarkIndexes(stored, currentDoc.pages));
  } catch { return new Set(); }
}

function saveBookmarks() {
  try { localStorage.setItem(bookmarkStorageKey(currentDoc.title), JSON.stringify([...pageBookmarks])); }
  catch { toast('当前浏览器无法保存书签'); }
}

function loadNotes() {
  try {
    const stored = JSON.parse(localStorage.getItem(noteStorageKey(currentDoc.title)) || '{}');
    return normalizePageNotes(stored, currentDoc.pages);
  } catch { return {}; }
}

function saveNotes() {
  try { localStorage.setItem(noteStorageKey(currentDoc.title), JSON.stringify(pageNotes)); }
  catch { toast('当前浏览器无法保存笔记'); }
}

function showPanelView(view) {
  closeToolSettings();
  // A few tablet WebViews retarget the release tap after the drawer starts moving.
  // Re-assert exclusivity after the current activation cycle.
  setTimeout(() => { closeToolSettings(); }, 0);
  const previousView = panel.dataset.view;
  panel.dataset.view = view;
  const searchInput = document.querySelector('#documentSearchInput');
  if (searchInput && previousView !== view && !isNavigatorView(view)) searchInput.value = '';
  document.querySelector('#panelHeading').hidden = !isNavigatorView(view);
  document.querySelector('#specialPanelHeading').hidden = !['layers', 'toolbar'].includes(view);
  document.querySelector('#lookupEmpty').hidden = true;
  document.querySelector('#lookupResult').hidden = false;
  if (isNavigatorView(view)) renderNavigatorView(view);
  else if (view === 'layers') renderLayers();
  else if (view === 'toolbar') renderToolbarManager();
  panel.classList.add('open');
}

function goToPage(index) {
  const pages = [...stack.querySelectorAll('.paper-page')];
  activeInkIndex = index;
  (pages[index]?.closest('.page-frame') || pages[index])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  refreshNavigatorActiveState();
}

function createPagePreview(page, index) {
  const preview = document.createElement('span');
  preview.className = 'mini-page-preview';
  preview.setAttribute('aria-hidden', 'true');
  const clone = page.cloneNode(true);
  clone.classList.add('thumbnail-source');
  clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
  clone.querySelectorAll('button').forEach(button => button.tabIndex = -1);
  preview.append(clone);
  requestAnimationFrame(() => {
    const width = page.getBoundingClientRect().width || page.offsetWidth || 1;
    const height = page.getBoundingClientRect().height || page.offsetHeight || 1;
    const scale = Math.min((preview.clientWidth - 2) / width, (preview.clientHeight - 2) / height);
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.transform = `scale(${scale})`;
    clone.style.transformOrigin = 'top left';
    const sourceCanvases = page.querySelectorAll('canvas');
    clone.querySelectorAll('canvas').forEach((canvas, canvasIndex) => {
      const source = sourceCanvases[canvasIndex];
      if (!source) return;
      canvas.width = source.width;
      canvas.height = source.height;
      canvas.getContext('2d')?.drawImage(source, 0, 0);
    });
  });
  preview.dataset.previewPage = String(index);
  return preview;
}

function pageCard(page, index) {
  const card = document.createElement('article');
  card.className = `page-thumbnail ${index === activeInkIndex ? 'active' : ''}`;
  card.dataset.pageIndex = String(index);
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `跳转到第 ${index + 1} 页`);
  const previewSlot = document.createElement('span');
  previewSlot.className = 'preview-slot';
  previewSlot.append(createPagePreview(page, index));
  const info = document.createElement('span');
  info.className = 'thumbnail-info';
  info.innerHTML = `<strong>第 ${index + 1} 页</strong><small>${index === activeInkIndex ? '当前页' : '轻点跳转'}</small>`;
  const bookmark = document.createElement('button');
  bookmark.className = `page-bookmark ${pageBookmarks.has(index) ? 'saved' : ''}`;
  bookmark.dataset.bookmarkIndex = String(index);
  bookmark.setAttribute('aria-label', pageBookmarks.has(index) ? `取消第 ${index + 1} 页书签` : `收藏第 ${index + 1} 页`);
  bookmark.innerHTML = icon('bookmark-simple');
  card.append(previewSlot, info, bookmark);
  return card;
}

function bindPageCards(target) {
  target.querySelectorAll('[data-page-index]').forEach(card => {
    const activate = () => goToPage(Number(card.dataset.pageIndex));
    card.addEventListener('click', activate);
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
    });
  });
  target.querySelectorAll('[data-bookmark-index]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const index = Number(button.dataset.bookmarkIndex);
    if (pageBookmarks.has(index)) pageBookmarks.delete(index);
    else pageBookmarks.add(index);
    saveBookmarks();
    renderNavigatorView(panel.dataset.view);
    toast(pageBookmarks.has(index) ? `已收藏第 ${index + 1} 页` : `已取消第 ${index + 1} 页书签`);
  }));
}

function renderPageThumbnails(indexes = null) {
  const target = document.querySelector('#lookupResult');
  const pages = [...stack.querySelectorAll('.paper-page')];
  const visibleIndexes = indexes || pages.map((_, index) => index);
  if (!visibleIndexes.length) {
    target.innerHTML = `<div class="navigator-empty">${icon('bookmark-simple')}<strong>还没有书签</strong><p>在“页面”中点按书签图标，常用页面会收在这里。</p><button data-empty-action="pages">浏览全部页面</button></div>`;
    target.querySelector('[data-empty-action]')?.addEventListener('click', () => showPanelView('pages'));
    return;
  }
  const list = document.createElement('div');
  list.className = 'thumbnail-list';
  visibleIndexes.forEach(index => list.append(pageCard(pages[index], index)));
  target.replaceChildren(list);
  bindPageCards(target);
}

function renderOutline() {
  const target = document.querySelector('#lookupResult');
  const items = workspaceState.outlinesByDocument[currentDocumentId] || [];
  const depthOf = item => item.parentId && items.some(parent => parent.id === item.parentId) ? 2 : 1;
  target.innerHTML = `<form class="outline-create" id="outlineCreateForm"><input id="outlineLabel" maxlength="80" placeholder="输入大纲名称" required><select id="outlineParent"><option value="">一级大纲</option>${items.map(item => `<option value="${escapeHtml(item.id)}">作为“${escapeHtml(item.label)}”的子级</option>`).join('')}</select><button>关联第 ${activeInkIndex + 1} 页</button></form>${items.length ? `<ol class="outline-list">${items.map(item => `<li style="--level:${depthOf(item)}"><button data-outline-page="${item.pageIndex}"><span>${escapeHtml(item.label)}</span><small>${item.pageIndex + 1}</small></button><button class="outline-remove" data-outline-remove="${escapeHtml(item.id)}" aria-label="删除${escapeHtml(item.label)}">${icon('x')}</button></li>`).join('')}</ol>` : `<div class="navigator-empty compact">${icon('list-dashes')}<strong>大纲由你创建</strong><p>输入标题并关联当前页，也可以建立子级。</p></div>`}`;
  target.querySelector('#outlineCreateForm').addEventListener('submit', event => {
    event.preventDefault();
    const result = addOutlineNode(workspaceState, currentDocumentId, { label: target.querySelector('#outlineLabel').value, pageIndex: activeInkIndex, parentId: target.querySelector('#outlineParent').value || null });
    workspaceState = result.state; saveWorkspaceState(); renderOutline(); toast('已添加到大纲');
  });
  target.querySelectorAll('[data-outline-page]').forEach(button => button.addEventListener('click', () => goToPage(Number(button.dataset.outlinePage))));
  target.querySelectorAll('[data-outline-remove]').forEach(button => button.addEventListener('click', () => {
    workspaceState = { ...workspaceState, outlinesByDocument: { ...workspaceState.outlinesByDocument, [currentDocumentId]: items.filter(item => item.id !== button.dataset.outlineRemove && item.parentId !== button.dataset.outlineRemove) } };
    saveWorkspaceState(); renderOutline();
  }));
}

function pageSearchText(page) {
  return (page.innerText || page.textContent || '').replace(/\s+/g, ' ').trim();
}

function renderSearchResults(query) {
  const target = document.querySelector('#lookupResult');
  const pages = [...stack.querySelectorAll('.paper-page')];
  const normalized = query.trim().toLocaleLowerCase();
  const results = pages.map((page, pageIndex) => ({ pageIndex, text: pageSearchText(page) }))
    .filter(item => item.text.toLocaleLowerCase().includes(normalized));
  document.querySelector('#searchCount').textContent = results.length ? `${results.length} 页` : '0 页';
  if (!results.length) {
    target.innerHTML = `<div class="navigator-empty">${icon('magnifying-glass')}<strong>没有找到相关内容</strong><p>试试更短的单词、题号或标题。</p></div>`;
    return;
  }
  target.innerHTML = `<div class="search-results">${results.map(item => {
    const lower = item.text.toLocaleLowerCase();
    const at = lower.indexOf(normalized);
    const start = Math.max(0, at - 34);
    const snippet = `${start ? '…' : ''}${item.text.slice(start, at)}<mark>${item.text.slice(at, at + query.length)}</mark>${item.text.slice(at + query.length, at + query.length + 66)}…`;
    return `<button data-search-page="${item.pageIndex}"><strong>第 ${item.pageIndex + 1} 页</strong><span>${snippet}</span>${icon('arrow-right')}</button>`;
  }).join('')}</div>`;
  target.querySelectorAll('[data-search-page]').forEach(button => button.addEventListener('click', () => goToPage(Number(button.dataset.searchPage))));
}

function renderTraces() {
  const target = document.querySelector('#lookupResult');
  const excerpts = workspaceState.excerptsByDocument[currentDocumentId] || [];
  const indexes = tracePageIndexes({ inkPages: inkLayers.map((layer, index) => layer.hasInk() ? index : -1), excerpts });
  if (!indexes.length) {
    target.innerHTML = `<div class="navigator-empty">${icon('wave-sine')}<strong>还没有留下痕迹</strong><p>有手写、荧光或书摘的页面会自动出现在这里。</p></div>`;
    return;
  }
  renderPageThumbnails(indexes);
}

function renderExcerpts() {
  const target = document.querySelector('#lookupResult');
  const excerpts = workspaceState.excerptsByDocument[currentDocumentId] || [];
  if (!excerpts.length) {
    target.innerHTML = `<div class="navigator-empty">${icon('quotes')}<strong>还没有书摘</strong><p>使用套索圈选内容，然后选择“截图做书摘”。</p></div>`;
    return;
  }
  target.innerHTML = `<div class="excerpt-list">${excerpts.map(item => `<article><img src="${item.image}" alt="第 ${item.pageIndex + 1} 页书摘"><button data-excerpt-page="${item.pageIndex}">第 ${item.pageIndex + 1} 页 ${icon('arrow-right')}</button><textarea data-excerpt-note="${escapeHtml(item.id)}" placeholder="为这条书摘添加笔记…">${escapeHtml(item.note)}</textarea></article>`).join('')}</div>`;
  target.querySelectorAll('[data-excerpt-page]').forEach(button => button.addEventListener('click', () => goToPage(Number(button.dataset.excerptPage))));
  target.querySelectorAll('[data-excerpt-note]').forEach(input => input.addEventListener('change', () => {
    const next = excerpts.map(item => item.id === input.dataset.excerptNote ? { ...item, note: input.value.slice(0, 4000) } : item);
    workspaceState = { ...workspaceState, excerptsByDocument: { ...workspaceState.excerptsByDocument, [currentDocumentId]: next } };
    saveWorkspaceState();
  }));
}

function renderToolbarManager() {
  const heading = document.querySelector('#specialPanelHeading');
  heading.innerHTML = `<span>工作台设置</span><strong>常用工具</strong><p>调整工具顺序、显示内容，笔的参数请直接再次点击对应笔。</p>`;
  const target = document.querySelector('#lookupResult');
  const commonLabels = { layers: ['stack', '图层'], timer: ['timer', '计时'], clear: ['trash', '清空'] };
  target.innerHTML = `<div class="toolbar-manager"><h3>笔与操作</h3>${toolInstances.map((tool, index) => `<article data-manager-tool="${escapeHtml(tool.id)}"><span>${icon(tool.icon)}<b>${escapeHtml(tool.name)}</b></span><div><button data-tool-move="up" ${index === 0 ? 'disabled' : ''} aria-label="上移">${icon('arrow-up')}</button><button data-tool-move="down" ${index === toolInstances.length - 1 ? 'disabled' : ''} aria-label="下移">${icon('arrow-down')}</button><button data-tool-visible aria-label="${tool.visible ? '隐藏' : '显示'}">${icon(tool.visible ? 'eye' : 'eye-slash')}</button></div></article>`).join('')}<h3>辅助功能</h3>${Object.entries(commonLabels).map(([id, [toolIcon, label]]) => `<label class="common-tool-toggle">${icon(toolIcon)}<span>${label}</span><input type="checkbox" data-common-tool="${id}" ${commonTools[id] ? 'checked' : ''}></label>`).join('')}</div>`;
  target.querySelectorAll('[data-manager-tool]').forEach(row => {
    const id = row.dataset.managerTool;
    row.querySelector('[data-tool-visible]').addEventListener('click', () => {
      const tool = toolInstances.find(item => item.id === id);
      tool.visible = !tool.visible;
      if (!tool.visible && activeToolId === id) activeToolId = toolInstances.find(item => item.visible && item.id !== id)?.id || toolInstances[0].id;
      saveToolInstances(); renderToolInstances(); applyMode(toolMode(activeTool())); renderToolbarManager();
    });
    row.querySelectorAll('[data-tool-move]').forEach(button => button.addEventListener('click', () => {
      const index = toolInstances.findIndex(item => item.id === id);
      const next = button.dataset.toolMove === 'up' ? index - 1 : index + 1;
      if (next < 0 || next >= toolInstances.length) return;
      [toolInstances[index], toolInstances[next]] = [toolInstances[next], toolInstances[index]];
      saveToolInstances(); renderToolInstances(); renderToolbarManager();
    }));
  });
  target.querySelectorAll('[data-common-tool]').forEach(input => input.addEventListener('change', () => {
    commonTools[input.dataset.commonTool] = input.checked; saveCommonTools();
  }));
}

function renderLayers() {
  const heading = document.querySelector('#specialPanelHeading');
  heading.innerHTML = `<span>手动管理</span><strong>图层</strong><p>每一笔会写入当前选中的图层。你可以自行命名为“草稿”“答案”等。</p>`;
  const target = document.querySelector('#lookupResult');
  target.innerHTML = `<div class="layer-list">${documentLayers.map((layer, index) => `
    <article class="layer-row ${layer.id === activeLayerId ? 'active' : ''}" data-layer-id="${escapeHtml(layer.id)}">
      <div class="layer-select" role="button" tabindex="0" aria-label="选择${escapeHtml(layer.name)}"><span>${index + 1}</span><input maxlength="30" aria-label="图层名称" value="${escapeHtml(layer.name)}"></div>
      <button class="layer-visibility" aria-label="${layer.visible ? '隐藏' : '显示'}${escapeHtml(layer.name)}">${icon(layer.visible ? 'eye' : 'eye-slash')}</button>
      <button class="layer-delete" aria-label="删除${escapeHtml(layer.name)}" ${documentLayers.length === 1 ? 'disabled' : ''}>${icon('trash')}</button>
    </article>`).join('')}</div><button class="add-layer-button" id="addLayerButton">${icon('plus')} 新增图层</button>`;
  target.querySelectorAll('.layer-row').forEach(row => {
    const id = row.dataset.layerId;
    row.querySelector('.layer-select').addEventListener('click', event => {
      if (event.target.matches('input')) return;
      activeLayerId = id;
      renderLayers();
      toast(`已切换到${documentLayers.find(layer => layer.id === id)?.name}`);
    });
    row.querySelector('.layer-select').addEventListener('keydown', event => {
      if (event.target.matches('input') || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); activeLayerId = id; renderLayers();
    });
    row.querySelector('input').addEventListener('change', event => {
      const layer = documentLayers.find(item => item.id === id);
      if (!layer) return;
      layer.name = event.target.value.trim().slice(0, 30) || layer.name;
      saveLayers();
      renderLayers();
    });
    row.querySelector('.layer-visibility').addEventListener('click', () => {
      const layer = documentLayers.find(item => item.id === id);
      if (!layer) return;
      layer.visible = !layer.visible;
      saveLayers();
      inkLayers.forEach(ink => ink.redraw());
      renderLayers();
    });
    row.querySelector('.layer-delete').addEventListener('click', () => {
      if (documentLayers.length === 1) return;
      const index = documentLayers.findIndex(item => item.id === id);
      documentLayers.splice(index, 1);
      if (activeLayerId === id) activeLayerId = documentLayers[Math.max(0, index - 1)].id;
      saveLayers();
      inkLayers.forEach(ink => ink.redraw());
      renderLayers();
      toast('图层已移除，原笔迹仍保存在本机');
    });
  });
  target.querySelector('#addLayerButton').addEventListener('click', () => {
    const id = `layer-${Date.now()}`;
    documentLayers.push({ id, name: `图层 ${documentLayers.length + 1}`, visible: true });
    activeLayerId = id;
    saveLayers();
    renderLayers();
  });
}

function addBlankPage() {
  const page = createBlankPage(`notes-${Date.now()}`);
  stack.append(page);
  currentDoc.pages += 1;
  pageNotes = normalizePageNotes(pageNotes, currentDoc.pages);
  mountInkLayers();
  activeInkIndex = currentDoc.pages - 1;
  renderNavigatorView('pages');
  goToPage(activeInkIndex);
  toast('已新增空白笔记页');
}

function refreshNavigatorActiveState() {
  document.querySelectorAll('.page-thumbnail').forEach(card => {
    const active = Number(card.dataset.pageIndex) === activeInkIndex;
    card.classList.toggle('active', active);
    const small = card.querySelector('.thumbnail-info small');
    if (small) small.textContent = active ? '当前页' : '轻点跳转';
  });
}

function renderNavigatorView(view) {
  const searchInput = document.querySelector('#documentSearchInput');
  document.querySelector('#searchCount').textContent = '';
  document.querySelectorAll('[data-panel-tab]').forEach(button => {
    const active = button.dataset.panelTab === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  if (searchInput?.value.trim()) return renderSearchResults(searchInput.value);
  if (view === 'pages') renderPageThumbnails();
  else if (view === 'traces') renderTraces();
  else if (view === 'excerpts') renderExcerpts();
  else renderOutline();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function renderEntry(word, result, status = '') {
  const target = document.querySelector('#lookupResult');
  if (!result) {
    target.innerHTML = `
      <span class="result-kicker">LOOKUP</span><h2>${escapeHtml(word)}</h2>
      <div class="meaning"><p>${status === 'offline' ? '完整词典服务暂时不可用，请确认本地开发服务仍在运行。' : '完整词库中暂未收录这个单词。'}</p></div>`;
    return;
  }
  const meanings = result.meanings || [];
  const definitions = result.definitions || [];
  const tags = result.tags?.length ? result.tags : (result.level ? [result.level] : []);
  const forms = result.forms || [];
  target.innerHTML = `
    <span class="result-kicker">${status === 'loading' ? 'QUICK LOOKUP · 正在读取完整词典' : 'ECDICT · OFFLINE'}</span>
    <div class="word-row"><h2>${escapeHtml(result.word || word)}</h2><button aria-label="播放发音">↗</button></div>
    <p class="phonetic">${escapeHtml(result.phonetic || '')} ${tags.slice(0, 4).map(tag => `<em>${escapeHtml(tag)}</em>`).join('')}</p>
    <div class="meaning">${result.part ? `<b>${escapeHtml(result.part)}</b>` : ''}${meanings.length ? meanings.map(item => `<p>${escapeHtml(item)}</p>`).join('') : '<p>暂无中文释义</p>'}</div>
    ${forms.length ? `<div class="word-forms"><small>词形变化</small><div>${forms.slice(0, 10).map(form => `<span><i>${escapeHtml(form.label)}</i>${escapeHtml(form.value)}</span>`).join('')}</div></div>` : ''}
    ${definitions.length ? `<details class="definitions"><summary>查看英英释义</summary>${definitions.map(item => `<p>${escapeHtml(item)}</p>`).join('')}</details>` : ''}
    <div class="context"><small>查询方式</small><p>完整词典保存在本机，仅按当前单词返回结果，不会把整本词典下载到平板。</p></div>
    <button class="save-word">＋ 加入生词本</button>`;
}

async function showLookup(rawWord) {
  const word = normalizeWord(rawWord);
  if (!word) return;
  closeToolSettings();
  const requestId = ++lookupRequestId;
  const quickResult = lookupWord(word);
  document.querySelector('#lookupEmpty').hidden = true;
  document.querySelector('#panelHeading').hidden = true;
  const target = document.querySelector('#lookupResult');
  target.hidden = false;
  if (quickResult) renderEntry(word, quickResult, 'loading');
  else target.innerHTML = `<div class="lookup-loading"><span></span><p>正在查询完整词典…</p></div>`;
  panel.classList.add('open');
  panel.dataset.view = 'lookup';
  try {
    const completeResult = await lookupCompleteWord(word);
    if (requestId !== lookupRequestId) return;
    renderEntry(word, completeResult || quickResult);
  } catch (error) {
    if (requestId !== lookupRequestId) return;
    console.warn('Dictionary lookup unavailable', error);
    renderEntry(word, quickResult, quickResult ? '' : 'offline');
  }
}

function showSentence(text) {
  closeToolSettings();
  document.querySelector('#lookupEmpty').hidden = true;
  document.querySelector('#panelHeading').hidden = true;
  const target = document.querySelector('#lookupResult');
  target.hidden = false;
  target.innerHTML = `<span class="result-kicker">SELECTION</span><blockquote>${escapeHtml(text)}</blockquote><div class="translation"><small>参考翻译</small><p>${escapeHtml(demoSentenceTranslation(text))}</p></div>`;
  panel.classList.add('open');
  panel.dataset.view = 'lookup';
}

renderSample(stack);
updateMeta({ ...currentDoc, id: 'sample' });

const modeLabels = { ink: '笔', highlight: '荧光笔', eraser: '橡皮', lasso: '套索', lookup: '查词', pan: '浏览' };
renderToolInstances();
applyCommonToolVisibility();
applyMode(toolMode(activeTool()));
showAppView('library');

document.querySelectorAll('[data-app-view]').forEach(button => bindPress(button, () => {
  panel.classList.remove('open'); closeToolSettings(); showAppView(button.dataset.appView);
}));
bindPress(document.querySelector('#newBlankDocument'), createBlankResource);
document.querySelector('#resourceSearch').addEventListener('input', event => renderResourceLibrary(event.target.value));
bindPress(document.querySelector('#createMistakeBookButton'), () => {
  const target = document.querySelector('#mistakeBooksGrid');
  target.insertAdjacentHTML('afterbegin', `<form class="new-book-form" id="newBookForm"><input maxlength="40" placeholder="错题本名称" required autofocus><button>创建</button><button type="button" data-cancel-book>取消</button></form>`);
  const form = target.querySelector('#newBookForm');
  form.querySelector('input').focus();
  form.querySelector('[data-cancel-book]').addEventListener('click', () => form.remove());
  form.addEventListener('submit', event => {
    event.preventDefault(); const result = createMistakeBook(workspaceState, form.querySelector('input').value); workspaceState = result.state; saveWorkspaceState(); renderMistakeLibrary();
  });
});
let clearConfirmUntil = 0;
function runWorkspaceCommand(button) {
  if (!button) return;
  const instance = button.dataset.toolId ? toolInstances.find(item => item.id === button.dataset.toolId) : null;
  if (instance) {
    if (activeToolId === instance.id) openToolSettings(instance);
    else {
      activeToolId = instance.id;
      applyMode(toolMode(instance));
      toast(`已切换到${instance.name}`);
    }
    return;
  }
  if (button.id === 'backLibraryButton') return showAppView('library');
  if (button.id === 'undoButton') {
    const changed = inkLayers[activeInkIndex]?.undo();
    return toast(changed ? '已撤销上一笔' : '当前页没有可撤销的笔迹');
  }
  if (button.id === 'redoButton') {
    const changed = inkLayers[activeInkIndex]?.redo();
    return toast(changed ? '已重做上一笔' : '当前页没有可重做的笔迹');
  }
  if (button.id === 'pagesButton') {
    if (panel.classList.contains('open') && panel.dataset.view === 'pages') panel.classList.remove('open');
    else showPanelView('pages');
    return;
  }
  if (button.id === 'layersButton') return showPanelView('layers');
  if (button.id === 'addToolButton') return openToolPicker();
  if (button.id === 'settingsButton') return showPanelView('toolbar');
  if (button.id === 'timerButton') {
    const popover = document.querySelector('#timerPopover');
    const willOpen = popover.hidden;
    closeToolSettings();
    panel.classList.remove('open');
    popover.hidden = !willOpen;
    button.setAttribute('aria-expanded', String(willOpen));
    renderTimer();
    return;
  }
  if (button.id !== 'clearButton') return;
  if (Date.now() > clearConfirmUntil) {
    clearConfirmUntil = Date.now() + 2600;
    button.classList.add('confirming');
    toast('再点一次，清空整份试卷的笔迹');
    setTimeout(() => button.classList.remove('confirming'), 2700);
    return;
  }
  clearConfirmUntil = 0;
  button.classList.remove('confirming');
  const changed = inkLayers.reduce((count, layer) => count + Number(layer.clear()), 0);
  toast(changed ? '已清空全部笔迹' : '试卷上还没有笔迹');
}

const workspaceToolbar = document.querySelector('.toolrail');
let lastWorkspacePointerActivation = 0;
workspaceToolbar.addEventListener('pointerup', event => {
  if (event.pointerType === 'mouse') return;
  const button = event.target.closest('button');
  if (!button || !workspaceToolbar.contains(button)) return;
  event.preventDefault();
  lastWorkspacePointerActivation = Date.now();
  runWorkspaceCommand(button);
});
workspaceToolbar.addEventListener('click', event => {
  if (Date.now() - lastWorkspacePointerActivation < 500) return;
  const button = event.target.closest('button');
  if (!button || !workspaceToolbar.contains(button)) return;
  runWorkspaceCommand(button);
});

bindPress(document.querySelector('#addPageButton'), addBlankPage);
document.querySelectorAll('[data-panel-tab]').forEach(button => bindPress(button, () => showPanelView(button.dataset.panelTab)));
bindPress(document.querySelector('#closePanel'), () => panel.classList.remove('open'));
document.querySelector('#documentSearchInput').addEventListener('input', () => renderNavigatorView(panel.dataset.view));

function renderTimer() {
  document.querySelector('#timerDisplay').textContent = formatTimer(timerSeconds);
  document.querySelector('#timerStart').textContent = timerInterval ? '暂停' : (timerSeconds === timerPresetSeconds ? '开始' : '继续');
  document.querySelectorAll('[data-timer-minutes]').forEach(button => button.classList.toggle('active', Number(button.dataset.timerMinutes) * 60 === timerPresetSeconds));
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  renderTimer();
}

function toggleTimer() {
  if (timerInterval) return stopTimer();
  if (timerSeconds <= 0) timerSeconds = timerPresetSeconds;
  timerInterval = setInterval(() => {
    timerSeconds = Math.max(0, timerSeconds - 1);
    renderTimer();
    if (!timerSeconds) { stopTimer(); toast('计时结束，请检查答题情况'); }
  }, 1000);
  renderTimer();
}

bindPress(document.querySelector('#closeTimer'), () => {
  document.querySelector('#timerPopover').hidden = true;
  document.querySelector('#timerButton').setAttribute('aria-expanded', 'false');
});
bindPress(document.querySelector('#timerStart'), toggleTimer);
bindPress(document.querySelector('#timerReset'), () => { stopTimer(); timerSeconds = timerPresetSeconds; renderTimer(); });
document.querySelectorAll('[data-timer-minutes]').forEach(button => bindPress(button, () => {
  stopTimer();
  timerPresetSeconds = Number(button.dataset.timerMinutes) * 60;
  timerSeconds = timerPresetSeconds;
  renderTimer();
}));

let editingToolId = activeToolId;
function syncSettings(instance = activeTool(), open = false) {
  const popover = document.querySelector('#toolPopover');
  editingToolId = instance.id;
  document.querySelector('#toolPicker').hidden = true;
  const penSettings = document.querySelector('#instanceSettings');
  const lassoSettings = document.querySelector('#lassoSettings');
  penSettings.hidden = instance.type !== 'pen';
  lassoSettings.hidden = instance.type !== 'lasso';
  document.querySelector('#settingsTitle').textContent = instance.name;
  if (instance.type === 'pen') {
    const style = instance.params;
    document.querySelector('#widthRange').value = style.width;
    document.querySelector('#widthValue').value = Number(style.width).toFixed(1);
    document.querySelector('#opacityRange').value = Math.round(style.opacity * 100);
    document.querySelector('#opacityValue').value = `${Math.round(style.opacity * 100)}%`;
    document.querySelector('#pressureToggle').checked = Boolean(style.pressure);
    document.querySelectorAll('.swatch').forEach(swatch => swatch.classList.toggle('active', swatch.dataset.color === style.color));
  }
  if (instance.type === 'lasso') document.querySelectorAll('[data-lasso-shape]').forEach(button => button.classList.toggle('active', button.dataset.lassoShape === (instance.params.shape || 'rect')));
  if (open) { panel.classList.remove('open'); popover.hidden = false; }
}

function openToolPicker() {
  const popover = document.querySelector('#toolPopover');
  document.querySelector('#settingsTitle').textContent = '添加工具';
  document.querySelector('#instanceSettings').hidden = true;
  document.querySelector('#lassoSettings').hidden = true;
  document.querySelector('#toolPicker').hidden = false;
  const pen = toolDefinition('pen');
  const actions = ['eraser', 'lasso', 'lookup', 'pan'].map(type => toolDefinition(type));
  document.querySelector('#toolTypeGrid').innerHTML = `${pen.subtypes.map(item => `<button data-add-tool="pen" data-add-subtype="${item.id}">${icon(item.icon)}<span>${item.label}</span></button>`).join('')}${actions.map(item => `<button data-add-tool="${item.id}">${icon(item.icon)}<span>${item.label}</span></button>`).join('')}`;
  document.querySelectorAll('[data-add-tool]').forEach(button => bindPress(button, () => {
    const instance = createToolInstance(button.dataset.addTool, { subtype: button.dataset.addSubtype || undefined });
    toolInstances.push(instance); activeToolId = instance.id; saveToolInstances(); renderToolInstances(); applyMode(toolMode(instance));
    if (toolDefinition(instance.type)?.configurable) syncSettings(instance, true); else closeToolSettings();
    toast(`已添加${instance.name}`);
  }));
  popover.hidden = false;
}

bindPress(document.querySelector('#closeSettings'), event => {
  event.stopPropagation();
  closeToolSettings();
});
document.querySelector('#widthRange').addEventListener('input', event => {
  const instance = toolInstances.find(item => item.id === editingToolId);
  if (!instance) return;
  instance.params.width = Number(event.target.value); saveToolInstances();
  document.querySelector('#widthValue').value = Number(event.target.value).toFixed(1);
});
document.querySelector('#opacityRange').addEventListener('input', event => {
  const instance = toolInstances.find(item => item.id === editingToolId);
  if (!instance) return;
  instance.params.opacity = Number(event.target.value) / 100; saveToolInstances();
  document.querySelector('#opacityValue').value = `${event.target.value}%`;
});
document.querySelectorAll('.swatch').forEach(swatch => bindPress(swatch, () => {
  const instance = toolInstances.find(item => item.id === editingToolId);
  if (!instance) return;
  instance.params.color = swatch.dataset.color; saveToolInstances();
  document.querySelectorAll('.swatch').forEach(item => item.classList.toggle('active', item === swatch));
}));
document.querySelector('#pressureToggle').addEventListener('change', event => {
  const instance = toolInstances.find(item => item.id === editingToolId);
  if (instance) { instance.params.pressure = event.target.checked; saveToolInstances(); }
});
document.querySelectorAll('[data-lasso-shape]').forEach(button => bindPress(button, () => {
  const instance = toolInstances.find(item => item.id === editingToolId);
  if (!instance) return;
  instance.params.shape = button.dataset.lassoShape; saveToolInstances(); syncSettings(instance);
}));

let lastLookupActivation = 0;
function lookupFromInput(event, clientX, clientY) {
  if (mode !== 'lookup' || Date.now() - lastLookupActivation < 350) return;
  const selection = selectedText();
  if (isSentenceSelection(selection)) {
    lastLookupActivation = Date.now();
    showSentence(selection.trim());
    return;
  }
  const directWord = wordFromTarget(event.target);
  const word = (/^[A-Za-z]+(?:['-][A-Za-z]+)*$/.test(selection) ? selection : '') || directWord || wordAtPoint(clientX, clientY);
  if (!word) return;
  lastLookupActivation = Date.now();
  showLookup(word);
}
stack.addEventListener('pointerup', event => lookupFromInput(event, event.clientX, event.clientY));
stack.addEventListener('touchend', event => {
  const touch = event.changedTouches?.[0];
  if (touch) lookupFromInput(event, touch.clientX, touch.clientY);
});
stack.addEventListener('click', event => lookupFromInput(event, event.clientX, event.clientY));
stack.addEventListener('dblclick', (event) => {
  if (mode === 'ink') return;
  const selection = selectedText();
  if (isSentenceSelection(selection)) showSentence(selection.trim());
  else showLookup(selection || wordAtPoint(event.clientX, event.clientY));
});

async function importLocalFile(file, input) {
  if (!file) return;
  const saveState = document.querySelector('#saveState');
  saveState.textContent = '正在本地处理…';
  try {
    let doc;
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) doc = await renderPdf(file, stack, message => saveState.textContent = message);
    else if (file.name.toLowerCase().endsWith('.docx')) doc = await renderWord(file, stack);
    else if (file.type.startsWith('image/')) doc = await renderImage(file, stack);
    else throw new Error('当前本地 Demo 暂不支持旧版 .doc，请先另存为 .docx');
    const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    doc = { ...doc, id, tags: [] };
    currentDocumentId = id;
    registerDocument(doc);
    updateMeta(doc);
    showAppView('document');
    saveState.textContent = '仅保存在本机';
    if (doc.failedPages?.length) toast(`试卷已载入，${doc.failedPages.length} 页暂时无法显示`);
    else if (doc.textLayerFallbacks?.length) toast('试卷已显示；当前浏览器暂不能点选部分文字');
    else toast('试卷已载入');
  } catch (error) {
    console.error(error);
    saveState.textContent = '载入失败';
    toast(error.message || '文件载入失败');
  } finally {
    input.value = '';
  }
}

document.querySelectorAll('#fileInput,[data-library-upload]').forEach(input => input.addEventListener('change', event => importLocalFile(event.target.files?.[0], input)));
