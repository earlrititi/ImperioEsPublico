import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';

// Native SVG assembly preserves the supplied logo pixels and all original
// decorations outside the small, feathered area from which the old mark is removed.
const [logoPath,cleanPlatePath,sourceOutput,sealPath]=process.argv.slice(2);
if(!logoPath||!cleanPlatePath||!sourceOutput||!sealPath)throw Error('Pass transparent logo, blank header plate, SVG output path and original transparent seal.');
const destination=resolve('public/images/email/pergamino-v1');
const original=await readFile(join(destination,'cabecera.jpg'));
const logo=await readFile(logoPath),plate=await readFile(cleanPlatePath),seal=await readFile(sealPath);
const {data,info}=await sharp(logo).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let left=info.width,top=info.height,right=0,bottom=0;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
if(left>=right||top>=bottom)throw Error('Logo has no visible alpha content.');
const scale=Math.min(180/(right-left+1),158/(bottom-top+1));
const width=info.width*scale,height=info.height*scale;
const x=300-(left+(right-left+1)/2)*scale,y=18-top*scale;
const sealRaw=await sharp(seal).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let sealTop=sealRaw.info.height;
for(let row=0;row<sealRaw.info.height&&sealTop===sealRaw.info.height;row++)for(let column=0;column<sealRaw.info.width;column++)if(sealRaw.data[(row*sealRaw.info.width+column)*4+3]>0){sealTop=row;break;}
if(sealTop===sealRaw.info.height)throw Error('Seal has no visible content.');
const sealWidth=74,sealScale=sealWidth/sealRaw.info.width,sealHeight=sealRaw.info.height*sealScale;
const sealX=(600-sealWidth)/2,sealY=190-sealTop*sealScale;
// The supplied seal is a complete, unmasked PNG in the foreground. Its genuine
// transparent padding is retained; only the old photograph's seal is removed.
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="279" viewBox="0 0 600 279"><defs><filter id="feather"><feGaussianBlur stdDeviation="3"/></filter><mask id="remove-old" maskUnits="userSpaceOnUse"><rect width="600" height="279" fill="black"/><g fill="white" filter="url(#feather)"><rect x="177" y="9" width="246" height="176" rx="5"/><ellipse cx="300" cy="210" rx="40" ry="40"/><rect x="279" y="234" width="43" height="33" rx="3"/></g></mask></defs><image width="600" height="279" href="data:image/jpeg;base64,${original.toString('base64')}"/><image width="600" height="279" preserveAspectRatio="none" href="data:image/png;base64,${plate.toString('base64')}" mask="url(#remove-old)"/><image x="${x}" y="${y}" width="${width}" height="${height}" href="data:image/png;base64,${logo.toString('base64')}"/><image x="${sealX}" y="${sealY}" width="${sealWidth}" height="${sealHeight}" href="data:image/png;base64,${seal.toString('base64')}"/></svg>`;
await mkdir(resolve(sourceOutput,'..'),{recursive:true});
await writeFile(sourceOutput,svg);
await writeFile(join(destination,'logo-superior-original.png'),logo);
await writeFile(join(destination,'sello-superior-original.png'),seal);
const output=await sharp(Buffer.from(svg)).png({compressionLevel:9}).toBuffer();
await writeFile(join(destination,'cabecera-v2.png'),output);
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const manifestPath=join(destination,'manifest.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
manifest.assets=manifest.assets.filter(asset=>!['cabecera.jpg','cabecera-v2.png'].includes(asset.output));
manifest.assets.unshift({input:'User-provided transparent logo and complete seal + original approved header',output:'cabecera-v2.png',sha256:hash(output),width:600,height:279,bytes:output.length,logoSha256:hash(logo),sealSha256:hash(seal),originalHeaderSha256:hash(original),blankPlateSha256:hash(plate)});
manifest.headerUpdate='Black logo moved down 8 px; supplied seal PNG retained complete, with transparency and no clipping mask, in front of the ribbon. Original curtains and borders retained.';
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output:join(destination,'cabecera-v2.png'),bytes:output.length,logoSha256:hash(logo),sealSha256:hash(seal),logoVisibleTop:18,sealVisibleTop:190,sealCanvasBottom:sealY+sealHeight,activeAssetBytes:manifest.assets.reduce((sum,asset)=>sum+asset.bytes,0)}));
