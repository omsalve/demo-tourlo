import {test,expect} from '@playwright/test';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';

test('preview continues through the full journey without submitting a lead',async({page})=>{
 let requests=0;page.on('request',r=>{if(r.url().endsWith('/api/leads'))requests++;});
 await page.goto(base);await page.getByRole('button',{name:'Start guided visit'}).click();
 await expect(page.locator('#viewer-room')).toHaveText('Arrival plaza');
 await page.getByRole('button',{name:'Discover amenities',exact:true}).click();
 await page.getByRole('button',{name:'Continue preview without submitting',exact:true}).click();
 await expect(page.locator('#lead-modal')).toBeHidden();
 await expect(page.locator('#viewer-room')).toHaveText('Podium garden');
 await page.getByRole('button',{name:'Find your home',exact:true}).click();
 await page.locator('[data-action="unit"][data-unit="101"]').click();
 await page.locator('[data-action="save"]').click();
 await page.locator('[data-action="step-inside"]').click();
 await expect(page.locator('#viewer-room')).toHaveText('Living');
 await page.getByRole('button',{name:'Compare saved homes',exact:true}).click();
 await expect(page.locator('#saved-homes')).toBeVisible();
 expect(await page.evaluate(()=>sessionStorage.getItem('tourlo_demo_unlocked'))).toBeNull();
 expect(requests).toBe(0);
 await page.reload();await page.getByRole('button',{name:'Start guided visit'}).click();
 await page.getByRole('button',{name:'Discover amenities',exact:true}).click();
 await expect(page.locator('#viewer-room')).toHaveText('Podium garden');await expect(page.locator('#lead-modal')).toBeHidden();
});

test('failed enquiry offers an honest way back into the pending room',async({page})=>{
 let requests=0;await page.route('**/api/leads',r=>{requests++;return r.fulfill({status:503,json:{ok:false,error:'Enquiries are not connected yet.'}});});
 await page.goto(base);await page.getByRole('button',{name:'Start guided visit'}).click();await expect(page.locator('#viewer-room')).toHaveText('Arrival plaza');await page.getByRole('button',{name:'Discover amenities',exact:true}).click();
 for(const [label,value] of [['Name','Test Visitor'],['Company','Example'],['Phone','9999999999'],['Work email','test@example.com']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('radio',{name:'Other',exact:true}).click();await page.getByRole('button',{name:'Continue exploring',exact:true}).click();
 await expect(page.locator('.lead-error')).toHaveText('Enquiries are not connected yet.');
 await page.getByRole('button',{name:'Continue preview without submitting',exact:true}).click();
 await expect(page.locator('#viewer-room')).toHaveText('Podium garden');
 expect(requests).toBe(1);expect(await page.evaluate(()=>sessionStorage.getItem('tourlo_demo_unlocked'))).toBeNull();
 await expect(page.getByText('Your details have been saved.',{exact:false})).toHaveCount(0);
});
