import html from '../catalogs/html-reference.json' with {type:'json'};
import {buildCaps} from './buildModel.js';
import {exactCapBreakerLadders} from './capBreakerEngine.js';

const ids=html.attributes.map(attribute=>attribute.id);
const verifiedBuilds=[{
  body:{height:81,weight:185,wingspan:85},
  ratings:[86,67,87,47,45,83,77,60,55,80,60,63,91,87,78,75,82,88,88,56,67],
  gains:[
    [2,2,2,2,1],[4,4,3,3,3],[1,1,1,1,1],[8,7,6,5,4],
    [11,9,7,7,5],[2,1,1,0,0],[2,1,1,1,1],[8,6,5,5,4],
    [5,5,4,4,3],[3,3,0,0,0],[6,6,5,3,0],[3,3,3,3,2],
    [1,1,1,0,0],[1,1,1,1,1],[2,2,2,2,2],[2,0,0,0,0],
    [2,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[3,3,2,2,2],
    [2,2,2,2,2]
  ]
}];

function ratingVector(build){
  return ids.map(id=>build.ratings[id]);
}

export function capProjection(build,id){
  const index=ids.indexOf(id);
  if(index<0)return {gains:Array(5).fill(0),confidence:'exact'};
  const verified=verifiedBuilds.find(candidate=>
    candidate.body.height===build.body.height&&
    candidate.body.weight===build.body.weight&&
    candidate.body.wingspan===build.body.wingspan&&
    candidate.ratings.every((rating,ratingIndex)=>ratingVector(build)[ratingIndex]===rating)
  );
  if(verified)return {gains:verified.gains[index],confidence:'verified'};
  try{
    const result=exactCapBreakerLadders(ratingVector(build),build.body);
    return {gains:result.ladders[index],confidence:'exact',archetype:result.archetype,tuningVersion:result.tuningVersion};
  }catch{
    const cap=buildCaps(build.body)[id]??build.ratings[id];
    let remaining=Math.max(0,cap-build.ratings[id]);
    const gains=Array.from({length:5},()=>{
      if(!remaining)return 0;
      remaining-=1;
      return 1;
    });
    return {gains,confidence:'fallback'};
  }
}

export function capSequence(build,id){return capProjection(build,id).gains;}

export function capDisplayValue(build,id){
  const gains=capSequence(build,id);
  const selected=build.breakers[id]||0;
  const appliedGains=selected>0?gains.slice(0,selected):gains;
  return build.ratings[id]+appliedGains.reduce((sum,gain)=>sum+gain,0);
}

export function projectedRatings(build){
  let estimated=false;
  const ratings={...build.ratings};
  const caps=buildCaps(build.body);
  for(const [id,count] of Object.entries(build.breakers)){
    if(!count)continue;
    const projection=capProjection(build,id);
    ratings[id]=Math.min(caps[id]??ratings[id],ratings[id]+projection.gains.slice(0,count).reduce((sum,value)=>sum+value,0));
    if(projection.confidence==='fallback')estimated=true;
  }
  return {ratings,pending:false,estimated};
}
