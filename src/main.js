import './styles.css';
import '@phosphor-icons/web/regular';
import html2canvas from 'html2canvas';
import { createBlankPage, renderSample, renderPdf, renderWord, renderImage } from './documents.js';
import { createInkLayer } from './ink.js';
import { lookupWord, lookupCompleteWord, demoSentenceTranslation, normalizeWord } from './dictionary.js';
import { selectedText, wordAtPoint, wordFromTarget, isSentenceSelection } from './selection.js';
import { bookmarkStorageKey, headingLevel, normalizeBookmarkIndexes } from './navigation.js';
import { formatTimer, layerStorageKey, mistakeStorageKey, normalizeLayers, normalizePageNotes, noteStorageKey } from './study.js';

const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="纸上词间首页"><span class="brand-mark">P<span>／</span>L</span><span><b>纸上词间</b><small>PAPERLINGO</small></span></a>
      <div class="doc-title"><span class="status-dot"></span><span id="docTitle">阅读练习 · Ways of Seeing</span><small id="saveState">仅保存在本机</small></div>
      <label class="upload-button"><input id="fileInput" type="file" accept=".pdf,.doc,.docx,image/png,image/jpeg" hidden><span>＋</span> 上传试卷</label>
    </header>

    <main class="workspace">
      <nav class="toolrail" aria-label="试卷工具">
        <div class="tool-group history-group">
          <button class="tool icon-only" id="pagesButton" aria-label="页面缩略图">${icon('squares-four')}</button>
          <button class="tool icon-only" id="undoButton" aria-label="撤销">${icon('arrow-u-up-left')}</button>
          <button class="tool icon-only" id="redoButton" aria-label="重做">${icon('arrow-u-up-right')}</button>
        </div>
        <i class="rail-divider"></i>
        <div class="tool-group mode-group">
          <button class="tool active" data-mode="ink">${icon('pen-nib')}<span>钢笔</span></button>
          <button class="tool" data-mode="highlight">${icon('highlighter')}<span>荧光笔</span></button>
          <button class="tool" data-mode="eraser">${icon('eraser')}<span>橡皮</span></button>
          <button class="tool" data-mode="lasso">${icon('selection')}<span>套索</span></button>
          <button class="tool lookup-tool" data-mode="lookup">${icon('translate')}<span>查词</span></button>
          <button class="tool" data-mode="pan">${icon('hand')}<span>浏览</span></button>
        </div>
        <i class="rail-divider"></i>
        <div class="tool-group utility-group">
          <button class="tool utility-action" id="layersButton" aria-label="管理图层">${icon('stack')}<span>图层</span></button>
          <button class="tool utility-action" id="mistakesButton" aria-label="打开错题本">${icon('notebook')}<span>错题本</span></button>
          <button class="tool utility-action" id="timerButton" aria-label="考试计时器" aria-controls="timerPopover" aria-expanded="false">${icon('timer')}<span>计时</span></button>
          <button class="tool utility-action" id="settingsButton" aria-label="笔刷设置" aria-controls="toolPopover" aria-expanded="false" title="调整当前笔的粗细、浓度和颜色">${icon('sliders-horizontal')}<span>笔刷</span></button>
          <button class="tool utility-action clear-tool" id="clearButton" aria-label="清空全部标注" title="清空整份试卷的手写标注">${icon('trash')}<span>清空全部</span></button>
        </div>
      </nav>

      <section class="tool-popover" id="toolPopover" hidden aria-label="笔刷设置">
        <header><div><span>笔刷设置</span><strong id="settingsTitle">钢笔</strong></div><button id="closeSettings" aria-label="关闭">${icon('x')}</button></header>
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
            <button data-panel-tab="bookmarks" role="tab">${icon('bookmark-simple')}<b>书签</b></button>
            <button data-panel-tab="notes" role="tab">${icon('notepad')}<b>笔记</b></button>
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
    </main>
    <div class="toast" id="toast"></div>
  </div>`;

let mode = 'ink';
let inkLayers = [];
let activeInkIndex = 0;
const toolStyles = {
  ink: { color: '#173c36', width: 2.4, opacity: 1 },
  highlight: { color: '#e2ef78', width: 16, opacity: .32 }
};
let currentDoc = { type: 'sample', pages: 1, title: '阅读练习 · Ways of Seeing' };
let lookupRequestId = 0;
let pageBookmarks = new Set();
let pageNotes = {};
let documentLayers = [{ id: 'layer-1', name: '图层 1', visible: true }];
let activeLayerId = 'layer-1';
let mistakes = [];
let pageObserver = null;
let timerSeconds = 45 * 60;
let timerPresetSeconds = timerSeconds;
let timerInterval = null;
const stack = document.querySelector('#paperStack');
const panel = document.querySelector('#lookupPanel');

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function applyMode(nextMode) {
  mode = nextMode;
  document.body.dataset.mode = mode;
  document.querySelectorAll('button[data-mode]').forEach(button => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  stack.querySelectorAll('.ink-layer').forEach(canvas => canvas.style.pointerEvents = ['ink', 'highlight', 'eraser'].includes(mode) ? 'auto' : 'none');
  stack.querySelectorAll('.lasso-layer').forEach(layer => layer.style.pointerEvents = mode === 'lasso' ? 'auto' : 'none');
  stack.querySelectorAll('.selectable-content').forEach(layer => layer.style.pointerEvents = mode === 'lookup' ? 'auto' : 'none');
  document.querySelector('#settingsButton').classList.toggle('available', ['ink', 'highlight'].includes(mode));
  if (!['ink', 'highlight'].includes(mode)) closeToolSettings();
}

function saveLayers() {
  try { localStorage.setItem(layerStorageKey(currentDoc.title), JSON.stringify(documentLayers)); }
  catch { toast('当前浏览器无法保存图层设置'); }
}

function loadLayers() {
  try { return normalizeLayers(JSON.parse(localStorage.getItem(layerStorageKey(currentDoc.title)) || '[]')); }
  catch { return normalizeLayers([]); }
}

function loadMistakes() {
  try {
    const value = JSON.parse(localStorage.getItem(mistakeStorageKey(currentDoc.title)) || '[]');
    return Array.isArray(value) ? value.filter(item => item?.image).slice(0, 24) : [];
  } catch { return []; }
}

function saveMistakes() {
  try { localStorage.setItem(mistakeStorageKey(currentDoc.title), JSON.stringify(mistakes.slice(0, 24))); return true; }
  catch { toast('错题截图较多，当前浏览器本地空间不足'); return false; }
}

async function captureMistake(page, pageIndex, rect) {
  toast('正在生成错题截图…');
  try {
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
    const maxWidth = 520;
    const output = document.createElement('canvas');
    const ratio = Math.min(1, maxWidth / sw);
    output.width = Math.max(1, Math.round(sw * ratio));
    output.height = Math.max(1, Math.round(sh * ratio));
    output.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, output.width, output.height);
    mistakes.unshift({ id: `mistake-${Date.now()}`, pageIndex, createdAt: Date.now(), image: output.toDataURL('image/jpeg', .76) });
    if (!saveMistakes()) mistakes.shift();
    else {
      toast('已加入错题本');
      if (panel.dataset.view === 'mistakes') renderMistakes();
    }
  } catch (error) {
    console.warn('Mistake capture failed', error);
    toast('截图失败，请缩小选区后重试');
  }
}

function mountLassoLayer(page, pageIndex) {
  page.querySelector('.lasso-layer')?.remove();
  const layer = document.createElement('div');
  layer.className = 'lasso-layer';
  layer.setAttribute('aria-label', '套索截图区域');
  page.append(layer);
  let start = null;
  let selection = null;
  layer.addEventListener('pointerdown', event => {
    event.preventDefault();
    layer.setPointerCapture?.(event.pointerId);
    const bounds = layer.getBoundingClientRect();
    start = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    selection = document.createElement('span');
    selection.className = 'lasso-selection';
    layer.replaceChildren(selection);
  });
  layer.addEventListener('pointermove', event => {
    if (!start || !selection) return;
    const bounds = layer.getBoundingClientRect();
    const x = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    const y = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
    Object.assign(selection.style, { left: `${Math.min(start.x, x)}px`, top: `${Math.min(start.y, y)}px`, width: `${Math.abs(x - start.x)}px`, height: `${Math.abs(y - start.y)}px` });
  });
  layer.addEventListener('pointerup', event => {
    if (!start || !selection) return;
    const rect = selection.getBoundingClientRect();
    start = null;
    if (rect.width >= 36 && rect.height >= 28) captureMistake(page, pageIndex, rect);
    else toast('请框选一个更大的题目区域');
    selection.remove();
    selection = null;
  });
}

function closeToolSettings() {
  document.querySelector('#toolPopover').hidden = true;
  document.querySelector('#settingsButton').setAttribute('aria-expanded', 'false');
}

function openToolSettings() {
  syncSettings(true);
  document.querySelector('#settingsButton').setAttribute('aria-expanded', 'true');
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
      mode, ...(toolStyles[mode] || {}), layerId: activeLayerId,
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
  currentDoc = doc;
  document.querySelector('#docTitle').textContent = doc.title;
  pageBookmarks = loadBookmarks();
  pageNotes = loadNotes();
  documentLayers = loadLayers();
  activeLayerId = documentLayers[0].id;
  mistakes = loadMistakes();
  mountInkLayers();
  if (isNavigatorView(panel.dataset.view)) renderNavigatorView(panel.dataset.view);
}

function isNavigatorView(view) {
  return ['pages', 'bookmarks', 'notes', 'outline'].includes(view);
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
  document.querySelector('#specialPanelHeading').hidden = !['layers', 'mistakes'].includes(view);
  document.querySelector('#lookupEmpty').hidden = true;
  document.querySelector('#lookupResult').hidden = false;
  if (isNavigatorView(view)) renderNavigatorView(view);
  else if (view === 'layers') renderLayers();
  else if (view === 'mistakes') renderMistakes();
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

function collectOutlineItems() {
  const pages = [...stack.querySelectorAll('.paper-page')];
  const seen = new Set();
  return pages.flatMap((page, pageIndex) => [...page.querySelectorAll('h1,h2,h3,h4,h5,h6,[class*="heading"]')]
    .map(element => ({ label: element.textContent.replace(/\s+/g, ' ').trim(), level: headingLevel(element), pageIndex }))
    .filter(item => item.label.length >= 2 && item.label.length <= 100 && !seen.has(`${item.pageIndex}:${item.label}`) && seen.add(`${item.pageIndex}:${item.label}`)));
}

function renderOutline() {
  const target = document.querySelector('#lookupResult');
  const items = collectOutlineItems();
  if (!items.length) {
    target.innerHTML = `<div class="navigator-empty">${icon('list-dashes')}<strong>没有识别到大纲</strong><p>带有标题样式的 Word 文档会在这里自动生成目录。</p></div>`;
    return;
  }
  target.innerHTML = `<ol class="outline-list">${items.map(item => `<li style="--level:${Math.min(item.level, 4)}"><button data-outline-page="${item.pageIndex}"><span>${escapeHtml(item.label)}</span><small>${item.pageIndex + 1}</small></button></li>`).join('')}</ol>`;
  target.querySelectorAll('[data-outline-page]').forEach(button => button.addEventListener('click', () => goToPage(Number(button.dataset.outlinePage))));
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

function renderNotes() {
  const target = document.querySelector('#lookupResult');
  const saved = Object.entries(pageNotes).filter(([, note]) => note.trim()).sort((a, b) => Number(a[0]) - Number(b[0]));
  target.innerHTML = `<div class="page-note-editor">
    <div><span>当前页</span><strong>第 ${activeInkIndex + 1} 页</strong></div>
    <textarea id="pageNoteInput" maxlength="8000" placeholder="记录易错点、解题思路或待复习内容…">${escapeHtml(pageNotes[activeInkIndex] || '')}</textarea>
    <small>自动保存在本机</small>
  </div>
  <div class="saved-notes"><header><strong>已有笔记</strong><span>${saved.length}</span></header>
    ${saved.length ? saved.map(([index, note]) => `<button data-note-page="${index}"><b>第 ${Number(index) + 1} 页</b><span>${escapeHtml(note.slice(0, 70))}</span></button>`).join('') : `<p>还没有笔记。先在上方记录当前页的易错点。</p>`}
  </div>`;
  const input = target.querySelector('#pageNoteInput');
  input?.addEventListener('input', () => {
    const value = input.value;
    if (value.trim()) pageNotes[activeInkIndex] = value;
    else delete pageNotes[activeInkIndex];
    saveNotes();
  });
  target.querySelectorAll('[data-note-page]').forEach(button => button.addEventListener('click', () => {
    goToPage(Number(button.dataset.notePage));
    renderNotes();
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

function renderMistakes() {
  const heading = document.querySelector('#specialPanelHeading');
  heading.innerHTML = `<span>复习整理</span><strong>错题本</strong><p>选择“套索”，框住页面中的题目区域即可收进这里。</p>`;
  const target = document.querySelector('#lookupResult');
  if (!mistakes.length) {
    target.innerHTML = `<div class="navigator-empty">${icon('selection')}<strong>还没有错题截图</strong><p>关闭面板，选择套索工具并框选一道题。</p><button id="startLassoButton">开始框选</button></div>`;
    target.querySelector('#startLassoButton').addEventListener('click', () => { panel.classList.remove('open'); applyMode('lasso'); });
    return;
  }
  target.innerHTML = `<div class="mistake-list">${mistakes.map(item => `<article><img src="${item.image}" alt="第 ${Number(item.pageIndex) + 1} 页的错题截图"><div><strong>第 ${Number(item.pageIndex) + 1} 页</strong><small>${new Date(item.createdAt).toLocaleDateString('zh-CN')}</small><button data-mistake-page="${item.pageIndex}">回到原页</button></div></article>`).join('')}</div>`;
  target.querySelectorAll('[data-mistake-page]').forEach(button => button.addEventListener('click', () => goToPage(Number(button.dataset.mistakePage))));
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
  else if (view === 'bookmarks') renderPageThumbnails([...pageBookmarks]);
  else if (view === 'notes') renderNotes();
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
updateMeta(currentDoc);
applyMode('ink');

function bindPress(element, handler) {
  let lastTouch = 0;
  element.addEventListener('touchend', event => {
    event.preventDefault();
    lastTouch = Date.now();
    handler(event);
  }, { passive: false });
  element.addEventListener('click', event => {
    if (Date.now() - lastTouch > 500) handler(event);
  });
}

const modeLabels = { ink: '钢笔', highlight: '荧光笔', eraser: '橡皮', lasso: '套索', lookup: '查词', pan: '浏览' };
document.querySelectorAll('button[data-mode]').forEach(button => {
  bindPress(button, () => {
    const nextMode = button.dataset.mode;
    closeToolSettings();
    applyMode(nextMode);
    toast(`已切换到${modeLabels[nextMode]}模式`);
  });
});
bindPress(document.querySelector('#undoButton'), () => {
  const changed = inkLayers[activeInkIndex]?.undo();
  toast(changed ? '已撤销上一笔' : '当前页没有可撤销的笔迹');
});
bindPress(document.querySelector('#redoButton'), () => {
  const changed = inkLayers[activeInkIndex]?.redo();
  toast(changed ? '已重做上一笔' : '当前页没有可重做的笔迹');
});
let clearConfirmUntil = 0;
bindPress(document.querySelector('#clearButton'), () => {
  const button = document.querySelector('#clearButton');
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
});
bindPress(document.querySelector('#pagesButton'), () => {
  if (panel.classList.contains('open') && panel.dataset.view === 'pages') panel.classList.remove('open');
  else showPanelView('pages');
});
bindPress(document.querySelector('#layersButton'), () => showPanelView('layers'));
bindPress(document.querySelector('#mistakesButton'), () => showPanelView('mistakes'));
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

bindPress(document.querySelector('#timerButton'), () => {
  const popover = document.querySelector('#timerPopover');
  const willOpen = popover.hidden;
  closeToolSettings();
  panel.classList.remove('open');
  popover.hidden = !willOpen;
  document.querySelector('#timerButton').setAttribute('aria-expanded', String(willOpen));
  renderTimer();
});
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

function syncSettings(open = false) {
  const popover = document.querySelector('#toolPopover');
  const currentMode = mode === 'highlight' ? 'highlight' : 'ink';
  const style = toolStyles[currentMode];
  document.querySelector('#settingsTitle').textContent = modeLabels[currentMode];
  document.querySelector('#widthRange').value = style.width;
  document.querySelector('#widthValue').value = style.width.toFixed(1);
  document.querySelector('#opacityRange').value = Math.round(style.opacity * 100);
  document.querySelector('#opacityValue').value = `${Math.round(style.opacity * 100)}%`;
  document.querySelectorAll('.swatch').forEach(swatch => swatch.classList.toggle('active', swatch.dataset.color === style.color));
  if (open) popover.hidden = false;
}
bindPress(document.querySelector('#settingsButton'), () => {
  if (!['ink', 'highlight'].includes(mode)) return toast('请先选择钢笔或荧光笔');
  const popover = document.querySelector('#toolPopover');
  if (popover.hidden) {
    panel.classList.remove('open');
    openToolSettings();
  }
  else closeToolSettings();
});
bindPress(document.querySelector('#closeSettings'), event => {
  event.stopPropagation();
  closeToolSettings();
});
document.querySelector('#widthRange').addEventListener('input', event => {
  const currentMode = mode === 'highlight' ? 'highlight' : 'ink';
  toolStyles[currentMode].width = Number(event.target.value);
  document.querySelector('#widthValue').value = Number(event.target.value).toFixed(1);
});
document.querySelector('#opacityRange').addEventListener('input', event => {
  const currentMode = mode === 'highlight' ? 'highlight' : 'ink';
  toolStyles[currentMode].opacity = Number(event.target.value) / 100;
  document.querySelector('#opacityValue').value = `${event.target.value}%`;
});
document.querySelectorAll('.swatch').forEach(swatch => bindPress(swatch, () => {
  const currentMode = mode === 'highlight' ? 'highlight' : 'ink';
  toolStyles[currentMode].color = swatch.dataset.color;
  document.querySelectorAll('.swatch').forEach(item => item.classList.toggle('active', item === swatch));
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

document.querySelector('#fileInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const saveState = document.querySelector('#saveState');
  saveState.textContent = '正在本地处理…';
  try {
    let doc;
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) doc = await renderPdf(file, stack, message => saveState.textContent = message);
    else if (file.name.toLowerCase().endsWith('.docx')) doc = await renderWord(file, stack);
    else if (file.type.startsWith('image/')) doc = await renderImage(file, stack);
    else throw new Error('当前本地 Demo 暂不支持旧版 .doc，请先另存为 .docx');
    updateMeta(doc);
    saveState.textContent = '仅保存在本机';
    if (doc.failedPages?.length) toast(`试卷已载入，${doc.failedPages.length} 页暂时无法显示`);
    else if (doc.textLayerFallbacks?.length) toast('试卷已显示；当前浏览器暂不能点选部分文字');
    else toast('试卷已载入');
  } catch (error) {
    console.error(error);
    saveState.textContent = '载入失败';
    toast(error.message || '文件载入失败');
  } finally {
    event.target.value = '';
  }
});
