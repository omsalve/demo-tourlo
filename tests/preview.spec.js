import {test,expect} from '@playwright/test';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';

test('previous preview access cannot bypass confirmed lead capture',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('tourlo_preview_access','1'));
 await page.route('**/api/leads',r=>r.fulfill({status:503,json:{ok:false,error:'Please try again.'}}));
 await page.goto(base);
 await page.getByRole('button',{name:'Start guided visit'}).click();
 await expect(page.locator('#viewer-room')).toHaveText('Arrival plaza');
 await page.getByRole('button',{name:'Discover amenities',exact:true}).click();
 await expect(page.locator('#lead-modal')).toBeVisible();
 await expect(page.locator('[data-preview]')).toHaveCount(0);
 for(const [label,value] of [['Name','Test Visitor'],['Company','Example'],['Phone','9999999999'],['Work email','test@example.com']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('radio',{name:'Other',exact:true}).click();
 await page.getByRole('button',{name:'Continue exploring',exact:true}).click();
 await expect(page.locator('.lead-error')).toHaveText('Please try again.');
 await expect(page.locator('[data-preview]')).toHaveCount(0);
 expect(await page.evaluate(()=>sessionStorage.getItem('tourlo_demo_unlocked'))).toBeNull();
 await page.getByRole('button',{name:'Not now',exact:true}).click();
 await expect(page.locator('#viewer-room')).toHaveText('Arrival plaza');
 await page.getByRole('button',{name:'Discover amenities',exact:true}).click();
 await expect(page.locator('#lead-modal')).toBeVisible();
});
