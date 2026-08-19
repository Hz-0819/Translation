import { ensureWebStreams, isReadableStreamError } from './compat.js';

function pageShell(content, id, extraClass = '') {
  const page = document.createElement('article');
  page.className = `paper-page ${extraClass}`;
  page.dataset.pageId = id;
  page.innerHTML = `${content}<canvas class="ink-layer" aria-label="手写区域"></canvas>`;
  return page;
}

export function createBlankPage(id = `notes-${Date.now()}`) {
  const lines = Array.from({ length: 18 }, () => '<i></i>').join('');
  return pageShell(`<div class="blank-note-page selectable-content"><header><span>NOTES</span><strong>自由笔记</strong></header><div class="note-paper-lines">${lines}</div><footer>纸上词间 · 自由笔记</footer></div>`, id, 'blank-page');
}

export function renderSample(container) {
  container.replaceChildren();
  const content = `
    <div class="sample-paper selectable-content">
      <header class="exam-header">
        <div><span class="eyebrow">READING PRACTICE · 01</span><h1>Ways of Seeing</h1></div>
        <div class="score-box">SCORE<br><strong>____ / 20</strong></div>
      </header>
      <div class="student-row"><span>Name</span><i></i><span>Date</span><i></i></div>
      <section>
        <div class="section-label"><b>Part A</b><span>Read the passage and answer the questions.</span></div>
        <p>We often assume that strong opinions are built on complete knowledge. Yet <mark>evidence</mark> can be <mark>compelling</mark> without being complete. From another <mark>perspective</mark>, the same <mark>assumption</mark> may appear <mark>ambiguous</mark>.</p>
        <p>A <mark>resilient</mark> learner does not avoid uncertainty. Instead, they examine the <mark>consequence</mark> of each choice and remain willing to change a <mark>conventional</mark> answer when new information appears.</p>
        <aside class="margin-note">TIP<br>轻点浅绿色单词<br>试试即时查词</aside>
      </section>
      <section class="questions">
        <div class="section-label"><b>1–3</b><span>Choose the best answer.</span></div>
        <p><b>1.</b> What is the main purpose of the passage?</p>
        <label><span>A</span> To prove that all assumptions are wrong.</label>
        <label><span>B</span> To encourage flexible thinking.</label>
        <label><span>C</span> To compare two learning systems.</label>
        <p><b>2.</b> Write one quality of a resilient learner.</p>
        <div class="answer-line"></div><div class="answer-line short"></div>
        <p><b>3.</b> Summarize the passage in one sentence.</p>
        <div class="answer-line"></div><div class="answer-line"></div>
      </section>
      <footer><span>PAPERLINGO SAMPLE</span><span>1 / 1</span></footer>
    </div>`;
  container.append(pageShell(content, 'sample-1', 'sample-page'));
  return { type: 'sample', pages: 1, title: '阅读练习 · Ways of Seeing' };
}

function buildTextLayer(pdfjsLib, page, viewport, container) {
  return page.getTextContent().then(({ items }) => {
    for (const item of items) {
      if (!item.str) continue;
      const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const span = document.createElement('span');
      const fontSize = Math.hypot(transform[2], transform[3]);
      span.textContent = item.str;
      span.style.left = `${transform[4]}px`;
      span.style.top = `${transform[5] - fontSize}px`;
      span.style.fontSize = `${fontSize}px`;
      span.style.fontFamily = 'Georgia, serif';
      container.append(span);
      const measured = span.getBoundingClientRect().width || 1;
      if (item.width) span.style.transform = `scaleX(${(item.width * viewport.scale) / measured})`;
    }
  });
}

export async function renderPdf(file, container, onProgress = () => {}) {
  onProgress('正在载入 PDF 引擎…');
  await ensureWebStreams();
  const [pdfjsLib, workerModule] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
  container.replaceChildren();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({
    data: bytes,
    disableStream: true,
    disableAutoFetch: true,
    useWorkerFetch: false
  }).promise;
  const failedPages = [];
  const textLayerFallbacks = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    let page;
    try {
      onProgress(`正在整理第 ${number} / ${pdf.numPages} 页`);
      const pdfPage = await pdf.getPage(number);
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = 1000 / base.width;
      const viewport = pdfPage.getViewport({ scale });
      page = pageShell('<canvas class="pdf-canvas"></canvas><div class="pdf-text-layer selectable-content"></div>', `pdf-${number}`, 'pdf-page');
      page.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      const canvas = page.querySelector('.pdf-canvas');
      const textLayer = page.querySelector('.pdf-text-layer');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      container.append(page);
      await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      try {
        await buildTextLayer(pdfjsLib, pdfPage, viewport, textLayer);
      } catch (error) {
        if (!isReadableStreamError(error)) throw error;
        textLayerFallbacks.push(number);
        textLayer.replaceChildren();
        textLayer.classList.add('text-layer-unavailable');
        console.warn(`PDF page ${number}: text layer disabled on this browser`, error);
      }
    } catch (error) {
      failedPages.push(number);
      page?.remove();
      const failed = pageShell(`<div class="page-error"><b>第 ${number} 页暂时无法显示</b><span>${isReadableStreamError(error) ? '当前浏览器缺少 PDF 流式读取能力' : '该页包含暂不支持的 PDF 内容'}</span></div>`, `pdf-${number}-failed`, 'pdf-page failed-page');
      container.append(failed);
      console.warn(`PDF page ${number}: render failed`, error);
    }
  }
  if (failedPages.length === pdf.numPages) throw new Error('PDF 的所有页面均无法显示');
  return { type: 'pdf', pages: pdf.numPages, title: file.name, failedPages, textLayerFallbacks };
}

export function wordPageSliceCount(renderedHeight, pageHeight) {
  const content = Number(renderedHeight);
  const page = Number(pageHeight);
  if (!Number.isFinite(content) || !Number.isFinite(page) || page <= 0) return 1;
  return Math.max(1, Math.min(200, Math.ceil((content - 2) / page)));
}

export function wordPageCuts(renderedHeight, pageHeight, boundaries = [], margin = 28, searchRange = 84) {
  const total = Number(renderedHeight);
  const paper = Number(pageHeight);
  const inset = Math.max(0, Number(margin) || 0);
  const usable = paper - inset * 2;
  if (!Number.isFinite(total) || !Number.isFinite(paper) || usable <= 0 || total <= usable) return [0];

  const safeBoundaries = boundaries
    .map(Number)
    .filter(value => Number.isFinite(value) && value > 0 && value < total)
    .sort((a, b) => a - b);
  const cuts = [0];
  while (total - cuts[cuts.length - 1] > usable && cuts.length < 200) {
    const start = cuts[cuts.length - 1];
    const nominal = start + usable;
    const minimum = Math.max(start + usable * 0.72, nominal - searchRange);
    const nearby = safeBoundaries.filter(value => value >= minimum && value <= nominal - 4);
    const next = nearby.length ? nearby[nearby.length - 1] : nominal;
    if (next <= start) break;
    cuts.push(next);
  }
  return cuts;
}

function wordBlockBoundaries(section) {
  const sectionTop = section.getBoundingClientRect().top;
  const root = section.querySelector('article') || section;
  return [...root.children].flatMap(element => {
    const rect = element.getBoundingClientRect();
    return [rect.top - sectionTop, rect.bottom - sectionTop];
  });
}

function wordPageShell(content, id, height) {
  const page = pageShell('', id, 'docx-page');
  if (height) {
    page.style.height = `${height}px`;
    page.style.minHeight = `${height}px`;
  }
  page.insertBefore(content, page.firstChild);
  return page;
}

export async function renderWord(file, container) {
  const { renderAsync: renderDocx } = await import('docx-preview');
  container.replaceChildren();
  const holder = document.createElement('div');
  holder.className = 'docx-measure-stage';
  holder.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;z-index:-1;';
  document.body.append(holder);
  let pageCount = 0;
  try {
    await renderDocx(await file.arrayBuffer(), holder, null, {
      className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: false,
      breakPages: true, ignoreLastRenderedPageBreak: false,
      renderHeaders: true, renderFooters: true
    });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const styleBank = document.createElement('div');
    styleBank.className = 'docx-style-bank';
    styleBank.hidden = true;
    holder.querySelectorAll('style').forEach(style => styleBank.append(style.cloneNode(true)));
    container.append(styleBank);

    const sections = [...holder.querySelectorAll('section.docx')];
    if (!sections.length) {
      holder.removeAttribute('style');
      holder.className = 'docx-host selectable-content';
      holder.classList.add('selectable-content');
      container.append(wordPageShell(holder, 'docx-1'));
      pageCount = 1;
    } else if (sections.length > 1) {
      sections.forEach((section, index) => {
        const height = Math.max(1, section.getBoundingClientRect().height || section.scrollHeight);
        section.classList.add('selectable-content');
        section.parentElement?.removeChild(section);
        container.append(wordPageShell(section, `docx-${index + 1}`, height));
      });
      pageCount = sections.length;
    } else {
      const section = sections[0];
      const computed = getComputedStyle(section);
      const pageHeight = Math.max(1, parseFloat(computed.minHeight) || 1056);
      const renderedHeight = Math.max(section.scrollHeight, section.getBoundingClientRect().height);
      const slices = wordPageSliceCount(renderedHeight, pageHeight);
      if (slices === 1) {
        section.classList.add('selectable-content');
        section.parentElement?.removeChild(section);
        container.append(wordPageShell(section, 'docx-1', pageHeight));
      } else {
        const pageMargin = Math.max(20, Math.min(36, pageHeight * 0.027));
        const cuts = wordPageCuts(renderedHeight, pageHeight, wordBlockBoundaries(section), pageMargin);
        for (let index = 0; index < cuts.length; index += 1) {
          const start = cuts[index];
          const end = cuts[index + 1] ?? renderedHeight;
          const viewport = document.createElement('div');
          viewport.className = 'docx-slice selectable-content';
          viewport.style.height = `${Math.min(end - start, pageHeight - pageMargin * 2)}px`;
          viewport.style.marginTop = `${pageMargin}px`;
          const clone = section.cloneNode(true);
          clone.style.transform = `translateY(-${start}px)`;
          clone.style.transformOrigin = 'top left';
          viewport.append(clone);
          container.append(wordPageShell(viewport, `docx-${index + 1}`, pageHeight));
        }
        pageCount = cuts.length;
      }
      if (slices === 1) pageCount = 1;
    }
  } finally {
    if (holder.isConnected && holder.parentElement === document.body) holder.remove();
  }
  return { type: 'docx', pages: Math.max(1, pageCount), title: file.name };
}

export async function renderImage(file, container) {
  container.replaceChildren();
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
  const page = pageShell(`<img class="uploaded-image" src="${url}" alt="上传的试卷"><div class="ocr-banner">图片已载入 · OCR 接口将在下一阶段接入</div>`, 'image-1', 'image-page');
  page.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
  container.append(page);
  return { type: 'image', pages: 1, title: file.name, objectUrls: [url] };
}

export function classifyDocumentFile(file) {
  const name = String(file?.name || '').toLowerCase();
  if (file?.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (String(file?.type || '').startsWith('image/')) return 'image';
  if (name.endsWith('.doc')) return 'legacy-doc';
  return null;
}

export async function renderLocalFile(file, container, onProgress = () => {}) {
  const type = classifyDocumentFile(file);
  if (type === 'pdf') return renderPdf(file, container, onProgress);
  if (type === 'docx') return renderWord(file, container);
  if (type === 'image') return renderImage(file, container);
  if (type === 'legacy-doc') throw new Error('暂不支持旧版 .doc，请先另存为 .docx');
  throw new Error('暂不支持这种文件格式');
}
