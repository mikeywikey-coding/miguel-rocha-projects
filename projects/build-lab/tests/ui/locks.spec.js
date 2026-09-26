import {test,expect} from '@playwright/test';
test('attribute locks are visible, prevent linked edits, persist, and can be released',async({page})=>{
  await page.goto('/?b=SF.81.185.84.'+Array(21).fill(25).join('-'));
  await expect(page.locator('.attribute-lock')).toHaveCount(21);
  await page.getByRole('button',{name:'Lock Speed',exact:true}).click();
  const speed=page.getByRole('spinbutton',{name:'Speed rating',exact:true});
  await expect(speed).toBeDisabled();
  await expect(speed).toHaveCSS('color','rgb(232, 198, 120)');
  const agility=page.getByRole('spinbutton',{name:'Agility rating',exact:true});
  await agility.fill('83');await agility.press('Enter');
  await expect(speed).toHaveValue('25');
  await expect(agility).toHaveValue('25');
  await page.reload();
  await expect(page.getByRole('button',{name:'Unlock Speed',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(speed).toBeDisabled();
  await page.getByRole('button',{name:'Unlock Speed',exact:true}).click();
  await agility.fill('83');await agility.press('Enter');
  await expect(speed).toHaveValue('73');
  await expect(page.locator('.adjustment-notice')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('minimize unlocked trims every free rating, preserves locks, and undoes atomically',async({page})=>{
  await page.goto('/?b=SF.81.185.84.80-89-90-94-75-60-70-62-70-53-45-83-85-77-88-65-75-75-83-71-73');
  await page.getByRole('button',{name:'Lock Mid-Range Shot',exact:true}).click();
  await page.getByRole('button',{name:'Lock Three-Point Shot',exact:true}).click();
  const mid=page.getByRole('spinbutton',{name:'Mid-Range Shot rating',exact:true});
  const three=page.getByRole('spinbutton',{name:'Three-Point Shot rating',exact:true});
  const free=page.getByRole('spinbutton',{name:'Free Throw rating',exact:true});
  await page.getByRole('button',{name:'Minimize unlocked attributes',exact:true}).click();
  await expect(mid).toHaveValue('60');
  await expect(three).toHaveValue('70');
  expect(Number(await free.inputValue())).toBeLessThan(62);
  await expect(page.getByRole('status')).toContainText('unused attribute points');
  await page.getByRole('button',{name:'Undo last change',exact:true}).click();
  await expect(free).toHaveValue('62');
  await expect(mid).toHaveValue('60');
  await expect(three).toHaveValue('70');
});

test('each attribute has a minimize control that respects locks and undo',async({page})=>{
  await page.goto('/?b=SF.81.185.84.80-89-90-94-75-60-70-62-70-53-45-83-85-77-88-65-75-75-83-71-73');
  await expect(page.locator('.row-stepper button[aria-label^="Minimize "]')).toHaveCount(21);
  const freeRow=page.locator('.attribute-row').filter({has:page.getByRole('spinbutton',{name:'Free Throw rating',exact:true})});
  const minimizeFree=page.locator('button[aria-label="Minimize Free Throw"]');
  const free=page.getByRole('spinbutton',{name:'Free Throw rating',exact:true});
  await freeRow.hover();
  await minimizeFree.click();
  await expect(free).toHaveValue('25');
  await page.getByRole('button',{name:'Undo last change',exact:true}).click();
  await expect(free).toHaveValue('62');
  await page.getByRole('button',{name:'Lock Free Throw',exact:true}).click();
  await expect(minimizeFree).toBeDisabled();
});

test('attribute minimize stops at the lowest value allowed by linked locks',async({page})=>{
  const build={
    name:'Locked rebound floor',
    body:{position:'PG',height:77,weight:197,wingspan:81},
    ratings:{close:77,layup:66,dunk:83,standing:33,post:31,mid:92,three:91,free:67,pass:60,handle:81,swb:86,interior:70,perimeter:82,steal:83,block:62,oreb:47,dreb:70,speed:90,agility:88,strength:60,vertical:83},
    breakers:{dunk:5},
    locks:{swb:true,strength:true,steal:true,perimeter:true,handle:true,interior:true,block:true,dunk:true,vertical:true,mid:true,three:true,agility:true,speed:true},
  };
  await page.goto('/#build='+encodeURIComponent(JSON.stringify(build)));
  const rebound=page.getByRole('spinbutton',{name:'Defensive Rebound rating',exact:true});
  const row=page.locator('.attribute-row').filter({has:rebound});
  await row.hover();
  await page.locator('button[aria-label="Minimize Defensive Rebound"]').click();
  await expect(rebound).toHaveValue('50');
  await expect(page.getByRole('status')).not.toContainText('prevent lowering Defensive Rebound');
});

test('attribute minimize controls sit below sliders instead of covering them',async({page})=>{
  await page.goto('/?b=SF.81.185.84.'+Array(21).fill(60).join('-'));
  const row=page.locator('.attribute-row').filter({has:page.getByRole('spinbutton',{name:'Free Throw rating',exact:true})});
  await row.hover();
  const slider=await row.locator('.slider-wrap').boundingBox();
  const minimize=await row.locator('button[aria-label="Minimize Free Throw"]').boundingBox();
  expect(slider).not.toBeNull();
  expect(minimize).not.toBeNull();
  expect(minimize.y).toBeGreaterThanOrEqual(slider.y+slider.height);
});
