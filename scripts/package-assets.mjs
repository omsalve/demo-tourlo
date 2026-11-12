import fs from 'node:fs/promises';
import sharp from 'sharp';
const updates=JSON.parse(await fs.readFile(process.argv[2] || 'review/asset-final.json','utf8'));
for(const asset of updates){await sharp(asset.source).jpeg({quality:91,mozjpeg:true}).toFile(asset.target);if(asset.target.includes('/panos/')){const file=asset.target.split('/').at(-1);await sharp(asset.source).resize({width:1536,withoutEnlargement:true}).jpeg({quality:86,mozjpeg:true}).toFile('assets/panos-mobile/'+file);await sharp(asset.source).resize({width:240}).jpeg({quality:78}).toFile('assets/thumbs/'+file);}console.log(asset.key);}
