import tuning from './badge-economy-tuning.json' with {type:'json'};

const totalSlots=20;
const blend=Math.fround(0.400000006);
const minimums=[1,1,1,1,1,1];
const maximums=[7,7,7,7,5,6];
const addTiebreak=[2,4,3,1,6,5];
const removeTiebreak=[3,1,2,4,5,6];
const sum=values=>values.reduce((total,value)=>total+value,0);

function nextFloat(value,direction){
  const buffer=new ArrayBuffer(8),float=new Float64Array(buffer),words=new Uint32Array(buffer);
  const littleEndian=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
  const low=littleEndian?0:1,high=littleEndian?1:0;
  float[0]=value;
  if((direction>0)===(value>=0)){
    words[low]=(words[low]+1)>>>0;
    if(words[low]===0)words[high]=(words[high]+1)>>>0;
  }else{
    if(words[low]===0)words[high]=(words[high]-1)>>>0;
    words[low]=(words[low]-1)>>>0;
  }
  return float[0];
}

function roundFloat(value,error){
  if(error===0)return Math.fround(value);
  const buffer=new ArrayBuffer(8),float=new Float64Array(buffer),words=new Uint32Array(buffer);
  const littleEndian=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
  float[0]=value;
  const low=littleEndian?0:1;
  return Math.fround(words[low]&1?value:nextFloat(value,error));
}

function fusedMultiplyAdd(value,multiplier,addend){
  const product=value*multiplier,result=product+addend,tail=result-product;
  return roundFloat(result,product-(result-tail)+(addend-tail));
}

function roundHalfEven(value){
  const floor=Math.floor(value),fraction=value-floor;
  return fraction===0.5?(floor%2===0?floor:floor+1):(fraction<0.5?floor:floor+1);
}

export function tokenContribution(id,rating,body){
  const list=tuning.contributions[`${body.position}:${body.height}:${id}`];
  if(!list)throw new RangeError(`Unsupported badge token table: ${body.position} at ${body.height} inches`);
  let result=[0,0,0,0,0,0];
  for(const [threshold,tokens] of list){if(rating<threshold)break;result=tokens;}
  return result;
}

export function tokenBudget(ratings,body){
  return Object.entries(ratings).reduce((totals,[id,rating])=>totals.map((value,index)=>value+tokenContribution(id,rating,body)[index]),[0,0,0,0,0,0]);
}

export function nextToken(id,rating,body){
  const current=tokenContribution(id,rating,body);
  for(const [threshold,tokens] of tuning.contributions[`${body.position}:${body.height}:${id}`]){
    if(threshold>rating&&tokens.some((value,index)=>value>current[index]))return {rating:threshold,gains:tokens.map((value,index)=>value-current[index])};
  }
  return null;
}

export function allocateBadgeSlots(tokens,badgeCounts){
  if(sum(badgeCounts)===0)return [0,0,0,0,0,0];
  const countTotal=sum(badgeCounts),tokenTotal=sum(tokens);
  const weights=badgeCounts.map((count,index)=>{
    const countShare=Math.fround(Math.fround(count)*Math.fround(1/Math.fround(countTotal)));
    const tokenShare=tokenTotal===0?0:Math.fround(Math.fround(tokens[index])*Math.fround(1/Math.fround(tokenTotal)));
    const countWeight=Math.fround(countShare*Math.fround(1-blend));
    return fusedMultiplyAdd(tokenShare,blend,countWeight);
  });
  const slots=weights.map((weight,index)=>Math.min(Math.max(roundHalfEven(Math.fround(weight*Math.fround(totalSlots))),minimums[index]),Math.min(badgeCounts[index],maximums[index])));
  const addOrder=weights.map((_,index)=>index).sort((a,b)=>weights[b]-weights[a]||addTiebreak[a]-addTiebreak[b]);
  for(const mode of ['both','maximum','none']){
    let changed=true;
    while(sum(slots)<totalSlots&&changed){
      changed=false;
      for(const index of addOrder){
        if(badgeCounts[index]===0)continue;
        if(mode==='both'&&slots[index]>=badgeCounts[index])continue;
        if(mode!=='none'&&slots[index]>=maximums[index])continue;
        slots[index]++;changed=true;
        if(sum(slots)===totalSlots)return slots;
      }
    }
  }
  const removeOrder=weights.map((_,index)=>index).sort((a,b)=>weights[a]-weights[b]||removeTiebreak[a]-removeTiebreak[b]);
  let changed=true;
  while(sum(slots)>totalSlots&&changed){
    changed=false;
    for(const index of removeOrder){
      if(slots[index]>minimums[index]){slots[index]--;changed=true;}
      if(sum(slots)===totalSlots)return slots;
    }
  }
  return slots;
}
