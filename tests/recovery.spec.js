import {test,expect} from '@playwright/test';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
test('failed panorama can be retried and every Type A room remains reachable',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('tourlo_demo_unlocked','1'));let failed=true;
 await page.route('**/assets/panos/typeA_living.jpg',r=>failed?r.abort():r.continue());
 await page.goto(base+'/?unit=101');await page.locator('[data-action="step-inside"]').click();await expect(page.locator('.viewer-error')).toBeVisible();
 failed=false;await page.getByRole('button',{name:'Try view again'}).click();await expect(page.locator('#viewer-room')).toHaveText('Living');await expect(page.locator('.viewer-error')).toBeHidden();
 for(const [id,name] of [['typeA_living_dining','Living and dining'],['typeA_study','Study']]){await page.locator('#viewer-rooms [data-room="'+id+'"]').click();await expect(page.locator('#viewer-room')).toHaveText(name);}
});
test('missing hero falls back to a usable tower',async({page})=>{
 await page.route('**/assets/landing/hero_dusk.jpg',route=>route.abort());await page.goto(base);await page.locator('#boot-loader').waitFor({state:'detached'});await expect(page.locator('#tower-canvas')).toBeVisible();await page.getByRole('button',{name:'Explore freely',exact:true}).click();await page.locator('#btn-residences').click();await expect(page.locator('#panel-title')).toHaveText('The residences');
});
test('mobile guided controls fit and preserve the current step when the gate is dismissed',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(base);await page.getByRole('button',{name:'Start guided visit'}).click();await expect(page.locator('#viewer-room')).toHaveText('Arrival plaza');await page.getByRole('button',{name:'Discover amenities',exact:true}).click();await page.getByRole('button',{name:'Not now',exact:true}).click();await expect(page.locator('#guided-journey [aria-current="step"]')).toContainText('Arrival');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'review/mobile-guided.png'});
});
