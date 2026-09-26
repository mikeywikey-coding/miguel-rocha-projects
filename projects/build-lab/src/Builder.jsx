import { BodyPlanner } from './BodyPlanner';
import { AttributeCost } from './AttributeCost';
import { BadgeIcon } from './BadgeIcon';
import { CategoryIcon } from './CategoryIcon';
import { badgeDescriptions } from './catalogs/badgeDescriptions';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Basketball, PersonSimpleRun, FloppyDisk, CaretDown, PencilSimple, ArrowCounterClockwise, CheckCircle, CheckSquare, XSquare, Info, X, Plus, Minus, ArrowRight, ShareNetwork, Trash, FolderOpen, LockKeyOpen, LockKey, MagnifyingGlass, Copy, Check, ArrowUUpLeft, Broom } from '@phosphor-icons/react';
import { attributes, groups, byId, baseline, initial, badges, animations, takeovers, formatHeight, clamp, normalizeBuild, eligible, descriptions, changesBetween } from './data';
import { applyAttributeChange } from './engine/dependencies';
import { dependencyRules, rulesetStatus } from './engine/ruleset';
import {editRating,changeBody,buildCaps,overallStatus,minimizeUnlocked,minimizeAttribute,attributeIncreaseCosts} from './engine/buildModel';
import {getBodyLimits} from './engine/gameRules';
import {badgeSummary,badgeEconomy,nextToken,nextBadge,nextBadges,requirementStatus,badgeAvailability} from './catalogs';
import {capProjection,capSequence,capDisplayValue,projectedRatings} from './engine/capProjections';
import { buildUrl, parseBuildLink } from './share';
import { ExportCard } from './ExportCard';
import { toPng } from 'html-to-image';

const STORE = 'build-lab-v1';
// Keep the library in its own stable key so a future draft/schema migration
// cannot discard saved builds. The key is intentionally independent of the
// app version and is written alongside the current draft snapshot.
const SAVED_STORE = 'build-lab-saved-builds';
const takeoverGroups = { Finishing:'fin', Shooting:'sht', Playmaking:'plm', Defense:'def', Rebounding:'reb' };
// In-game three-lane grouping: Finishing/Rebounding, Shooting/Defense, Playmaking/Physicals.
const editorColumns=[['fin','reb'],['sht','def'],['plm','phy']].map(ids=>ids.map(id=>groups.find(group=>group.id===id)));
function TakeoverIcon({ tier }) {
  const groupId=takeoverGroups[tier];
  return groupId ? <CategoryIcon groupId={groupId} className="takeover-icon"/> : <Basketball className="takeover-icon" size={28} weight="fill" aria-label="All disciplines"/>;
}
function boot() {
  let saved = [], current = initial, comparison = baseline, notice = 'Reference adjusted to the captured linked rules. Changes shows the difference.';
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
    const savedRaw = JSON.parse(localStorage.getItem(SAVED_STORE) || 'null');
    if (raw) {
      notice='';
      try { current=normalizeBuild(raw.current); } catch { notice='Could not restore the saved draft. Your saved builds are still available.'; }
      try { comparison=normalizeBuild(raw.comparison); } catch { comparison=structuredClone(current); }
      const savedSnapshots = Array.isArray(raw.saved) && raw.saved.length ? raw.saved : savedRaw?.saved;
      for (const s of Array.isArray(savedSnapshots)?savedSnapshots.slice(0,50):[]) {
        try { saved.push({id:String(s.id),date:String(s.date),build:normalizeBuild(s.build)}); }
        catch { notice='A damaged snapshot could not be restored. Your other saved builds are available.'; }
      }
    } else {
      for (const s of Array.isArray(savedRaw?.saved)?savedRaw.saved.slice(0,50):[]) {
        try { saved.push({id:String(s.id),date:String(s.date),build:normalizeBuild(s.build)}); }
        catch { notice='A damaged snapshot could not be restored. Your other saved builds are available.'; }
      }
      if (saved.length) notice='Saved builds restored. The example build is open.';
    }
  } catch {
    try {
      const savedRaw = JSON.parse(localStorage.getItem(SAVED_STORE) || 'null');
      for (const s of Array.isArray(savedRaw?.saved)?savedRaw.saved.slice(0,50):[]) {
        try { saved.push({id:String(s.id),date:String(s.date),build:normalizeBuild(s.build)}); }
        catch { notice='A damaged snapshot could not be restored. Your other saved builds are available.'; }
      }
      notice = saved.length ? 'Could not restore the saved draft. Your saved builds are still available.' : 'Could not restore the saved draft. The example build is open.';
    } catch { notice = 'Could not restore the saved draft. The example build is open.'; }
  }
  if (location.hash.startsWith('#build=') || new URLSearchParams(location.search).has('b')) {
    try { const incoming=parseBuildLink(location.href); if(JSON.stringify(normalizeBuild(current))!==JSON.stringify(incoming)) { comparison=structuredClone(incoming); notice='Shared build loaded. Save it to keep a local copy.'; } current=incoming; }
    catch { notice = 'This shared build could not be read. Your local draft is still available.'; }
  }
  return { saved, current, comparison, notice };
}
function NumberField({ value, min, max, onCommit, label, className = '', disabled = false }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function commit() { const n = Number(draft); if (draft.trim() && Number.isFinite(n)) { const next = clamp(n, min, max); const accepted=onCommit(next); setDraft(String(typeof accepted==='number'?accepted:next)); } else setDraft(String(value)); }
  return <input disabled={disabled} className={className} type="number" aria-label={label} min={min} max={max} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(String(value)); } }} />;
}
function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className={wide ? 'modal wide' : 'modal'} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={22} /></button></div>{children}
  </dialog>;
}
function BadgeDetail({ item, ratings, body, onSelect }) {
  const tiers=badges.filter(b=>b.badgeId===item.badgeId);
  const caps=buildCaps(body);
  const bodyLimited=tiers.length>0&&badgeAvailability(tiers[0],ratings,body,caps)==='ineligible';
  return <section className={`badge-detail ${bodyLimited?'body-ineligible':''}`} aria-label={`${item.name} badge details`}>
    <header className="badge-detail-heading"><h3>{item.name}</h3><span>{groups.find(g=>g.id===item.group)?.name}</span></header>
    <p className="badge-description">{badgeDescriptions[item.name]||`See how ${item.name} changes across all four creation tiers.`}</p>
    {bodyLimited&&<p className="bronze-unavailable-note"><XSquare size={15} weight="fill"/> Not eligible — this body cannot reach Bronze.</p>}
    <div className="badge-tier-grid">{tiers.map((tier,tierIndex)=>{
      const cumulativeCost=tiers.slice(0,tierIndex+1).reduce((sum,current)=>sum+(current.costs?.[body.height-69]??0),0);
      const met=eligible(tier,ratings,body),heightMet=!tier.height||(body.height>=tier.height[0]&&body.height<=tier.height[1]);
      const availability=badgeAvailability(tier,ratings,body,caps);
      return <button key={tier.id} type="button" className={`badge-tier-card ${met?'met':'locked'}`} data-availability={availability} aria-pressed={item.id===tier.id} onClick={()=>onSelect(tier)}>
        <span className="badge-tier-art"><BadgeIcon badgeId={tier.badgeId} tier={tier.tier}/><b className="badge-tier-cost" aria-label={`${cumulativeCost} cumulative tokens`}>{cumulativeCost}</b></span>
        <span className={`badge-tier-status ${met?'met':'locked'}`}>{met?<CheckSquare size={18} weight="fill"/>:<XSquare size={18} weight="fill"/>}<strong>{tier.tier==='Hall Of Fame'?'HOF':tier.tier}</strong></span>
        <span className="badge-tier-requirements">{tier.requirements.map(([id,value],index)=>{
          const requirementMet=ratings[id]>=value;
          const join=index===0?'':(tier.requirements[index-1]?.[2]==='OR'||tier.mode==='any'?'OR':'AND');
          return <span className="badge-tier-requirement" key={id}>{join&&<small>{join}</small>}<span>{value} {byId[id].name} <em className={requirementMet?'met':'locked'}>({ratings[id]})</em></span></span>;
        })}{!heightMet&&<span className="badge-tier-size">Height {formatHeight(tier.height[0])}–{formatHeight(tier.height[1])}</span>}{availability==='ineligible'&&<span className="unlock-availability">Not eligible</span>}</span>
      </button>;
    })}</div>
    <footer className="badge-detail-legend"><span><CheckSquare weight="fill"/> Met</span><span><XSquare weight="fill"/> Locked</span><span>Circle = cumulative tokens</span></footer>
  </section>;
}
export function Builder() {
  const [loaded] = useState(boot);
  const [build, setBuild] = useState(loaded.current);
  const [comparison, setComparison] = useState(loaded.comparison);
  const [saved, setSaved] = useState(loaded.saved);
  const [renameTarget, setRenameTarget] = useState(null);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState('builder');
  const [tab, setTab] = useState('changes');
  const [unlockType, setUnlockType] = useState('badges');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('dunk');
  const [badgeAttribute,setBadgeAttribute]=useState(null);
  const [badge, setBadge] = useState(badges.find(b=>b.name==='Posterizer'&&b.tier==='Gold'));
  const [compare, setCompare] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(loaded.notice);
  const [name, setName] = useState(build.name);
  const [copied, setCopied] = useState(false);
  const [editorMode,setEditorMode] = useState('combined');
  const [hoverSteppers,setHoverSteppers] = useState(true);
  const [importText,setImportText] = useState('');
  const [importError,setImportError] = useState('');
  const [exportFormat,setExportFormat] = useState('landscape');
  const [exportBusy,setExportBusy] = useState(false);
  const [category,setCategory]=useState('all');
  const [listLimit,setListLimit]=useState(60);
  const exportRef = useRef(null);
  const changes = changesBetween(build, comparison);
  const bodyChanged = JSON.stringify(build.body) !== JSON.stringify(baseline.body);
  const spent = Object.values(build.breakers).reduce((sum, n) => sum + n, 0);
  const caps=useMemo(()=>buildCaps(build.body),[build.body]);
  const bodyLimits=getBodyLimits(build.body);
  const rules=useMemo(()=>typeof dependencyRules==='function'?dependencyRules(build.body.height):dependencyRules,[build.body.height]);
  const overall=useMemo(()=>overallStatus(build,rules),[build,rules]);
  const increaseCosts=useMemo(()=>attributeIncreaseCosts(build,rules),[build.ratings,build.body,build.locks,rules]);
  const projection=useMemo(()=>projectedRatings(build),[build]);
  const economy=useMemo(()=>badgeEconomy(build.ratings,build.body),[build.ratings,build.body]);
  const unlockItems = useMemo(() => {
    if (unlockType !== 'badges') return unlockType === 'animations' ? animations : takeovers;
    const summary=badgeSummary(build.ratings,build.body);
    if (!badgeAttribute) return summary.sort((a,b)=>groups.findIndex(g=>g.id===a.group)-groups.findIndex(g=>g.id===b.group)||a.name.localeCompare(b.name,'en'));
    const related=[...new Map(badges.filter(item=>item.requirements.some(([id])=>id===badgeAttribute)).map(item=>[item.badgeId,item])).values()];
    const included=new Set(summary.map(item=>item.badgeId));
    return [...summary,...related.filter(item=>!included.has(item.badgeId))].sort((a,b)=>groups.findIndex(g=>g.id===a.group)-groups.findIndex(g=>g.id===b.group)||a.name.localeCompare(b.name,'en'));
  },[unlockType,badgeAttribute,build.ratings,build.body]);
  const itemCategory = item => item.group || item.category || item.tier;
  const visibleUnlocks = unlockItems.filter(b => `${b.name} ${b.tier} ${b.category||''}`.toLowerCase().includes(query.toLowerCase()) && (category==='all'||itemCategory(b)===category||isRelatedBadge(b)) && (filter === 'all' || requirementStatus(b,build.ratings,build.body)===filter));
  const showAttributeBadgeDetail=unlockType==='badges'&&badgeAttribute&&category===byId[badgeAttribute].group;
  if(unlockType==='badges'&&badgeAttribute)visibleUnlocks.sort((a,b)=>{
    const related=Number(isRelatedBadge(b))-Number(isRelatedBadge(a));
    if(related)return related;
    if(isRelatedBadge(a)){
      const unmet=Number(requirementStatus(a,build.ratings,build.body)!=='met')-Number(requirementStatus(b,build.ratings,build.body)!=='met');
      if(unmet)return unmet;
    }
    return a.name.localeCompare(b.name,'en');
  });
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify({ current: build, comparison, saved })); localStorage.setItem(SAVED_STORE, JSON.stringify({ version: 1, saved })); } catch { setToast('Browser storage is unavailable. Use Share to keep a copy of this build.'); } }, [build, comparison, saved]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { window.history.replaceState(null,'',buildUrl(build)); },[build]);
  function showAttributeBadges(id) {
    setSelected(id);setBadgeAttribute(id);setTab('unlocks');setUnlockType('badges');
    setCategory(byId[id].group);setQuery('');setFilter('all');setListLimit(60);
    if(badgeAttribute===id&&badge?.badgeId)return;
    const items=badgeSummary(build.ratings,build.body).filter(b=>b.group===byId[id].group).sort((a,b)=>a.name.localeCompare(b.name,'en'));
    const upcoming=nextBadge(id,build.ratings,build.body);
    const related=badges.find(t=>t.badgeId===upcoming?.item?.badgeId)||badges.find(t=>t.requirements.some(([requirement])=>requirement===id));
    if(related||items[0])setBadge(related||items[0]);
  }
  function isRelatedBadge(item) { return unlockType==='badges'&&badgeAttribute&&badges.some(b=>b.badgeId===item.badgeId&&b.requirements.some(r=>r[0]===badgeAttribute)); }
  function requirementText(item) { return item.requirements?.length ? item.requirements.map(([id,value])=>`${value} ${byId[id]?.name||id}`).join(item.mode==='any'?' or ':' + ') : 'No rating requirement'; }
  function sizeText(size) { return ({SMALLS_ONLY:'Small builds',BIGS_ONLY:'Big builds',BIGS_AND_SWINGS:'Bigs and wings',ANY:'All builds'}[size]||size||'Any size'); }
  function renderAnimation(item) {
    const status=requirementStatus(item,build.ratings,build.body);
    const state=status==='met'?'unlocked':status==='locked'?'unavailable':'unverified';
    return <button key={item.id} className={`animation-card animation-${state}`} onClick={()=>setBadge(item)}>
      <span className="animation-card-head"><strong>{item.name}</strong><em>{item.tier}</em></span>
      <span className="animation-requirement">Requires {requirementText(item)}</span>
      <span className="animation-meta">{sizeText(item.size)}{item.season?' · Seasonal':''}</span>
      <span className="animation-status">{state==='unlocked'?'Unlocked':state==='unavailable'?'Unavailable':'Check in game'}</span>
    </button>;
  }
  function update(next) { setHistory(h => [...h.slice(-49), build]); setBuild(next); }
  function setRating(id, n) {
    showAttributeBadges(id);
    const result=editRating(build,id,n,rules);
    if (JSON.stringify(result.build)!==JSON.stringify(build)) { update(result.build); }
    if (result.constrained) {
      const blocked=result.blockedBy?.map(key=>byId[key]?.name).filter(Boolean)||[];
      const direction=n<build.ratings[id]?'lowering':'changing';
      setToast(result.lockLimited&&blocked.length?`${blocked.join(', ')} ${blocked.length===1?'is':'are'} locked and prevent${blocked.length===1?'s':''} ${direction} ${byId[id].name}.`:result.budgetLimited?'The overall budget limits this upgrade. Lower another rating to make room.':'A linked attribute cap limits this rating.');
    }
    return result.build.ratings[id];
  }
  function minimizeRating(id) {
    showAttributeBadges(id);
    const result=minimizeAttribute(build,id,rules);
    if(result.changed){update(result.build);setToast(`${byId[id].name} minimized to ${result.build.ratings[id]}. Locked ratings stayed fixed.`);return;}
    setToast(`${byId[id].name} is already at its lowest value with the current locks.`);
  }
  function setBody(key, value) { const result=changeBody(build,key,value);update(result.build);if(result.releasedLocks?.length)setToast(`Body applied. Cleared ${result.releasedLocks.length} conflicting ${result.releasedLocks.length===1?'lock':'locks'}.`);return result.build.body[key]; }
  function commitSave(next, replaceId=null) { const snapshot={ id:replaceId||crypto.randomUUID(), date:new Date().toISOString(), build:structuredClone(next) }; setSaved(s=>replaceId?s.map(item=>item.id===replaceId?snapshot:item):[snapshot,...s].slice(0,50)); setBuild(next);setComparison(structuredClone(next));setHistory([]);setModal(null);setToast(replaceId?'Saved build replaced.':'Build saved in this browser.'); }
  function saveBuild(e) { e.preventDefault(); const next={...build,name:name.trim()||'Untitled build'}; const duplicate=saved.find(item=>item.build.name.trim().toLocaleLowerCase()===next.name.trim().toLocaleLowerCase()); if(duplicate){setModal({overwrite:duplicate.id,next});return;} commitSave(next); }
  function undo() { if (!history.length) return; setBuild(history.at(-1)); setHistory(history.slice(0, -1)); }
  function minimizeBuild() {
    const result=minimizeUnlocked(build,rules);
    if(result.lockLimited){setToast('The locked ratings conflict with the active linked rules. Adjust a lock before minimizing.');return;}
    if(!result.changed){setToast('Unlocked attributes are already at their lowest legal values.');return;}
    const removed=attributes.reduce((sum,a)=>sum+build.ratings[a.id]-result.build.ratings[a.id],0);
    update(result.build);
    setToast(`Removed ${removed} unused attribute points. Locked ratings stayed fixed.`);
  }
  function breakerLimit(id){return Math.min(capSequence(build,id)?.filter(n=>n>0).length??5,(caps[id]??25)-build.ratings[id]);}
  function breaker(id, delta) { const next = clamp((build.breakers[id] || 0) + delta, 0, breakerLimit(id)); update({ ...build, breakers: { ...build.breakers, [id]: next } }); }
  const shareUrl = buildUrl(build);
  async function exportImage() {
    if(!exportRef.current || exportBusy) return;
    setExportBusy(true);
    try {
      await document.fonts.ready;
      const data=await toPng(exportRef.current,{pixelRatio:1,backgroundColor:'#10171c',preferredFontFormat:'woff2'});
      const link=document.createElement('a'); link.href=data; link.download=`build-lab-${exportFormat}.png`; link.click();
      setToast('Build image downloaded.');
    } catch { setToast('Image export failed. Your build is safe; try again or copy its link.'); }
    finally { setExportBusy(false); }
  }
  function AttributeGroup({ group }) {
    const groupLocked=group.attributes.every(([id])=>build.locks?.[id]);
    return <section key={group.id} className="attribute-group" data-category={group.id} aria-label={group.name}><h2><CategoryIcon groupId={group.id}/>{group.name}<button type="button" className="category-lock" aria-label={`${groupLocked?'Unlock':'Lock'} ${group.name} category`} aria-pressed={groupLocked} title={`${groupLocked?'Unlock':'Lock'} all ${group.name} attributes`} onClick={()=>{const locks={...build.locks};if(groupLocked)group.attributes.forEach(([id])=>delete locks[id]);else group.attributes.forEach(([id])=>{locks[id]=true;});update({...build,locks});}}>{groupLocked?<LockKey size={14} weight="fill"/>:<LockKeyOpen size={14}/>}</button></h2>
      {group.attributes.map(([id]) => { const a = byId[id], value = build.ratings[id], cap = caps[id]??25, delta = value - comparison.ratings[id]; const target=nextBadges(id,build.ratings,build.body),token=nextToken(id,value,build.body); const budgetBlocked=!overall.available.includes(id)&&(value>=cap||overall.overall>=98);
      const showHint = true; const capResult=capProjection(build,id),gains=capResult.gains,estimated=capResult.confidence==='fallback',selectedGain=gains.slice(0,build.breakers[id]||0).reduce((sum,n)=>sum+n,0),displayCap=capDisplayValue(build,id);
        return <div key={id} className={`attribute-row ${selected === id ? 'selected' : ''} ${build.locks?.[id]?'attribute-locked':''} ${budgetBlocked?'attribute-budget-blocked':''} ${overall.overall===99?'attribute-overall-complete':''}`} onClick={e=>{if(!e.target.closest('.attribute-name,.attribute-lock,.attribute-hint,.bar-cap-steps'))showAttributeBadges(id);}} onFocus={e => { if(e.target.matches(':focus-visible'))setSelected(id); }}>
          <div className="attribute-main"><div className="attribute-label">{editorMode!=='caps'&&<button type="button" className="attribute-lock" aria-label={`${build.locks?.[id]?'Unlock':'Lock'} ${a.name}`} aria-pressed={!!build.locks?.[id]} title={build.locks?.[id]?'Unlock rating':'Lock rating'} onClick={()=>{const locks={...build.locks};if(locks[id])delete locks[id];else locks[id]=true;update({...build,locks});}}>{build.locks?.[id]?<LockKey size={16} weight="fill"/>:<LockKeyOpen size={16}/>}</button>}<button className="attribute-name" onClick={() => showAttributeBadges(id)}>{a.name}</button></div>
            <span className={`delta ${delta > 0 ? 'positive' : 'negative'}`}>{compare && delta !== 0 ? `${delta > 0 ? '+' : ''}${delta}` : ''}</span>
            <NumberField disabled={editorMode==='caps'||!!build.locks?.[id]} label={`${a.name} rating`} value={value} min={25} max={cap} onCommit={v => setRating(id, v)} className="rating" />
            <div className="slider-wrap"><div className="slider-track"><span style={{ width: `${cap===25?0:(value - 25) / (cap - 25) * 100}%` }} /></div><input type="range" aria-label={`${a.name} slider`} min="25" max={cap} disabled={cap===25||!!build.locks?.[id]} value={value} onPointerDown={() => showAttributeBadges(id)} onChange={e => setRating(id, Number(e.target.value))} /></div>
            <span className={`cap ${cap>a.cap?'cap-up':cap<a.cap?'cap-down':''}`} title={caps[id]===null?'No sourced cap for Standing Dunk below 6′1″':'Body attribute ceiling'}>{caps[id]??'?'}</span>
            {editorMode!=='attributes' && <div className="bar-cap-steps" aria-label={`${a.name} cap breakers`}>{Array.from({length:5},(_,i)=><button key={i} className={estimated?'estimated-cap-step':''} aria-label={`${a.name} cap allocation ${i+1}`} aria-pressed={(build.breakers[id]||0)>i} title={`${estimated?'Estimated c':'C'}ap breaker ${i+1}: +${gains[i]}`} disabled={i>=breakerLimit(id)} onClick={()=>{showAttributeBadges(id);const count=(build.breakers[id]||0)===i+1?0:i+1;breaker(id,count-(build.breakers[id]||0));}}><span className="cap-step-value">{gains[i]>0?`+${gains[i]}`:<LockKey size={10}/>}</span></button>)}<span className={`bar-cap-total ${estimated?'estimated-cap-value':''}`} title={`${estimated?'Estimated n':'N'}ew cap after selected breakers`}><span className="cap-step-value">{displayCap}</span></span>{editorMode==='caps'&&<span className={`bar-cap-gain ${estimated?'estimated-cap-value':''}`} title={`${estimated?'Estimated s':'S'}elected cap gain`}>+{selectedGain}</span>}<span className="reset-breakers-slot">{build.breakers[id]>0&&<button className="reset-attribute-breakers" aria-label={`Reset all ${a.name} cap breakers`} title={`Reset all ${a.name} cap breakers`} onClick={()=>breaker(id,-build.breakers[id])}><ArrowCounterClockwise size={14}/></button>}</span></div>}
            <div className="row-stepper"><button aria-label={`Decrease ${a.name}`} disabled={value === 25||!!build.locks?.[id]} onClick={() => setRating(id, value - 1)}><Minus size={12}/></button><button className="minimize-attribute" aria-label={`Minimize ${a.name}`} title={`Minimize ${a.name}`} disabled={value === 25||!!build.locks?.[id]} onClick={() => minimizeRating(id)}><Broom size={12}/></button><button aria-label={`Increase ${a.name}`} title={budgetBlocked?'No overall room for another point':undefined} disabled={value === cap||!!build.locks?.[id]||budgetBlocked} onClick={() => setRating(id, value + 1)}><Plus size={12}/></button></div>
          </div>
          {showHint && <div className="attribute-hint"><button onClick={()=>target&&setBadge(target.items[0])}>{target?<>Next unlock: {target.rating} {target.items.map(item=>`${item.name} · ${item.tier}`).join(', ')}</>:'No next badge threshold'}</button>{token&&<span className="next-token">+{token.gains.reduce((n,v)=>n+v,0)} token at {token.rating}</span>}</div>}

        </div>;
      })}
    </section>;
  }
  return <div className={`app-shell ${hoverSteppers?'':'always-steppers'} mode-${editorMode}`}>
    <header className="topbar"><a className="wordmark" href="#" onClick={e => { e.preventDefault(); setView('builder'); }}>BUILD LAB</a><span className="game-label">NBA <b>2K27</b></span>
      <nav aria-label="Main navigation"><button className={view === 'builder' ? 'active' : ''} onClick={() => setView('builder')}>Builder</button><button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')}>Saved builds{saved.length > 0 && <span className="nav-count">{saved.length}</span>}</button><button className="mobile-nav-action" onClick={() => setModal('caps')}>Cap breakers</button><button className="mobile-nav-action" onClick={() => setModal('share')}>Share</button></nav>
      <div className="header-actions"><button className="cap-button" onClick={() => setModal('caps')}>Cap breakers <span className="count">{spent}</span><CaretDown size={14}/></button><button className="icon-button share-top" aria-label="Share build" onClick={() => setModal('share')}><ShareNetwork size={20}/></button><button className="primary save-button" onClick={() => { setName(build.name); setModal('save'); }}>Save build <FloppyDisk size={20}/></button></div>
    </header>
    {view === 'builder' ? <main className="workspace"><section className="editor" aria-label="Build editor">
      <div className="editor-toolbar"><div role="group" aria-label="Editor view">{[['combined','Combined'],['caps','Cap breakers']].map(([id,label])=><button key={id} aria-pressed={editorMode===id} className={editorMode===id?'active':''} onClick={()=>setEditorMode(id)}>{label}</button>)}</div>{editorMode==='caps'&&<div className="cap-usage">TOTAL CAP BREAKERS USED: <strong>{spent}</strong></div>}<label className="hover-toggle"><input type="checkbox" checked={hoverSteppers} onChange={e=>setHoverSteppers(e.target.checked)}/>+/- on hover</label><button className="toolbar-minimize" aria-label="Minimize unlocked attributes" title="Lower unlocked attributes as far as the linked rules allow" onClick={minimizeBuild}><Broom size={14}/>Minimize unlocked</button><button className="toolbar-reset-locks" disabled={!Object.keys(build.locks||{}).length} onClick={()=>{update({...build,locks:{}});setToast('All attribute locks cleared.');}}>Reset locks</button><button className="toolbar-reset" onClick={()=>setModal('reset')}>Reset build</button></div>
      <div className="build-title"><button onClick={() => { setName(build.name); setModal('rename'); }}><h1>{build.name}</h1><PencilSimple size={17}/></button><span className="preview-tag">PREVIEW</span></div>
      <button className="body-planner-launch secondary" onClick={()=>setModal('body')}><PersonSimpleRun size={18}/>Body &amp; badge potential</button><div className="body-controls" role="button" tabIndex={0} aria-label="Open body and badge potential" onClick={()=>setModal('body')} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setModal('body');}}}><label>Position<span className="body-summary-value">{build.body.position}</span></label>
        <label>Height<span className="body-summary-value">{formatHeight(build.body.height)}</span></label>
        <label>Weight<span className="body-summary-value">{build.body.weight} <small>lbs</small></span></label>
        <label>Wingspan<span className="body-summary-value">{formatHeight(build.body.wingspan)}</span></label>
      </div>
      {projection.estimated&&<p className="body-notice">Cap-breaker data is unavailable for this body, so a safe fallback is shown.</p>}<button className="dependency-status" onClick={()=>setModal('rules')}><Info size={14}/>Linked rules active · Aug 22 snapshot · source differences</button>
      <div className="token-strip" aria-label="Badge tokens and slots">{groups.map((g,i)=><button key={g.id} data-category={g.id} onClick={()=>{setTab('unlocks');setUnlockType('badges');setCategory(g.id);setQuery('');}} title={`${g.name}: ${economy.tokens[i]} tokens, ${economy.slots[i]} slots`}><CategoryIcon groupId={g.id}/><strong>{economy.tokens[i]}<small> / {economy.slots[i]}</small></strong></button>)}<span className="token-legend">TOKENS / SLOTS<strong className="slot-total">{economy.totalSlots} total slots</strong></span></div>
      {editorMode==='combined'&&<AttributeCost id={selected} costs={increaseCosts}/>}
      <div className="attribute-columns">{editorColumns.map((column,index)=><div key={index}>{column.map(group=>AttributeGroup({group}))}</div>)}</div>
    </section>
    <aside className="inspector" aria-label="Build inspector"><div className="inspector-tabs" role="tablist" aria-label="Inspector"><button role="tab" aria-selected={tab === 'unlocks'} className={tab === 'unlocks' ? 'active' : ''} onClick={() => setTab('unlocks')}>Unlocks</button><button role="tab" aria-selected={tab === 'overview'} className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button><button role="tab" aria-selected={tab === 'changes'} className={tab === 'changes' ? 'active' : ''} onClick={() => setTab('changes')}>Changes{changes.length > 0 && <span>{changes.length}</span>}</button></div>
      {tab === 'overview' ? <div className="inspector-content overview-content"><div className="overview-summary"><div className="overview-stat"><strong>{overall.overBudget?'OVER':overall.overall}</strong><span>Overall</span></div><div className="overview-stat"><strong>{spent}</strong><span>Cap breakers</span></div><div className="overview-stat"><strong>{overall.available.length}</strong><span>Can grow</span></div></div><div className="overview-body"><span>{build.body.position}</span><span>{formatHeight(build.body.height)}</span><span>{build.body.weight} lbs</span><span>{formatHeight(build.body.wingspan)} wingspan</span></div><div className="overview-columns-label"><span>Attribute</span><span>Now</span><span>Ceiling</span><span>CB</span></div><div className="overview-groups">{groups.map(group=><section className="overview-group" key={group.id}><h3><CategoryIcon groupId={group.id}/>{group.name}</h3>{group.attributes.map(([id])=>{const a=byId[id],value=build.ratings[id],cap=caps[id]??25,locked=!!build.locks?.[id],limited=!overall.available.includes(id)&&(value>=cap||overall.overall>=98);return <button type="button" className={`overview-row ${locked?'locked':''} ${limited?'budget-limited':''}`} key={id} onClick={()=>showAttributeBadges(id)}><span>{a.name}</span><strong className="current">{value}</strong><span className="ceiling">/{cap}</span><span className="overview-gain">{build.breakers[id]?`+${build.breakers[id]}`:'-'}</span></button>})}</section>)}</div></div> : tab === 'changes' ? <div className="inspector-content">{compare ? <><p className="comparison-label">Compared with saved build <span>· {changes.length} {changes.length === 1 ? 'change' : 'changes'}</span></p>
        {changes.length ? <div className="change-list">{changes.map(change => <div className="change-row" key={change.id}><div><strong>{change.name}</strong><span className="old-value">{change.before}</span><ArrowRight size={17}/><span className={change.delta < 0 ? 'negative' : 'positive'}>{change.after}</span><span className={`change-delta ${change.delta < 0 ? 'negative' : 'positive'}`}>{typeof change.delta === 'number' ? `${change.delta > 0 ? '+' : ''}${change.delta}` : ''}</span></div>{descriptions[change.id] && <p>{descriptions[change.id]}</p>}</div>)}</div> : <div className="empty-state compact"><CheckCircle size={34}/><h3>All caught up</h3><p>Adjust an attribute to see how your build changes.</p></div>}</> : <div className="empty-state compact"><ArrowRight size={34}/><h3>Comparison is off</h3><p>Turn on Compare to saved build to see every difference.</p><button className="primary" onClick={() => setCompare(true)}>Show comparison</button></div>}
        <BadgeDetail item={badge} ratings={build.ratings} body={build.body} onSelect={setBadge}/>
      </div> : <div className="inspector-content"><div className="badge-cost-heading"><span className="badge-cost-kicker">BADGE COST</span><span className="badge-cost-context">Select an attribute to inspect related unlocks</span></div><div className="subtabs" aria-label="Unlock type">{['badges', 'animations', 'takeovers'].map(t => <button key={t} className={unlockType === t ? 'active' : ''} onClick={() => { setUnlockType(t); setQuery('');setCategory('all');setListLimit(60); }}>{t}</button>)}</div>
        <div className="unlock-search"><MagnifyingGlass size={17}/><input aria-label="Search unlocks" placeholder="Find an unlock…" value={query} onChange={e => {setQuery(e.target.value);setListLimit(60);}}/><select aria-label="Unlock status" value={filter} onChange={e => {setFilter(e.target.value);setListLimit(60);}}><option value="all">All</option><option value="met">Met</option><option value="locked">Not met</option><option value="unknown">Check in game</option></select></div>
        <select className="category-filter" aria-label="Unlock category" value={category} onChange={e=>{setCategory(e.target.value);setBadgeAttribute(null);setListLimit(60);}}><option value="all">All categories</option>{[...new Set(unlockItems.map(itemCategory))].map(g=><option key={g} value={g}>{groups.find(x=>x.id===g)?.name||g}</option>)}</select>
        
        {showAttributeBadgeDetail&&<BadgeDetail item={badge} ratings={build.ratings} body={build.body} onSelect={setBadge}/>}<div className={`unlock-list ${unlockType==='animations'?'animation-catalog':''}`}>{unlockType==='animations' ? visibleUnlocks.slice(0,listLimit).map(renderAnimation) : visibleUnlocks.slice(0,listLimit).map(item => { const status=requirementStatus(item,build.ratings,build.body); const unavailable=unlockType==='badges'&&status==='locked'; const bodyLimited=unavailable&&badgeAvailability(item,build.ratings,build.body,caps)==='ineligible'; return <button key={item.id} className={`unlock-row ${badge.id === item.id ? 'chosen' : ''} ${isRelatedBadge(item)?'attribute-related':''} ${unavailable?'badge-unavailable':''}`} data-related={isRelatedBadge(item)?'true':undefined} data-eligible={unavailable?'false':'true'} data-body-eligible={bodyLimited?'false':'true'} onClick={() => setBadge(item)}>{unlockType==='takeovers'?<TakeoverIcon tier={item.tier}/>:<BadgeIcon badgeId={item.badgeId} tier={item.tier}/>}<span><strong>{item.name}</strong><small>{item.tier}{isRelatedBadge(item)&&<em className="related-badge-label">Uses {byId[badgeAttribute].name}</em>}{item.season?' · Seasonal':''}{bodyLimited&&<em className="unlock-availability">Not eligible</em>}</small></span>{status==='unknown'?<Info className="muted" size={20} aria-label="Check size or availability in game"/>:eligible(item, build.ratings,build.body) ? <CheckCircle className="positive" size={20}/> : <LockKey className="muted" size={18}/>}</button>; })}{!visibleUnlocks.length && <p className="empty-state">No matching unlocks.</p>}{visibleUnlocks.length>listLimit&&<button className="secondary show-more" onClick={()=>setListLimit(n=>n+60)}>Show more ({visibleUnlocks.length-listLimit} remaining)</button>}</div>{unlockType!=='animations'&&!showAttributeBadgeDetail&&<BadgeDetail item={badge} ratings={build.ratings} body={build.body} onSelect={setBadge}/>}
      </div>}
    </aside></main> : <main className="saved-page"><div className="saved-heading"><div><span className="eyebrow">YOUR PLAYBOOK</span><h1>Saved builds</h1><p>Keep your ideas. Compare the details. Find your build.</p></div><button className="secondary" onClick={() => setView('builder')}><ArrowUUpLeft size={18}/>Back to builder</button></div>
      {saved.length ? <div className="saved-list">{saved.map(s => <article key={s.id}><div className="saved-build-icon"><Basketball size={26}/></div><div className="saved-info"><h2>{s.build.name}</h2><p>{s.build.body.position} · {formatHeight(s.build.body.height)} · {s.build.body.weight} lbs · {formatHeight(s.build.body.wingspan)} wingspan</p><small>{new Date(s.date).toLocaleDateString()} · Saved in this browser</small></div><button className="secondary" onClick={() => { setComparison(structuredClone(s.build)); setView('builder'); setTab('changes'); setCompare(true); setToast(`Comparing your draft with ${s.build.name}.`); }}>Compare</button><button className="secondary" aria-label={`Rename ${s.build.name}`} onClick={() => {setName(s.build.name);setRenameTarget(s.id);setModal('rename-saved');}}><PencilSimple size={17}/>Rename</button><button className="primary" onClick={() => { update(structuredClone(s.build)); setComparison(structuredClone(s.build)); setView('builder'); setToast('Saved build loaded. Your previous draft is available with Undo.'); }}>Open <FolderOpen size={18}/></button><button className="icon-button" aria-label={`Delete ${s.build.name}`} onClick={() => setModal({ delete: s.id })}><Trash size={18}/></button></article>)}</div> : <div className="empty-state library-empty"><FolderOpen size={50} weight="thin"/><h2>Your next build starts here.</h2><p>Save your first build to return to it or compare new ideas.</p><button className="primary" onClick={() => setView('builder')}>Open builder <ArrowRight size={18}/></button></div>}
    </main>}
    <footer className={`bottom-bar ${overall.overall===99?'overall-99':''}`}><div className="save-status"><span className={changes.length ? 'status-dot pending' : 'status-dot'}/><span><b>{changes.length}</b> unsaved {changes.length === 1 ? 'change' : 'changes'}</span></div><button className={`rules-status overall-status ${overall.overBudget?'negative':''}`} onClick={() => setModal('rules')}><span className="overall-meter" aria-hidden="true"><i style={{width:`clamp(0px, ${overall.complete ? 100 : (overall.detailed / 99 * 100)}%, 100%)`}}/></span><strong className="overall-value">{overall.overBudget?'OVER BUDGET':`${overall.overall} OVR`}</strong><span>·</span>{overall.overBudget?'Lower ratings to fit':overall.violations.length?'Linked adjustment needed':overall.complete?'Build complete':`${overall.available.length} attributes can grow`}<Info size={16}/></button><div className="footer-actions"><button className="icon-button" aria-label="Undo last change" disabled={!history.length} onClick={undo}><ArrowUUpLeft size={21}/></button><button className="secondary revert-button" disabled={!changes.length} onClick={() => setModal('revert')}><ArrowCounterClockwise size={20}/>Revert changes</button><button className="compare-toggle" role="switch" aria-checked={compare} onClick={() => { const next=!compare; setCompare(next); if(next)setTab('changes'); }} title={compare?'Hide saved-build comparison':'Show saved-build comparison'}>Compare to saved build<span className={`switch ${compare ? 'on' : ''}`}><span/></span></button></div></footer>
    {toast && <div className="toast" role="status"><CheckCircle size={19}/>{toast}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15}/></button></div>}
    {modal === 'save' && <Modal title="Save your build" onClose={() => setModal(null)}><form onSubmit={saveBuild}><p className="muted">Create a snapshot you can return to and compare against.</p><label className="form-label">Build name<input autoFocus maxLength={60} required value={name} onChange={e => setName(e.target.value)} /></label><p className="form-help">Stored in this browser. Use Share to keep a portable copy.</p><div className="modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>Cancel</button><button className="primary" type="submit">Save build <FloppyDisk size={18}/></button></div></form></Modal>}
    {modal?.overwrite && <Modal title="Replace saved build?" onClose={() => setModal(null)}><p className="muted">A saved build already uses this name. Replace it with your current build, or go back and choose another name.</p><div className="modal-actions"><button className="secondary" onClick={()=>setModal('save')}>Choose another name</button><button className="primary" onClick={()=>commitSave(modal.next,modal.overwrite)}>Replace build</button></div></Modal>}
    {modal === 'rename' && <Modal title="Name your build" onClose={() => setModal(null)}><form onSubmit={e => { e.preventDefault(); update({ ...build, name: name.trim() || 'Untitled build' }); setModal(null); }}><label className="form-label">Build name<input autoFocus required maxLength={60} value={name} onChange={e => setName(e.target.value)}/></label><div className="modal-actions"><button className="primary">Update name</button></div></form></Modal>}
    {modal === 'rename-saved' && <Modal title="Rename saved build" onClose={() => {setModal(null);setRenameTarget(null);}}><form onSubmit={e => {e.preventDefault();const nextName=name.trim()||'Untitled build';const duplicate=saved.find(item=>item.id!==renameTarget&&item.build.name.trim().toLocaleLowerCase()===nextName.toLocaleLowerCase());if(duplicate){setToast('A saved build already uses that name. Choose a different name.');return;}setSaved(items=>items.map(item=>item.id===renameTarget?{...item,build:{...item.build,name:nextName}}:item));setRenameTarget(null);setModal(null);setToast('Saved build renamed.');}}><label className="form-label">Build name<input autoFocus required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>{setModal(null);setRenameTarget(null);}}>Cancel</button><button className="primary">Update name</button></div></form></Modal>}
    {modal === 'share' && <Modal title="Share your build" onClose={() => { setModal(null); setCopied(false); }}><p className="muted">This link includes your body settings, attributes, and planned cap breakers. Open it to load a copy.</p>{['localhost', '127.0.0.1'].includes(location.hostname) && <p className="form-help">Local preview: this link works on this device while the app is running. Sharing with other people requires hosting.</p>}<label className="form-label">Build link<textarea readOnly aria-label="Build link" value={shareUrl} onFocus={e => e.target.select()} /></label><div className="modal-actions"><button className="secondary" onClick={()=>{setModal('import');setImportError('');}}>Import a build</button><button className="primary" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); setCopied(true); } catch { setToast('Copy unavailable. Select the link above and copy it manually.'); } }}>{copied ? <Check size={18}/> : <Copy size={18}/>} {copied ? 'Copied' : 'Copy link'}</button></div><div className="image-export"><h3>Download a build image</h3><label>Image format<select aria-label="Image format" value={exportFormat} onChange={e=>setExportFormat(e.target.value)}><option value="landscape">X · 1200 × 675</option><option value="portrait">Instagram · 1080 × 1350</option></select></label><button className="secondary" disabled={exportBusy} onClick={exportImage}>{exportBusy?'Creating image…':'Download PNG'}</button></div></Modal>}
    {modal==='import' && <Modal title="Import a build" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();try { const incoming=parseBuildLink(importText);update(incoming);setModal(null);setView('builder');setToast('Build imported. Body limits apply; Undo restores the previous draft.'); } catch(error){setImportError(error.message);} }}><p className="muted">Paste a Build Lab link or an original Locker Codes builder link. Values outside the legal body ranges and body caps will be limited.</p><label className="form-label">Build link<textarea autoFocus required value={importText} onChange={e=>setImportText(e.target.value)}/></label>{importError && <p className="negative" role="alert">{importError}</p>}<div className="modal-actions"><button className="primary">Import build</button></div></form></Modal>}
    {modal==='reset' && <Modal title="Reset all attributes?" onClose={()=>setModal(null)}><p className="muted">Set every attribute to 25, clear cap breakers, and remove all rating locks. Your body settings and saved builds stay available. Undo restores this draft.</p><div className="modal-actions"><button className="secondary" onClick={()=>setModal(null)}>Cancel</button><button className="primary" onClick={()=>{update({...build,ratings:Object.fromEntries(attributes.map(a=>[a.id,25])),breakers:{},locks:{}});setModal(null);setToast('All attributes and locks reset.');}}>Reset attributes</button></div></Modal>}
    {modal === 'rules' && <Modal title="Rules and sources" onClose={() => setModal(null)}><div className="rules-copy">{overall.violations.length>0&&<div className="rules-adjustment"><p>Your reference spread differs from this rules snapshot: {overall.violations.map(v=>`${byId[v.source].name} requires ${v.minimum} ${byId[v.target].name}`).join('; ')}. Apply the captured rules to lower dependent ratings into a consistent spread.</p><button className="secondary" onClick={()=>{setBody('height',build.body.height);setModal(null);}}>Apply captured rules</button></div>}<p><strong>Linked attributes, body caps, overall pricing, badge tokens and badge slots are active.</strong> Calculations use the captured NBA 2K27 rules and the current Locker Codes builder engine.</p><p>Body caps now use the complete table for every supported height, weight and wingspan. Edits show every linked adjustment.</p><p>The catalog contains all 53 badges and four creation tiers, 2,914 animation entries, and 24 public takeovers. Animation size ranges are checked where verified; other size and seasonal conditions are shown for confirmation in game.</p><p><strong>Cap breakers:</strong> each build is assigned one of 15 player profiles from all 21 ratings. The selected profile, current rating and body ceiling determine every cap-breaker step. The supplied in-game builds and shared reference build are covered by regression checks.</p><p><strong>Badge economy:</strong> token totals use the exact position, height, attribute and rating table. All six slot categories use the recovered 20-slot allocation formula.</p><p>The zero-delta Speed With Ball link remains unresolved. Overall is reproduced from the captured tuning and may change after a live-game update.</p></div><div className="modal-actions"><button className="primary" onClick={() => setModal(null)}>Got it</button></div></Modal>}
    {modal === 'body' && <Modal title="Body & badge potential" wide onClose={()=>setModal(null)}><BodyPlanner build={build} onCancel={()=>setModal(null)} onApply={body=>{const result=changeBody(build,body);if(JSON.stringify(result.build)!==JSON.stringify(build))update(result.build);if(result.releasedLocks?.length)setToast(`Body applied. Cleared ${result.releasedLocks.length} conflicting ${result.releasedLocks.length===1?'lock':'locks'}.`);setModal(null);return '';}}/></Modal>}
    {modal === 'caps' && <Modal title="Cap breakers" wide onClose={() => setModal(null)}><p className="muted">Plan up to five applications per attribute within its exact body ceiling.</p><div className="caps-total">{spent} planned <span>{projection.estimated?'Fallback data in use':'Exact projection'}</span></div><div className="caps-list">{attributes.map(a => {const result=capProjection(build,a.id),estimated=result.confidence==='fallback';return <div key={a.id} onClick={()=>showAttributeBadges(a.id)}><span>{a.name}<small className={estimated?'estimated-cap-value':''}>Base {build.ratings[a.id]} <ArrowRight size={12}/> {projection.ratings[a.id]} · body cap {caps[a.id]??'?'}<br/>{result.gains.map(n=>n>0?`+${n}`:'—').join(' / ')} {estimated?'· fallback':''}</small></span><button className="icon-button" aria-label={`Remove ${a.name} cap breaker`} disabled={!build.breakers[a.id]} onClick={() => breaker(a.id, -1)}><Minus size={17}/></button><b>{build.breakers[a.id] || 0}</b><button className="icon-button" aria-label={`Add ${a.name} cap breaker`} disabled={(build.breakers[a.id] || 0) >= breakerLimit(a.id)} onClick={() => breaker(a.id, 1)}><Plus size={17}/></button></div>;})}</div><div className="modal-actions"><button className="primary" onClick={() => setModal(null)}>Done</button></div></Modal>}
    {modal === 'revert' && <Modal title="Revert your changes?" onClose={() => setModal(null)}><p className="muted">Restore the build you are comparing against. You can undo this action.</p><div className="modal-actions"><button className="secondary" onClick={() => setModal(null)}>Keep editing</button><button className="primary" onClick={() => { update(structuredClone(comparison)); setModal(null); }}>Revert changes</button></div></Modal>}
    {modal?.delete && <Modal title="Delete saved build?" onClose={() => setModal(null)}><p className="muted">This removes the saved snapshot from this browser. Your current draft stays open.</p><div className="modal-actions"><button className="secondary" onClick={() => setModal(null)}>Cancel</button><button className="danger-button" onClick={() => { setSaved(s => s.filter(x => x.id !== modal.delete)); setModal(null); setToast('Saved snapshot deleted.'); }}>Delete snapshot</button></div></Modal>}
    <ExportCard ref={exportRef} build={build} format={exportFormat}/>
  </div>;
}



