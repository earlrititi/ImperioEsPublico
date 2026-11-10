import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';

const [cleanTemplatePath]=process.argv.slice(2);
if(!cleanTemplatePath)throw Error('Pass the corrected blank 600:950 template reference.');
const destination=resolve('public/images/email/pergamino-v1');
const original=await readFile(join(destination,'extension.png'));
const plate=await readFile(cleanTemplatePath);
// Only the unornamented body strip is used. Original side borders and shadows
// remain outside the feathered central repair; no generated logos enter the tile.
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="128" viewBox="0 0 600 128"><defs><pattern id="original" width="600" height="15" patternUnits="userSpaceOnUse"><image width="600" height="15" href="data:image/png;base64,${original.toString('base64')}"/></pattern><linearGradient id="horizontal" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="black"/><stop offset="0.086667" stop-color="black"/><stop offset="0.108333" stop-color="white"/><stop offset="0.891667" stop-color="white"/><stop offset="0.913333" stop-color="black"/><stop offset="1" stop-color="black"/></linearGradient><mask id="paper" maskUnits="userSpaceOnUse"><rect width="600" height="128" fill="url(#horizontal)"/></mask><g id="upper"><svg width="600" height="64" overflow="hidden"><image x="0" y="-300" width="600" height="950" preserveAspectRatio="none" href="data:image/png;base64,${plate.toString('base64')}"/></svg></g></defs><rect width="600" height="128" fill="url(#original)"/><g mask="url(#paper)"><use href="#upper"/><use href="#upper" transform="translate(0 128) scale(1 -1)"/></g></svg>`;
await mkdir(resolve('docs/email-assets'),{recursive:true});
// Match the adjacent title/footer paper (sampled mean RGB), without a short
// repeating gradient or any opaque backing behind the message's HTML text.
const toned=svg.replace('<defs>','<defs><filter id="paper-tone" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="1" intercept="0.002"/><feFuncG type="linear" slope="1" intercept="0.025"/><feFuncB type="linear" slope="1" intercept="0.06"/></feComponentTransfer></filter>').replace('<g id="upper">','<g id="upper" filter="url(#paper-tone)">');
await writeFile(resolve('docs/email-assets/extension-v2.svg'),toned);
const output=await sharp(Buffer.from(toned)).png({compressionLevel:9}).toBuffer();
await writeFile(join(destination,'extension-v2.png'),output);
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const manifestPath=join(destination,'manifest.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
manifest.assets=manifest.assets.filter(asset=>!['extension.png','extension-v2.png'].includes(asset.output));
manifest.assets.push({input:'docs/email-assets/extension-v2.svg',output:'extension-v2.png',sha256:hash(output),width:600,height:128,bytes:output.length});
manifest.bodyUpdate='Warm continuous parchment in the text region, without the previous pale rectangular matte; original side borders retained.';
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output:join(destination,'extension-v2.png'),bytes:output.length,activeAssetBytes:manifest.assets.reduce((sum,asset)=>sum+asset.bytes,0)}));
