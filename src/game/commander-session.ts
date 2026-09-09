import { applyRuntimeToDocument, createCommanderDocument, materializeProfile, openCommanderRepository, slotForMode, StaleCommanderError, type CommanderDocument, type CommanderMode, type CommanderRepository, type RuntimeCommanderContext, type SlotId } from './commander';

export class CommanderSession {
  repository?: CommanderRepository;
  document?: CommanderDocument;
  mode: CommanderMode = 'story';
  busy = false;
  stale = false;
  dirty = false;
  error = '';
  private queue: Promise<unknown> = Promise.resolve();
  private openPromise?: Promise<CommanderDocument[]>;
  onStatus = () => {};

  async open() {
    if (this.repository) return this.repository.list();
    if (this.openPromise) return this.openPromise;
    this.openPromise = (async () => {
      this.repository = await openCommanderRepository();
      this.repository.subscribe(event => {
        if (this.document?.commanderId === event.commanderId && event.revision > this.document.revision) {
          this.stale = true;
          this.error = 'Another tab changed this Commander. Export unsaved work, then refresh. This tab is read-only.';
          this.onStatus();
        }
      });
      return this.repository.list();
    })();
    return this.openPromise;
  }

  select(document: CommanderDocument, mode: CommanderMode = document.activeMode) {
    this.document = structuredClone(document);
    this.mode = mode;
    this.stale = false;
    this.dirty = false;
    this.error = '';
    return materializeProfile(this.document, mode, 'auto');
  }

  async create(name: string, candidate = createCommanderDocument(undefined, name)) {
    if (!this.repository) throw new Error('Commander storage is still loading.');
    return this.repository.commit(candidate);
  }

  async commit(candidate: CommanderDocument) {
    if (!this.repository || !this.document || this.stale) throw new StaleCommanderError(this.error || 'Commander is not writable.');
    const committed = await this.repository.commit(candidate, this.document.revision);
    this.document = committed;
    this.dirty = false;
    this.error = '';
    return committed;
  }

  save(context: RuntimeCommanderContext, edit?: (document: CommanderDocument) => void): Promise<boolean> {
    const frozen = structuredClone(context);
    const owner = this.document?.commanderId;
    this.dirty = true;
    const operation = async () => {
      this.busy = true;
      this.onStatus();
      try {
        if (!this.document || this.document.commanderId !== owner || this.stale) throw new StaleCommanderError();
        const candidate = structuredClone(this.document);
        applyRuntimeToDocument(candidate, frozen);
        edit?.(candidate);
        await this.commit(candidate);
        return true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : String(error);
        this.stale ||= error instanceof StaleCommanderError;
        this.dirty = true;
        return false;
      } finally {
        this.busy = false;
        this.onStatus();
      }
    };
    const next = this.queue.then(operation, operation);
    this.queue = next;
    return next;
  }

  async flush() { await this.queue; return !this.dirty && !this.stale; }

  async loadSlot(slotId: SlotId) {
    await this.flush();
    if (!this.document || this.dirty || this.stale) throw new Error('Save or export unsaved work before loading.');
    const slot = slotForMode(this.document, this.mode, slotId);
    if (!slot?.state) throw new Error('This slot is empty.');
    if (this.mode !== 'story' && 'runBookmark' in slot.state && slot.state.runBookmark) {
      throw new Error('Challenge bookmarks cannot rewind a run. Use Continue latest; completed bookmarks are build previews only.');
    }
    if (this.mode !== 'story' && this.document.encounters?.[this.mode]) throw new Error('Continue or abandon the current run before loading a preset.');
    const candidate = structuredClone(this.document);
    const state = this.mode === 'story' ? candidate.story : this.mode === 'raid' ? candidate.raid : candidate.rogue;
    const source = state.slots.find(slot => slot.slotId === slotId)!;
    state.slots[3] = structuredClone({ ...source, slotId: 'auto' });
    state.activeSlot = 'auto';
    if (this.mode === 'story' && 'gold' in slot.state) {
      candidate.encounters ??= {};
      if (slot.state.encounter) candidate.encounters.story = structuredClone(slot.state.encounter);
      else delete candidate.encounters.story;
    }
    await this.commit(candidate);
    return materializeProfile(candidate, this.mode, 'auto');
  }
}
