// Source report targets are million VND; actual revenue is already VND.
export function summarizeLevels(rows) {
  const groups = new Map();
  const empty = level => ({level, outletCount: 0, totalTarget: 0, cumulativeTarget: 0, revenue: 0, hasTotal: false, hasPlan: false});
  const total = empty('Total');
  const add = (group, row) => {
    group.outletCount += 1;
    if (row.onList) { group.totalTarget += row.targetTotal * 1e6; group.hasTotal = true; }
    if (row.plan !== null && row.plan !== undefined) { group.cumulativeTarget += row.plan * 1e6; group.hasPlan = true; }
    group.revenue += row.amount;
  };
  const finish = group => ({
    level: group.level,
    outletCount: group.outletCount,
    totalTarget: group.hasTotal ? group.totalTarget : null,
    cumulativeTarget: group.hasPlan ? group.cumulativeTarget : null,
    revenue: group.revenue,
    cumulativeAchievement: group.cumulativeTarget > 0 ? group.revenue / group.cumulativeTarget : null,
    totalAchievement: group.totalTarget > 0 ? group.revenue / group.totalTarget : null,
  });
  for (const row of rows) {
    const level = String(row.level ?? '').trim().toUpperCase() || '—';
    if (!groups.has(level)) groups.set(level, empty(level));
    add(groups.get(level), row); add(total, row);
  }
  const levels = [...groups.values()].sort((a,b) => a.level === b.level ? 0 : a.level === '—' ? 1 : b.level === '—' ? -1 : a.level.localeCompare(b.level, 'en', {numeric:true}));
  return {levels: levels.map(finish), total: finish(total)};
}
