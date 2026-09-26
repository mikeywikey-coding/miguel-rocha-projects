import tuning from './cap-breaker-tuning.json' with {type:'json'};

const ATTRIBUTE_COUNT=21;
const SCORING_ORDER=[1,4,0,5,6,7,9,8,15,16,11,12,14,13,3,2,17,10,20,19,18];

const floatBuffer=new ArrayBuffer(8);
const float64=new Float64Array(floatBuffer);
const uint32=new Uint32Array(floatBuffer);
const littleEndian=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
const lowWord=Number(!littleEndian);
const highWord=Number(littleEndian);

function validateRatings(values,label='attribute ratings'){
  if(values.length!==ATTRIBUTE_COUNT)throw new RangeError(`Expected ${ATTRIBUTE_COUNT} ${label}, got ${values.length}`);
  for(const value of values){
    if(!Number.isInteger(value)||value<25||value>99)throw new RangeError(`${label} must be integers from 25 through 99, got ${value}`);
  }
}

function adjacentFloat64(value,direction){
  float64[0]=value;
  if((direction>0)===(value>=0)){
    uint32[lowWord]=(uint32[lowWord]+1)>>>0;
    if(uint32[lowWord]===0)uint32[highWord]=(uint32[highWord]+1)>>>0;
  }else{
    if(uint32[lowWord]===0)uint32[highWord]=(uint32[highWord]-1)>>>0;
    uint32[lowWord]=(uint32[lowWord]-1)>>>0;
  }
  return float64[0];
}

function correctedFloat32(value,error){
  if(error===0)return Math.fround(value);
  float64[0]=value;
  const odd=Boolean(uint32[lowWord]&1);
  return Math.fround(odd?value:adjacentFloat64(value,error));
}

function compensatedProductSum(left,right,sum){
  const product=left*right;
  const next=product+sum;
  const recovered=next-product;
  return correctedFloat32(next,product-(next-recovered)+(sum-recovered));
}

function archetypeScore(ratings,weights){
  let weighted=0;
  let total=0;
  for(const index of SCORING_ORDER){
    const weight=Math.fround(weights[index]);
    const curve=Math.fround(tuning.scorerCurves[index][ratings[index]-25]);
    const product=Math.fround(weight*curve);
    weighted=compensatedProductSum(product,ratings[index],weighted);
    total=Math.fround(total+product);
  }
  return Math.max(total===0?0:Math.fround(weighted/total),25);
}

function interpolate(value,range){
  const inputStart=Math.fround(range[0][0]);
  const inputEnd=Math.fround(range[0][1]);
  const outputStart=Math.fround(range[1][0]);
  const outputEnd=Math.fround(range[1][1]);
  const outputSpan=Math.fround(outputEnd-outputStart);
  const inputOffset=Math.fround(value-inputStart);
  const inputSpan=Math.fround(inputEnd-inputStart);
  const scaled=Math.fround(outputSpan*inputOffset);
  return Math.fround(Math.fround(scaled/inputSpan)+outputStart);
}

export function capBreakerArchetype(ratings,height){
  validateRatings(ratings);
  const profiles=tuning.archetypeWeights[height];
  const range=tuning.scorerRanges[height];
  if(!profiles||!range)throw new RangeError(`Unsupported builder height: ${height} inches`);
  const scores=profiles.map(profile=>interpolate(archetypeScore(ratings,profile),range));
  let best=0;
  for(let index=1;index<scores.length;index++)if(scores[index]>scores[best])best=index;
  return best;
}

export function exactBodyCaps(body){
  const packed=tuning.bodyCaps[`${body.height}/${body.weight}/${body.wingspan}`];
  if(!packed)return null;
  return Object.fromEntries(tuning.attributeOrder.map((id,index)=>[id,Number(packed.slice(index*2,index*2+2))]));
}

function roundHalfToEven(value){
  const floor=Math.floor(value);
  const fraction=value-floor;
  const rounded=fraction<0.5?floor:fraction>0.5?floor+1:floor%2===0?floor:floor+1;
  return Object.is(rounded,-0)?0:rounded;
}

function gainScale(rating){
  const delta=350-14*rating;
  const steps=Math.trunc(Math.abs(delta)/74);
  return 15+(delta>=0?steps:-steps);
}

export function exactCapBreakerLadders(ratings,body){
  validateRatings(ratings);
  const caps=exactBodyCaps(body);
  if(!caps)throw new RangeError(`Ceiling table has no body ${body.height}/${body.weight}/${body.wingspan}`);
  const ceilings=tuning.attributeOrder.map(id=>caps[id]);
  validateRatings(ceilings,'attribute ceilings');
  const archetype=capBreakerArchetype(ratings,body.height);
  const weights=tuning.archetypeWeights[body.height][archetype].map(Math.fround);
  const maximumWeight=Math.max(...weights);
  if(maximumWeight===0)throw new RangeError('Cap breaker archetype has zero maximum weight');
  const ladders=ratings.map((rating,index)=>{
    const weightGap=Math.fround(maximumWeight-weights[index]);
    const gains=[0,0,0,0,0];
    let current=rating;
    for(let application=0;application<gains.length&&current<ceilings[index];application++){
      let gain=roundHalfToEven(Math.fround(Math.fround(weightGap*gainScale(current))/maximumWeight));
      gain=Math.max(gain,1);
      if(current+gain>=ceilings[index])gain=ceilings[index]-current;
      gains[application]=gain;
      current+=gain;
    }
    return gains;
  });
  return {archetype,ceilings,ladders,tuningVersion:tuning.tuningVersion};
}

export const capBreakerTuningVersion=tuning.tuningVersion;
