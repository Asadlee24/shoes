// Create a square PNG favicon from the original site logo, without altering its artwork.
// Uses only Node built-in modules. Source images are RGBA PNGs.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {inflateSync,deflateSync} from 'node:zlib';
const [source,destination,rect] = process.argv.slice(2);
if (!source || !destination || !rect) throw Error('Usage: node generate-brand-favicon.mjs in.png out.png x,y,w,h');
const crop = rect.split(',').map(Number);
if (crop.length!==4 || crop.some(v=>!Number.isInteger(v))) throw Error('Invalid crop');
const png = await readFile(source);
if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Source is not PNG');
let width=0,height=0,colorType=-1,parts=[];
for(let p=8;p+12<=png.length;){
  const len=png.readUInt32BE(p),type=png.toString('ascii',p+4,p+8);
  if(p+len+12>png.length)throw Error('Truncated PNG');
  const data=png.subarray(p+8,p+8+len);
  if(type==='IHDR'){
    width=data.readUInt32BE(0);height=data.readUInt32BE(4);colorType=data[9];
    if(data[8]!==8||colorType!==6||data[12]!==0)throw Error('Source must be RGBA non-interlaced 8-bit PNG');
  }else if(type==='IDAT')parts.push(data);
  if(type==='IEND')break;
  p+=12+len;
}
if(!width||!height||!parts.length)throw Error('Incomplete PNG');
const stride=width*4,packed=inflateSync(Buffer.concat(parts));
if(packed.length!==(stride+1)*height)throw Error('Invalid raster length');
const px=Buffer.alloc(stride*height);
const paeth=(a,b,c)=>{
 const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);
 return da<=db&&da<=dc?a:db<=dc?b:c;
};
for(let y=0;y<height;y++){
 const type=packed[y*(stride+1)],out=y*stride,inp=y*(stride+1)+1,prev=(y-1)*stride;
 if(type>4)throw Error('Unknown filter '+type);
 for(let x=0;x<stride;x++){
  const a=x>=4?px[out+x-4]:0,b=y?px[prev+x]:0,c=y&&x>=4?px[prev+x-4]:0;
  const pr=type===0?0:type===1?a:type===2?b:type===3?((a+b)>>1):paeth(a,b,c);
  px[out+x]=(packed[inp+x]+pr)&255;
 }
}
const [cx,cy,cw,ch]=crop;
if(cx<0||cy<0||cw<1||ch<1||cx+cw>width||cy+ch>height)throw Error('Crop outside source');
const size=192,pad=9,scale=Math.min((size-2*pad)/cw,(size-2*pad)/ch);
const dw=Math.round(cw*scale),dh=Math.round(ch*scale),ox=Math.floor((size-dw)/2),oy=Math.floor((size-dh)/2);
const square=Buffer.alloc(size*size*4);
for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
 const sx=Math.min(cx+cw-1,Math.max(cx,cx+(x+.5)*cw/dw-.5));
 const sy=Math.min(cy+ch-1,Math.max(cy,cy+(y+.5)*ch/dh-.5));
 const ix=Math.floor(sx),iy=Math.floor(sy),tx=sx-ix,ty=sy-iy;
 let alpha=0,rgb=[0,0,0];
 for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
  const pxX=Math.min(cx+cw-1,ix+dx),pxY=Math.min(cy+ch-1,iy+dy),p=(pxY*width+pxX)*4;
  const w=(dx?tx:1-tx)*(dy?ty:1-ty)*px[p+3]/255;
  alpha+=w;for(let k=0;k<3;k++)rgb[k]+=w*px[p+k];
 }
 const p=((oy+y)*size+ox+x)*4;square[p+3]=Math.round(alpha*255);
 if(alpha>0)for(let k=0;k<3;k++)square[p+k]=Math.round(rgb[k]/alpha);
}
const raster=Buffer.alloc((size*4+1)*size);
for(let y=0;y<size;y++)square.copy(raster,y*(size*4+1)+1,y*size*4,(y+1)*size*4);
const crcTable=Array.from({length:256},(_,j)=>{
 for(let n=0;n<8;n++)j=(j&1)?(0xedb88320^(j>>>1)):(j>>>1);
 return j>>>0;
});
function chunk(type,data){
 const name=Buffer.from(type),out=Buffer.alloc(12+data.length);
 out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);
 let crc=0xffffffff;
 for(const b of Buffer.concat([name,data]))crc=crcTable[(crc^b)&255]^(crc>>>8);
 out.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);return out;
}
const header=Buffer.alloc(13);
header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
const result=Buffer.concat([png.subarray(0,8),chunk('IHDR',header),chunk('IDAT',deflateSync(raster,{level:9})),chunk('IEND',Buffer.alloc(0))]);
await mkdir(dirname(destination),{recursive:true});await writeFile(destination,result);
console.log('Generated square favicon from original site logo:',source,'=>',destination);
