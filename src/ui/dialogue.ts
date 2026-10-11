import { t } from '../i18n';

/** A choice on a page: picking it ends the scene with its `value` (after showing `reply`, when given). */
export type DialogueChoice = { value: string; label: string; reply?: string };
/** A message page; `choices` waits for a pick instead of advancing, `card` shows a centred title card instead of the message box. `safeChoice` (default: the last choice) is the
 *  harmless pick a mashed key lands on: it gets the focus when the choices appear, and a key press with no choice focused only moves the focus to it. */
export type DialoguePage = { speaker?: string; place?: string; portrait?: string; text: string; choices?: DialogueChoice[]; safeChoice?: number; card?: { kicker?: string; title: string; subtitle?: string } };
export type DialogueOptions = { kicker?: string; title?: string; subtitle?: string; backdrop?: string; pages: DialoguePage[]; motion: boolean; onBlip?: () => void };

/** Picks made this soon after the choices appear are ignored: a tap or key meant to finish the typing never answers the question. */
export const CHOICE_INPUT_DELAY_MS = 600;
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

/** Plays a JRPG-style scene: optional title card, then typewriter message pages. Resolves when finished or skipped, with the picked choice's value (undefined when none was picked). */
export function playDialogue(host: HTMLElement, options: DialogueOptions): Promise<string | undefined> {
  return new Promise(resolve => {
    const scene = document.createElement('section');
    scene.className = 'dialogue-scene';
    scene.setAttribute('role', 'dialog');
    scene.setAttribute('aria-modal', 'true');
    scene.setAttribute('aria-label', options.title ?? t('dialogue.label'));
    scene.innerHTML = `${options.backdrop ? `<img class="dialogue-backdrop" src="${options.backdrop}" alt=""/>` : ''}<div class="dialogue-shade"></div>
      <button class="btn dialogue-skip" type="button">${t('dialogue.skip')} ▶▶</button>
      ${options.title ? `<div class="dialogue-card"><small>${escape(options.kicker ?? '')}</small><h2>${escape(options.title)}</h2>${options.subtitle ? `<p>${escape(options.subtitle)}</p>` : ''}</div>` : ''}
      <div class="dialogue-box msg-window" hidden><div class="dialogue-speaker" hidden><img alt=""/><span><b></b><small></small></span></div><p class="dialogue-text" aria-live="polite"></p><nav class="dialogue-choices menu-list" hidden></nav><span class="msg-caret" aria-hidden="true">▼</span><span class="dialogue-count"></span></div>
      <div class="dialogue-card dialogue-end" hidden><small></small><h2></h2><p></p></div>`;
    host.append(scene);
    const box = scene.querySelector<HTMLElement>('.dialogue-box')!, card = scene.querySelector<HTMLElement>('.dialogue-card:not(.dialogue-end)');
    const speaker = scene.querySelector<HTMLElement>('.dialogue-speaker')!, text = scene.querySelector<HTMLElement>('.dialogue-text')!;
    const count = scene.querySelector<HTMLElement>('.dialogue-count')!, choices = scene.querySelector<HTMLElement>('.dialogue-choices')!, end = scene.querySelector<HTMLElement>('.dialogue-end')!;
    const pages = [...options.pages];
    let index = card ? -1 : 0, shown = 0, timer = 0, done = false, full = '', picked: string | undefined, choicesAt = 0;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      window.removeEventListener('keydown', onKey, true);
      scene.classList.add('closing');
      window.setTimeout(() => { scene.remove(); resolve(picked); }, options.motion ? 220 : 0);
    };
    const typing = () => shown < full.length;
    const choiceButtons = () => Array.from(choices.querySelectorAll<HTMLButtonElement>('.dialogue-choice'));
    const safeIndex = (page: DialoguePage | undefined) => Math.min(Math.max(0, page?.safeChoice ?? (page?.choices?.length ?? 1) - 1), (page?.choices?.length ?? 1) - 1);
    /** Typing finished: show the caret, or the page's choices (the safe one focused, so a mashed key never commits a real answer). */
    const ready = () => {
      box.classList.add('ready');
      const page = pages[index];
      if (!page?.choices?.length || !choices.hidden) return;
      choices.innerHTML = page.choices.map((choice, i) => `<button class="menu-item dialogue-choice" type="button" data-choice="${i}">${escape(choice.label)}</button>`).join('');
      choices.hidden = false;
      box.classList.add('choosing');
      choicesAt = performance.now();
      choiceButtons()[safeIndex(page)]?.focus({ preventScroll: true });
    };
    const choose = (i: number) => {
      const page = pages[index], choice = page?.choices?.[i];
      if (!choice || done || choices.hidden || performance.now() - choicesAt < CHOICE_INPUT_DELAY_MS) return;
      picked = choice.value;
      if (!choice.reply) { finish(); return; }
      // The reply replaces whatever followed the question.
      pages.splice(index + 1, pages.length, { speaker: page.speaker, place: page.place, portrait: page.portrait, text: choice.reply });
      index += 1;
      render();
    };
    const render = () => {
      if (index < 0) { box.hidden = true; return; }
      if (card) card.classList.add('faded');
      const page = pages[index];
      choices.hidden = true; choices.innerHTML = ''; box.classList.remove('choosing');
      end.hidden = !page.card;
      if (page.card) {
        // A closing title card: no message box, one click (or key) moves on.
        clearInterval(timer); box.hidden = true; full = ''; shown = 0;
        end.querySelector('small')!.textContent = page.card.kicker ?? '';
        end.querySelector('h2')!.textContent = page.card.title;
        end.querySelector('p')!.textContent = page.card.subtitle ?? '';
        return;
      }
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
      count.textContent = `${index + 1}/${pages.length}`;
      clearInterval(timer);
      if (!options.motion) { shown = full.length; text.textContent = full; ready(); return; }
      shown = 0; text.textContent = ''; box.classList.remove('ready');
      timer = window.setInterval(() => {
        shown = Math.min(full.length, shown + 2);
        text.textContent = full.slice(0, shown);
        if (shown % 6 === 0) options.onBlip?.();
        if (!typing()) { clearInterval(timer); ready(); }
      }, 28);
    };
    const advance = () => {
      if (done) return;
      if (index >= 0 && typing()) { clearInterval(timer); shown = full.length; text.textContent = full; ready(); return; }
      // A question waits for a pick (Skip/Escape leaves it unanswered).
      if (index >= 0 && pages[index]?.choices?.length) return;
      index += 1;
      if (index >= pages.length) finish(); else render();
    };
    const onKey = (event: KeyboardEvent) => {
      if (done) return;
      const buttons = choices.hidden ? [] : choiceButtons(), at = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (buttons.length && ['ArrowDown', 'ArrowUp'].includes(event.code)) { event.preventDefault(); event.stopPropagation(); buttons[at < 0 ? safeIndex(pages[index]) : (at + (event.code === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length].focus(); }
      else if (['Enter', 'Space', 'KeyZ'].includes(event.code)) {
        event.preventDefault(); event.stopPropagation();
        // With no choice focused, the key only moves the focus to the safe choice; it never answers for the player.
        if (!buttons.length) advance(); else if (at < 0) buttons[safeIndex(pages[index])]?.focus({ preventScroll: true }); else choose(Number(buttons[at].dataset.choice));
      }
      else if (event.code === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); }
      else event.stopPropagation();
    };
    scene.addEventListener('click', event => {
      const target = event.target as HTMLElement, choice = target.closest<HTMLElement>('.dialogue-choice');
      if (target.closest('.dialogue-skip')) finish(); else if (choice) choose(Number(choice.dataset.choice)); else advance();
    });
    window.addEventListener('keydown', onKey, true);
    if (!pages.length) { finish(); return; }
    // Focus Skip first: a question page rendered right away moves focus on to its first choice.
    scene.querySelector<HTMLElement>('.dialogue-skip')!.focus({ preventScroll: true });
    render();
    if (card && options.motion) window.setTimeout(() => { if (!done && index < 0) advance(); }, 1800);
    else if (card) advance();
  });
}
