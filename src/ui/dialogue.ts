import { t } from '../i18n';

export type DialoguePage = { speaker?: string; place?: string; portrait?: string; text: string };
export type DialogueOptions = { kicker?: string; title?: string; subtitle?: string; backdrop?: string; pages: DialoguePage[]; motion: boolean; onBlip?: () => void };

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

/** Split authored prose into message-box sized pages: paragraphs first, then sentences. */
export function paginate(text: string, limit = 210) {
  const pages: string[] = [];
  for (const paragraph of text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)) {
    if (paragraph.length <= limit) { pages.push(paragraph); continue; }
    let page = '';
    for (const sentence of paragraph.match(/[^.!?。]+[.!?。]+["”']?\s*|[^.!?。]+$/g) ?? [paragraph]) {
      if (page && (page + sentence).length > limit) { pages.push(page.trim()); page = ''; }
      page += sentence;
    }
    if (page.trim()) pages.push(page.trim());
  }
  return pages;
}

/** Plays a JRPG-style scene: optional title card, then typewriter message pages. Resolves when finished or skipped. */
export function playDialogue(host: HTMLElement, options: DialogueOptions): Promise<void> {
  return new Promise(resolve => {
    const scene = document.createElement('section');
    scene.className = 'dialogue-scene';
    scene.setAttribute('role', 'dialog');
    scene.setAttribute('aria-modal', 'true');
    scene.setAttribute('aria-label', options.title ?? t('dialogue.label'));
    scene.innerHTML = `${options.backdrop ? `<img class="dialogue-backdrop" src="${options.backdrop}" alt=""/>` : ''}<div class="dialogue-shade"></div>
      <button class="btn dialogue-skip" type="button">${t('dialogue.skip')} ▶▶</button>
      ${options.title ? `<div class="dialogue-card"><small>${escape(options.kicker ?? '')}</small><h2>${escape(options.title)}</h2>${options.subtitle ? `<p>${escape(options.subtitle)}</p>` : ''}</div>` : ''}
      <div class="dialogue-box msg-window" hidden><div class="dialogue-speaker" hidden><img alt=""/><span><b></b><small></small></span></div><p class="dialogue-text" aria-live="polite"></p><span class="msg-caret" aria-hidden="true">▼</span><span class="dialogue-count"></span></div>`;
    host.append(scene);
    const box = scene.querySelector<HTMLElement>('.dialogue-box')!, card = scene.querySelector<HTMLElement>('.dialogue-card');
    const speaker = scene.querySelector<HTMLElement>('.dialogue-speaker')!, text = scene.querySelector<HTMLElement>('.dialogue-text')!;
    const count = scene.querySelector<HTMLElement>('.dialogue-count')!;
    let index = card ? -1 : 0, shown = 0, timer = 0, done = false, full = '';
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      window.removeEventListener('keydown', onKey, true);
      scene.classList.add('closing');
      window.setTimeout(() => { scene.remove(); resolve(); }, options.motion ? 220 : 0);
    };
    const typing = () => shown < full.length;
    const render = () => {
      if (index < 0) { box.hidden = true; return; }
      if (card) card.classList.add('faded');
      const page = options.pages[index];
      box.hidden = false;
      speaker.hidden = !page.speaker;
      if (page.speaker) {
        const img = speaker.querySelector('img')!;
        img.hidden = !page.portrait;
        if (page.portrait) img.src = page.portrait;
        speaker.querySelector('b')!.textContent = page.speaker;
        speaker.querySelector('small')!.textContent = page.place ?? '';
      }
      full = page.text;
      count.textContent = `${index + 1}/${options.pages.length}`;
      clearInterval(timer);
      if (!options.motion) { shown = full.length; text.textContent = full; box.classList.add('ready'); return; }
      shown = 0; text.textContent = ''; box.classList.remove('ready');
      timer = window.setInterval(() => {
        shown = Math.min(full.length, shown + 2);
        text.textContent = full.slice(0, shown);
        if (shown % 6 === 0) options.onBlip?.();
        if (!typing()) { clearInterval(timer); box.classList.add('ready'); }
      }, 28);
    };
    const advance = () => {
      if (done) return;
      if (index >= 0 && typing()) { clearInterval(timer); shown = full.length; text.textContent = full; box.classList.add('ready'); return; }
      index += 1;
      if (index >= options.pages.length) finish(); else render();
    };
    const onKey = (event: KeyboardEvent) => {
      if (done) return;
      if (['Enter', 'Space', 'KeyZ'].includes(event.code)) { event.preventDefault(); event.stopPropagation(); advance(); }
      else if (event.code === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); }
      else event.stopPropagation();
    };
    scene.addEventListener('click', event => { if ((event.target as HTMLElement).closest('.dialogue-skip')) finish(); else advance(); });
    window.addEventListener('keydown', onKey, true);
    if (!options.pages.length) { finish(); return; }
    render();
    if (card && options.motion) window.setTimeout(() => { if (!done && index < 0) advance(); }, 1800);
    else if (card) advance();
    scene.querySelector<HTMLElement>('.dialogue-skip')!.focus({ preventScroll: true });
  });
}
