import {defineConfig} from '@playwright/test';
// Runs against a production build (npm run build first). Set TEST_BASE_URL to test a deployed URL instead.
const external=!!process.env.TEST_BASE_URL;
export default defineConfig({testDir:'./tests',testMatch:/\.spec\.js$/,timeout:30000,workers:1,use:{channel:process.env.PW_CHANNEL||'chrome',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure'},reporter:'list',
 webServer:external?undefined:{command:'npm run start',url:'http://127.0.0.1:4173',reuseExistingServer:true,timeout:60000}});
