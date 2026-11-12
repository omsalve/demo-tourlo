import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',timeout:30000,workers:1,use:{channel:'chrome',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure'},reporter:'list'});
