import {test,expect} from '@playwright/test';

test('attribute rows use the larger readable type scale without horizontal overflow',async({page})=>{
  await page.goto('/?b=SF.81.185.84.80-89-90-94-75-60-70-62-70-53-45-83-85-77-88-65-75-75-83-71-73');
  const row=page.locator('.attribute-row').first();
  const sizes=await row.evaluate(element=>({
    name:getComputedStyle(element.querySelector('.attribute-name')).fontSize,
    rating:getComputedStyle(element.querySelector('.rating')).fontSize,
    cap:getComputedStyle(element.querySelector('.cap')).fontSize,
    breaker:getComputedStyle(element.querySelector('.bar-cap-steps button')).fontSize,
    hint:getComputedStyle(element.querySelector('.attribute-hint')).fontSize,
  }));
  expect(sizes).toEqual({name:'16px',rating:'19px',cap:'15px',breaker:'14px',hint:'14px'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
