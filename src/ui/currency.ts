import { t } from '../i18n';

export function currencyAmount(kind: 'gold' | 'crystal', amount: number): string {
  const value = Math.floor(amount).toLocaleString('en-US');
  const label = kind === 'gold' ? t('currency.gold') : t('currency.crystal');
  const shape = kind === 'gold'
    ? '<path d="M7 2h10l5 5v10l-5 5H7l-5-5V7Z" fill="#ffd75e"/><path d="M9 6h6v12H9z" fill="#a5741e"/>'
    : '<path d="m12 1 9 8-9 14L3 9Z" fill="#b9e8ff"/><path d="m12 1 3 8-3 14-3-14Z" fill="#4f9ed8"/>';
  return `<span class="currency-amount" role="img" aria-label="${label}: ${value}" title="${label}: ${value}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape}</svg><span>${value}</span></span>`;
}
