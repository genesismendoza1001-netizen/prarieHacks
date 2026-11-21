const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23'
});
export function iowaTime(isoOrMs) {
  const d = new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid timestamp');
  const parts = Object.fromEntries(fmt.formatToParts(d).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
  return { ...parts, dateKey: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}` };
}
export function seasonForDate(isoOrMs) {
  const { month } = iowaTime(isoOrMs);
  if (month >= 9 && month <= 11) return {
    name: 'Fall harvest / manure application window', kind: 'fall', harvestSeason: true,
    manureOpportunity: month === 10 ? 1 : (month === 11 ? 0.85 : 0.65),
    note: 'Fall manure is often applied after crops are harvested and before fields freeze; actual spreading is not known.'
  };
  if (month >= 3 && month <= 5) return {
    name: 'Spring fieldwork / manure application window', kind: 'spring', harvestSeason: false,
    manureOpportunity: month === 4 ? 0.85 : 0.65,
    note: 'Spring manure application is possible before planting; actual field activity is not known.'
  };
  return { name: month >= 6 && month <= 8 ? 'Growing season' : 'Winter / off-season', kind: 'other',
    harvestSeason: false, manureOpportunity: month >= 6 && month <= 8 ? 0.25 : 0.15,
    note: 'Manure can be handled year-round; this is only a broad seasonal assumption.' };
}
