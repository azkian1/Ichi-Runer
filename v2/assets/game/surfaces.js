// Authored local surface maps: albedo, tangent-space normals and roughness.
// Textures are generated deterministically once; no network or canvas is required.
const libraries=new WeakMap();
export function createSurfaceLibrary(THREE){
  const libraryKey=THREE.DataTexture;
  if(libraries.has(libraryKey))return libraries.get(libraryKey);
  const cache=new Map(),N=256;
  const fract=x=>x-Math.floor(x),mix=(a,b,t)=>a+(b-a)*t;
  const hash=(x,y,s)=>fract(Math.sin(x*127.1+y*311.7+s*79.73)*43758.5453);
  function noise(x,y,s){const ix=Math.floor(x),iy=Math.floor(y),u=fract(x),v=fract(y),a=u*u*(3-2*u),b=v*v*(3-2*v);return mix(mix(hash(ix,iy,s),hash(ix+1,iy,s),a),mix(hash(ix,iy+1,s),hash(ix+1,iy+1,s),a),b);}
  function fbm(x,y,s){let n=0,w=.55;for(let i=0;i<4;i++){n+=noise(x,y,s+i*13)*w;x*=2.03;y*=2.03;w*=.5;}return n;}
  function texture(data,color=false){const t=new THREE.DataTexture(data,N,N,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.needsUpdate=true;return t;}
  function maps(kind){
    if(cache.has(kind))return cache.get(kind);
    const height=new Float32Array(N*N),color=new Uint8Array(N*N*4),rough=new Uint8Array(N*N*4),normal=new Uint8Array(N*N*4);
    const seed={stone:5,path:9,bark:13,wood:17,roof:21,ground:25,cloth:29,rope:31,plaster:37,metal:41,leaf:43}[kind]||5;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const u=x/N,v=y/N,broad=fbm(u*8,v*8,seed),grain=hash(x,y,seed),fine=noise(u*64,v*64,seed+3);
      let h=.3+broad*.5+fine*.12,value=.74+broad*.4+grain*.08,moss=0,r=.86;
      if(kind==='bark'||kind==='wood'){
        const bend=noise(u*7,v*3,seed)*.75,streak=Math.abs(Math.sin((u*29+bend)*Math.PI));
        const groove=Math.pow(1-streak,7),rings=Math.sin(v*13+u*9)*.03;
        h=.2+broad*.25+streak*.35-groove*.18+rings;value=.63+broad*.4+streak*.27-groove*.35;
        if(kind==='wood'){h=.35+broad*.18+streak*.12;value=.8+broad*.25-groove*.2;r=.74;}else moss=Math.max(0,noise(u*12,v*8,seed+6)-.65)*.7;
      }else if(kind==='stone'||kind==='path'){
        const vein=Math.abs(Math.sin(u*19+v*11+noise(u*6,v*6,seed+8)*7));
        const crack=Math.pow(Math.max(0,1-vein*7),3),chips=Math.pow(Math.max(0,.42-noise(u*30,v*30,seed+11))*2,2);
        h=.3+broad*.4+fine*.12-crack*.25-chips*.18;value=.73+broad*.38-crack*.33-chips*.22;
        moss=Math.max(0,noise(u*9,v*9,seed+15)-.53)*.7;r=.83+fine*.13;
        if(kind==='path'){const seams=Math.min(fract(u*3),1-fract(u*3),fract(v*2),1-fract(v*2));if(seams<.022){h-=.2;value*=.63;}r=.66+broad*.25;}
      }else if(kind==='roof'){
        const tile=Math.abs(Math.sin(u*8*Math.PI)),edge=fract(v*5)<.045?1:0;
        h=.25+tile*.35-edge*.19+fine*.06;value=.7+tile*.21+broad*.2-edge*.2;r=.52+fine*.25;
      }else if(kind==='cloth'){
        const weave=(Math.sin(x*Math.PI)*Math.sin(y*Math.PI)+Math.sin(x*2.5)*Math.cos(y*2.5))*.06;
        h=.5+weave+fine*.1;value=.82+broad*.17+weave;r=.93;
      }else if(kind==='rope'){
        const twist=Math.sin((u*6+v*3)*Math.PI*2),fiber=Math.sin((u*39-v*5)*Math.PI*2);
        h=.5+twist*.22+fiber*.04;value=.8+twist*.15+broad*.15;r=.9;
      }else if(kind==='plaster'){
        const worn=Math.max(0,.43-noise(u*14,v*14,seed))*2;h=.5+fine*.08-worn*.3;value=.82+broad*.22-worn*.26;r=.92;
      }else if(kind==='metal'){
        const scratch=Math.pow(Math.max(0,Math.sin(u*180+noise(u*8,v*5,seed))* .5+.5),18);
        h=.5+scratch*.025+fine*.02;value=.89+broad*.12-scratch*.15;r=.3+fine*.18;
      }else if(kind==='ground'){moss=broad*.25;h=.2+broad*.45+fine*.2;value=.7+broad*.35;r=.96;}
      else if(kind==='leaf'){const vein=Math.exp(-Math.abs(u-.5)*42)+Math.pow(Math.max(0,Math.cos((v*12+Math.abs(u-.5)*10)*Math.PI)),8)*.22;h=.4+vein*.12;value=.72+broad*.35+vein*.08;r=.72;}
      const i=y*N+x,o=i*4;height[i]=h;
      const warm=kind==='bark'||kind==='wood'||kind==='rope';
      color[o]=Math.min(255,Math.max(0,(value-moss*.2)*255));color[o+1]=Math.min(255,Math.max(0,(value+(moss*.14)-(warm?.025:0))*255));color[o+2]=Math.min(255,Math.max(0,(value-moss*.23-(warm?.06:0))*255));color[o+3]=255;
      const rr=Math.round(Math.min(1,Math.max(.08,r))*255);rough[o]=rough[o+1]=rough[o+2]=rr;rough[o+3]=255;
    }
    // Matching wrap-edge samples avoid seams when a large wall repeats the map.
    for(let y=0;y<N;y++)for(let x=0;x<6;x++){
      const a=y*N+x,b=y*N+(N-1-x),blend=(6-x)/12,ha=height[a],hb=height[b];height[a]=mix(ha,hb,blend);height[b]=mix(hb,ha,blend);
      for(let k=0;k<3;k++){const ca=color[a*4+k],cb=color[b*4+k],ra=rough[a*4+k],rb=rough[b*4+k];color[a*4+k]=mix(ca,cb,blend);color[b*4+k]=mix(cb,ca,blend);rough[a*4+k]=mix(ra,rb,blend);rough[b*4+k]=mix(rb,ra,blend);}
    }
    for(let x=0;x<N;x++)for(let y=0;y<6;y++){
      const a=y*N+x,b=(N-1-y)*N+x,blend=(6-y)/12,ha=height[a],hb=height[b];height[a]=mix(ha,hb,blend);height[b]=mix(hb,ha,blend);
      for(let k=0;k<3;k++){const ca=color[a*4+k],cb=color[b*4+k],ra=rough[a*4+k],rb=rough[b*4+k];color[a*4+k]=mix(ca,cb,blend);color[b*4+k]=mix(cb,ca,blend);rough[a*4+k]=mix(ra,rb,blend);rough[b*4+k]=mix(rb,ra,blend);}
    }
    const strength=kind==='bark'?7:kind==='stone'||kind==='path'?5:kind==='cloth'?2:3;
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const l=height[y*N+(x+N-1)%N],r=height[y*N+(x+1)%N],d=height[((y+N-1)%N)*N+x],u=height[((y+1)%N)*N+x];let nx=(l-r)*strength,ny=(d-u)*strength,nz=1;const len=Math.hypot(nx,ny,nz);const o=(y*N+x)*4;normal[o]=Math.round((nx/len*.5+.5)*255);normal[o+1]=Math.round((ny/len*.5+.5)*255);normal[o+2]=Math.round((nz/len*.5+.5)*255);normal[o+3]=255;}
    const result={map:texture(color,true),normalMap:texture(normal),roughnessMap:texture(rough)};cache.set(kind,result);return result;
  }
  function apply(material,kind,{repeatX=1,repeatY=1,normal=.6}={}){
    const source=maps(kind);
    for(const name of ['map','normalMap','roughnessMap']){const map=source[name].clone();map.repeat.set(repeatX,repeatY);map.needsUpdate=true;material[name]=map;}
    material.normalScale=new THREE.Vector2(normal,normal);material.needsUpdate=true;material.userData.surface=kind;return material;
  }
  const library={maps,apply};libraries.set(libraryKey,library);return library;
}
