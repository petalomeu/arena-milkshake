import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const files=fs.readdirSync('assets').filter(f=>/^.+-assets-\d+\.part$/.test(f));
const groups=[...new Set(files.map(f=>f.replace(/-\d+\.part$/,'')))].sort((a,b)=>a==='game-assets'?-1:b==='game-assets'?1:a.localeCompare(b));
const assets={};
for(const group of groups){
 const parts=files.filter(f=>f.startsWith(group+'-')).sort();
 Object.assign(assets,JSON.parse(zlib.gunzipSync(Buffer.concat(parts.map(f=>fs.readFileSync(path.join('assets',f)))))));
}
for(const [name,base64] of Object.entries(assets)){
 if(!name.startsWith('game/') || name.includes('..'))throw Error('Invalid asset path');
 fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,Buffer.from(base64,'base64'));
}
console.log('Prepared '+Object.keys(assets).length+' game assets');

