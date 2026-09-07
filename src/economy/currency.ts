export type EconomyMode = 'story' | 'roguelike' | 'raid';
export type CurrencyId = 'gold' | 'crystal' | `material:${string}`;

export type CurrencyState = {
  gold: number;
  materials: Record<string, number>;
  commanderCrystal: number;
};

export function createCurrencyState(): CurrencyState {
  return { gold: 0, materials: {}, commanderCrystal: 0 };
}

function validAmount(amount: number): boolean {
  return Number.isSafeInteger(amount) && amount > 0;
}

function crystalAllowed(mode: EconomyMode): boolean {
  return mode === 'roguelike' || mode === 'raid';
}

export function creditCurrency(state: CurrencyState, mode: EconomyMode, currency: CurrencyId, amount: number): boolean {
  if (!validAmount(amount)) return false;
  if (currency === 'crystal') {
    if (!crystalAllowed(mode)) return false;
    state.commanderCrystal += amount;
    return true;
  }
  if (currency === 'gold') {
    if (mode !== 'story') return false;
    state.gold += amount;
    return true;
  }
  if (!currency.startsWith('material:') || mode !== 'story') return false;
  const id = currency.slice('material:'.length);
  if (!id) return false;
  state.materials[id] = (state.materials[id] ?? 0) + amount;
  return true;
}

export function debitCurrency(state: CurrencyState, mode: EconomyMode, currency: CurrencyId, amount: number): boolean {
  if (!validAmount(amount)) return false;
  if (currency === 'crystal') {
    if (!crystalAllowed(mode) || state.commanderCrystal < amount) return false;
    state.commanderCrystal -= amount;
    return true;
  }
  if (currency === 'gold') {
    if (mode !== 'story' || state.gold < amount) return false;
    state.gold -= amount;
    return true;
  }
  if (!currency.startsWith('material:') || mode !== 'story') return false;
  const id = currency.slice('material:'.length);
  if (!id || (state.materials[id] ?? 0) < amount) return false;
  state.materials[id] -= amount;
  return true;
}

export function runtimeMode(mode: 'adventure' | 'endless' | 'raid'): EconomyMode {
  return mode === 'adventure' ? 'story' : mode === 'endless' ? 'roguelike' : 'raid';
}
