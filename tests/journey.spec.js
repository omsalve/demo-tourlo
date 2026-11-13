import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
test('guided visit resumes after confirmed lead save and compares saved homes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let fail=true;const payloads=[];
 await page.route('**/api/leads',async route=>{payloads.push(route.request().postDataJSON());await route.fulfill({status:fail?502:200,json:fail?{ok:false,error:'Could not save. Try again.'}:{ok:true}});});
 await page.goto(base);await page.getByRole('button',{name:'Start guided visit'}).click();
 await expect(page.locator('#viewer-room')).toHaveText('Arrival plaza');
 await page.getByRole('button',{name:'Discover amenities',exact:true}).click();
 await expect(page.locator('#lead-modal')).toBeVisible();
 await expect(page.locator('#guided-journey [aria-current="step"]')).toContainText('Arrival');
 await page.getByLabel('Name',{exact:true}).fill('Test Visitor');await page.getByLabel('Company',{exact:true}).fill('Test Company');await page.getByLabel('Phone',{exact:true}).fill('9999999999');await page.getByLabel('Work email').fill('test@example.com');await page.getByRole('radio',{name:'Other',exact:true}).click();
 await page.getByRole('button',{name:'Continue exploring',exact:true}).click();
 await expect(page.locator('.lead-error')).toHaveText('Could not save. Try again.');
 await expect(page.locator('#lf-name')).toHaveValue('Test Visitor');
 expect(await page.evaluate(()=>sessionStorage.getItem('tourlo_demo_unlocked'))).toBeNull();
 fail=false;await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('#viewer-room')).toHaveText('Podium garden');expect(payloads[0].requestId).toBe(payloads[1].requestId);
 await page.getByRole('button',{name:'Find your home',exact:true}).click();
 await page.locator('[data-action="unit"][data-unit="101"]').click();
 await page.getByRole('button',{name:'Save home',exact:false}).click();
 await page.locator('#panel [data-action="step-inside"]').click();await expect(page.locator('#viewer-room')).toHaveText('Living');
 await page.getByRole('button',{name:'Compare saved homes',exact:true}).click();await expect(page.locator('#saved-homes')).toBeVisible();await expect(page.locator('.compare-home')).toHaveCount(1);
 await page.getByRole('button',{name:'Add another home'}).click();await page.locator('[data-action="unit"][data-unit="102"]').click();await page.locator('[data-action="save"]').click();
 await page.locator('#btn-saved').click();await expect(page.locator('#saved-homes')).toBeVisible();await expect(page.locator('.compare-home')).toHaveCount(2);await page.screenshot({path:'review/desktop-compare.png',animations:'disabled'});
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tourlo_v2_saved_homes')))).toEqual(['101','102']);expect(errors).toEqual([]);
});

test('live refresh changes a selected home without replacing the shortlist',async({page})=>{
 const inventory=JSON.parse(await fs.readFile('public/data/inventory.json','utf8'));let updated=false;
 await page.route('**/api/inventory',route=>route.fulfill({json:{...inventory,source:'google-sheets',units:inventory.units.map(u=>u.unit==='101'&&updated?{...u,status:'sold',price:31000000}:u)}}));
 await page.goto(base+'/?unit=101');await expect(page.locator('#panel-title')).toHaveText('Unit 101');
 await page.locator('[data-action="save"]').click();updated=true;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.locator('.unit-hero .status-pill')).toHaveText('Sold');await expect(page.locator('.unit-hero .price')).toContainText('3.1');
 await expect(page.locator('[data-action="save"]')).toHaveAttribute('aria-pressed','true');
});

test('mobile first visit and typed voice navigation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(base);await page.locator('#boot-loader').waitFor({state:'detached'});await page.screenshot({path:'review/mobile-home.png'});
 await page.getByRole('button',{name:'Explore freely',exact:true}).click();
 await page.locator('.bottom-controls .voice-btn').click();await page.getByLabel('Type a command').fill('go to floor 12');await page.locator('.voice-form button').click();
 await expect(page.locator('#panel-title')).toHaveText('Type A Residences');await page.screenshot({path:'review/mobile-floor.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('every connected room opens and rapid navigation settles on the last selection',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('tourlo_demo_unlocked','1'));
 await page.goto(base);await page.getByRole('button',{name:'Start guided visit'}).click();await expect(page.locator('#viewer-room')).toHaveText('Arrival plaza');
 for(const [id,label] of [['ext_lobby','Lobby'],['ext_podium','Podium garden'],['ext_rooftop','Rooftop terrace'],['ext_aerial','Aerial view'],['ext_station','Metro station']]){await page.locator('#viewer-rooms [data-room="'+id+'"]').click();await expect(page.locator('#viewer-room')).toHaveText(label);}
 await page.locator('#viewer-rooms [data-room="ext_lobby"]').click();await page.locator('#viewer-rooms [data-room="ext_rooftop"]').click();await expect(page.locator('#viewer-room')).toHaveText('Rooftop terrace');
 await page.locator('#guided-journey [data-step="2"]').click();await page.locator('[data-unit="1701"]').click();await page.locator('[data-action="step-inside"]').click();
 await expect(page.locator('#viewer-room')).toHaveText('Living');await page.locator('#viewer-rooms [data-room="typeB_lounge"]').click();await expect(page.locator('#viewer-room')).toHaveText('Lounge');await page.locator('#viewer-rooms [data-room="typeB_stair_dining"]').click();await expect(page.locator('#viewer-room')).toHaveText('Stair and dining');
});
