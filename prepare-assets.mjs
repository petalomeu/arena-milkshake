import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const parts=fs.readdirSync('assets').filter(f=>/^game-assets-\d+\.part$/.test(f)).sort();
const assets=JSON.parse(zlib.gunzipSync(Buffer.concat(parts.map(f=>fs.readFileSync(path.join('assets',f))))));
for(const [name,base64] of Object.entries(assets)){if(!name.startsWith('game/') || name.includes('..'))throw Error('Invalid asset path');fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,Buffer.from(base64,'base64'));}
console.log('Prepared '+Object.keys(assets).length+' game assets');
