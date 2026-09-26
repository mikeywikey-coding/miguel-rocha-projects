import {normalizeBody} from './engine/gameRules.js';
import {usableCaps,changeBody} from './engine/buildModel.js';
// User-supplied reference ratings and saved-page caps; sourced rules are separate.
export const groups = [
  { id: 'fin', name: 'Finishing', color: '#82c7e3', attributes: [
    ['close', 'Close Shot', 77, 99, '80 Float Game · Silver'],
    ['layup', 'Driving Layup', 68, 98, '70 Layup Mixmaster · Bronze'],
    ['dunk', 'Driving Dunk', 87, 93, '93 Posterizer · Gold'],
    ['standing', 'Standing Dunk', 52, 99, '60 Rise Up · Bronze'],
    ['post', 'Post Control', 40, 98, '55 Hook Specialist · Bronze'],
  ]},
  { id: 'sht', name: 'Shooting', color: '#62e3bc', attributes: [
    ['mid', 'Mid-Range Shot', 87, 89, '88 Quick Trigger · Silver'],
    ['three', 'Three-Point Shot', 78, 86, '83 Limitless Range · Bronze'],
    ['free', 'Free Throw', 62, 95, ''],
  ]},
  { id: 'plm', name: 'Playmaking', color: '#e8c678', attributes: [
    ['pass', 'Pass Accuracy', 70, 99, '77 Break Starter · Silver'],
    ['handle', 'Ball Handle', 70, 80, '71 Handles for Days · Bronze'],
    ['swb', 'Speed With Ball', 70, 75, '75 Lightning Launch · Silver'],
  ]},
  { id: 'def', name: 'Defense', color: '#e8cf8a', attributes: [
    ['interior', 'Interior Defense', 84, 88, '85 Wall Up · Silver'],
    ['perimeter', 'Perimeter Defense', 85, 89, '86 Ankle Braces · Silver'],
    ['steal', 'Steal', 77, 84, '83 Glove · Silver'],
    ['block', 'Block', 88, 91, '92 High-Flying Denier · Hall of Fame'],
  ]},
  { id: 'reb', name: 'Rebounding', color: '#bcb6dd', attributes: [
    ['oreb', 'Offensive Rebound', 70, 78, '80 Crasher · Silver'],
    ['dreb', 'Defensive Rebound', 75, 80, '82 Sync Snatcher · Gold'],
  ]},
  { id: 'phy', name: 'Physicals', color: '#e8c678', attributes: [
    ['speed', 'Speed', 83, 86, '85 Slippery Off-Ball · Gold'],
    ['agility', 'Agility', 83, 86, '85 Work Horse · Gold'],
    ['strength', 'Strength', 71, 75, '74 Post Lockdown · Silver'],
    ['vertical', 'Vertical', 75, 95, '80 Pogo Stick · Gold'],
  ]},
];
export const attributes = groups.flatMap(g => g.attributes.map(([id, name, value, cap, next]) => ({ id, name, value, cap, next, group: g.id })));
export const byId = Object.fromEntries(attributes.map(a => [a.id, a]));
export const baseline = { name: 'Two-way wing', body: { position: 'SF', height: 81, weight: 185, wingspan: 84 }, ratings: Object.fromEntries(attributes.map(a => [a.id, a.value])), breakers: {} };
export const initial = changeBody(baseline,'height',baseline.body.height).build;
export const descriptions = { dunk: 'Finishing at the rim', vertical: 'Leaping and aerial finishes', three: 'Shooting from beyond the arc', post: 'Scoring with your back to the basket' };
export const formatHeight = n => `${Math.floor(n / 12)}′${n % 12}″`;
export const clamp = (n, min, max) => Math.max(min, Math.min(max, Math.round(n)));
export { badges, animations, eligible } from './catalogs/index.js';
export { default as takeovers } from './catalogs/takeovers.json' with {type:'json'};
export function normalizeBuild(value) {
  if (!value || typeof value !== 'object' || !value.ratings || !value.body) throw new Error('Invalid build');
  const num = (v, low, high) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('Invalid rating'); return clamp(v, low, high); };
  const body=normalizeBody({position:value.body.position,height:num(value.body.height,69,88),weight:num(value.body.weight,145,350),wingspan:num(value.body.wingspan,69,99)});
  const caps=usableCaps(body);
  const ratings = Object.fromEntries(attributes.map(a => [a.id, num(value.ratings[a.id], 25,caps[a.id])]));
  const breakers = Object.fromEntries(attributes.map(a => [a.id, num(value.breakers?.[a.id] ?? 0, 0,Math.min(5,caps[a.id]-ratings[a.id]))]));
  const locks=Object.fromEntries(attributes.filter(a=>value.locks?.[a.id]===true).map(a=>[a.id,true]));
  return { ...(Object.keys(locks).length?{locks}:{}), name: typeof value.name === 'string' ? value.name.slice(0, 60) : 'Imported build', ratings, breakers, body};
}
export function changesBetween(current, saved) {
  const rows = attributes.filter(a => current.ratings[a.id] !== saved.ratings[a.id]).map(a => ({ id: a.id, name: a.name, before: saved.ratings[a.id], after: current.ratings[a.id], delta: current.ratings[a.id] - saved.ratings[a.id] }));
  for (const key of ['position', 'height', 'weight', 'wingspan']) if (current.body[key] !== saved.body[key]) rows.push({ id: key, name: key[0].toUpperCase() + key.slice(1), before: ['height', 'wingspan'].includes(key) ? formatHeight(saved.body[key]) : saved.body[key], after: ['height', 'wingspan'].includes(key) ? formatHeight(current.body[key]) : current.body[key] });
  for (const a of attributes) if ((current.breakers[a.id] || 0) !== (saved.breakers[a.id] || 0)) rows.push({ id: `cap-${a.id}`, name: `${a.name} cap breakers`, before: saved.breakers[a.id] || 0, after: current.breakers[a.id] || 0 });
  if (current.name !== saved.name) rows.push({ id: 'name', name: 'Build name', before: saved.name, after: current.name });
  return rows.sort((a, b) => (b.delta || 0) - (a.delta || 0));
}
