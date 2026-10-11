import { applyRuntimeToDocument, CommanderError, commanderError, createCommanderDocument, materializeProfile, openCommanderRepository, slotForMode, StaleCommanderError, type CommanderDocument, type CommanderErrorCode, type CommanderMode, type CommanderRepository, type RuntimeCommanderContext, type SlotId } from './commander';

export class CommanderSession {
  repository?: CommanderRepository;
  document?: CommanderDocument;
  mode: CommanderMode = 'story';
  /** A save operation is running right now. */
  busy = false;
  stale = false;
  /** Changes not yet committed: a save is queued or in flight, or the last one failed. */
  dirty = false;
  /** The last save failed (or the tab went stale): the changes exist only in this tab until a save succeeds. In-flight saves are dirty but not failed. */
  failed = false;
  /** Code of the last failure ('' when none): the UI shows errorText(code) = t('error.<code>'), never a raw message. */
  error: CommanderErrorCode | 'unknown' | '' = '';
  /** The English message of the last failure, for console logs and bug reports only. */
  errorDetail = '';
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
          this.failed = true;
          this.error = 'stale';
          this.errorDetail = 'Another tab changed this Commander. Export unsaved work, then refresh. This tab is read-only.';
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
    this.failed = false;
    this.error = this.errorDetail = '';
    return materializeProfile(this.document, mode, 'auto');
  }

  async create(name: string, candidate = createCommanderDocument(undefined, name)) {
    if (!this.repository) throw new CommanderError('loading', 'Commander storage is still loading.');
    return this.repository.commit(candidate);
  }

  async commit(candidate: CommanderDocument) {
    if (!this.repository || !this.document || this.stale) throw new StaleCommanderError(this.errorDetail || 'Commander is not writable.');
    const committed = await this.repository.commit(candidate, this.document.revision);
    this.document = committed;
    this.dirty = false;
    this.failed = false;
    this.error = this.errorDetail = '';
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
        // Storage failures keep their code (a DOMException from the browser's storage is 'idb-write', a full disk 'storage-full'); a bug in the save path is 'unknown', not a storage failure.
        const failure = error instanceof CommanderError || error instanceof DOMException ? commanderError(error, 'idb-write') : undefined;
        this.error = failure?.code ?? 'unknown';
        this.errorDetail = failure?.message ?? (error instanceof Error ? error.message : String(error));
        this.stale ||= error instanceof StaleCommanderError;
        this.dirty = true;
        this.failed = true;
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
    if (!this.document || this.dirty || this.stale) throw new CommanderError('unsaved', 'Save or export unsaved work before loading.');
    const slot = slotForMode(this.document, this.mode, slotId);
    if (!slot?.state) throw new CommanderError('slot-empty', 'This slot is empty.');
    if (this.mode !== 'story' && 'runBookmark' in slot.state && slot.state.runBookmark) {
      throw new CommanderError('bookmark-rewind', 'Challenge bookmarks cannot rewind a run. Use Continue latest; completed bookmarks are build previews only.');
    }
    if (this.mode !== 'story' && this.document.encounters?.[this.mode]) throw new CommanderError('run-active', 'Continue or abandon the current run before loading a preset.');
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
