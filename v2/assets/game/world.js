import { createSurfaceLibrary } from './surfaces.js';
// Original procedural environment for Ichi's Blade. Geometry, textures and animation are local.
// The world scrolls toward +Z. Gameplay owns obstacle collisions and the chasm bridges.
export function createWorldArt(THREE, scene) {
  const group = new THREE.Group(); group.name = 'The ruined road · dark anime environment'; scene.add(group);
  let seed = 731919, themeIndex = 0;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a,b) => a+(b-a)*random();
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const cache = new Map();
  const cached = (key,build) => {if(!cache.has(key))cache.set(key,build());return cache.get(key);};
  const box = cached('box',()=>new THREE.BoxGeometry(1,1,1));
  const cylinder = cached('cylinder',()=>new THREE.CylinderGeometry(1,1,1,12));
  const cone = cached('cone',()=>new THREE.ConeGeometry(1,1,10));
  const sphere = cached('sphere',()=>new THREE.SphereGeometry(1,12,8));
  const stone = cached('stone',()=>{
    const g=new THREE.SphereGeometry(1,20,14),a=g.attributes.position;
    for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),n=1+.13*Math.sin(x*7+y*4+z*5)+.07*Math.sin(x*15-y*11+z*9)+.025*Math.cos(x*31+z*27);a.setXYZ(i,x*n,y*n,z*n);}
    g.computeVertexNormals();return g;
  });
  const wedge = cached('wedge',()=>new THREE.ConeGeometry(1,1,4));
  const dummy = new THREE.Object3D();
  const palettes = [
    {sky:0x080f1d,fog:0x253343,ground:0x172724,path:0x52606a,stone:0x424f58,wood:0x30272b,leaf:0x344447,water:0x1a3945,mountain:0x162437,accent:0xffb670,red:0x653d42,moss:0x344b3c},
    {sky:0x071b22,fog:0x25454a,ground:0x142c28,path:0x536765,stone:0x3d5a5b,wood:0x314c3c,leaf:0x245b4c,water:0x153c44,mountain:0x143139,accent:0x80eed3,red:0x3e5b57,moss:0x2c5842},
    {sky:0x1c0d1b,fog:0x4b2d3b,ground:0x251e24,path:0x5a4e59,stone:0x493845,wood:0x30202b,leaf:0x4c2c35,water:0x8b302a,mountain:0x2d1b2b,accent:0xff8a4e,red:0x6d3543,moss:0x433136}
  ];
  const material = (color,extra={}) => new THREE.MeshStandardMaterial({color,roughness:.94,metalness:0,...extra});
  const mats = {
    ground:material(palettes[0].ground),path:material(palettes[0].path),stone:material(palettes[0].stone),wood:material(palettes[0].wood),
    leaf:material(palettes[0].leaf),bark:material(0x211f28),dark:material(0x151d29),roof:material(0x26303c),roofEdge:material(0x3b4653),
    red:material(palettes[0].red),plaster:material(0x76776e),paper:material(0xc3bca2,{side:THREE.DoubleSide}),rope:material(0x86755a),
    gold:material(0xb7a079,{metalness:.35,roughness:.6}),moss:material(palettes[0].moss),grass:material(0x33463e,{side:THREE.DoubleSide}),
    cracks:material(0x202c31),water:material(palettes[0].water,{metalness:.35,roughness:.24}),
    glow:new THREE.MeshBasicMaterial({color:palettes[0].accent}),window:material(0xffc58a,{emissive:0xf78b38,emissiveIntensity:.8,roughness:.8}),
    mountain:material(palettes[0].mountain,{roughness:1}),farMountain:material(0x172536,{roughness:1})
  };

  const surfaces=createSurfaceLibrary(THREE);
  for(const [name,kind,rx,ry,strength] of [
    ['ground','ground',26,26,.65],['path','path',1.4,1.4,.65],['stone','stone',1.8,1.8,.8],
    ['wood','wood',1,3,.62],['bark','bark',2,3,1],['dark','wood',1,2,.45],
    ['roof','roof',3,2,.65],['roofEdge','stone',1,1,.4],['red','wood',1,3,.5],
    ['plaster','plaster',2,2,.5],['rope','rope',1,5,.7],['moss','ground',2,2,.6],
    ['mountain','stone',9,5,.8],['farMountain','stone',8,4,.6],['leaf','leaf',1,1,.45]
  ])surfaces.apply(mats[name],kind,{repeatX:rx,repeatY:ry,normal:strength});
  mats.path.roughness=.74;mats.roof.roughness=.62;mats.bark.roughness=.94;
  mats.leaf.side=THREE.DoubleSide;

  // The same uniforms are shared by every road tile and the landscape: a gap is genuinely
  // missing ground rather than a black decal painted over a walkable surface.
  const gapUniforms = { value:Array.from({length:3},()=>new THREE.Vector2(10000,0)) };
  function cuttable(mat) {
    mat.onBeforeCompile = shader => {
      shader.uniforms.ichiGaps = gapUniforms;
      shader.vertexShader = shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 ichiWorldPosition;');
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 ichiWorldVertex = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          ichiWorldVertex = instanceMatrix * ichiWorldVertex;
        #endif
        ichiWorldPosition = (modelMatrix * ichiWorldVertex).xyz;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 ichiWorldPosition;\nuniform vec2 ichiGaps[3];');
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if (abs(ichiWorldPosition.x) < 5.64) {
          for (int gapIndex = 0; gapIndex < 3; gapIndex++) {
            if (ichiGaps[gapIndex].y > 0.0 && abs(ichiWorldPosition.z - ichiGaps[gapIndex].x) < ichiGaps[gapIndex].y) discard;
          }
        }`);
    };
    mat.customProgramCacheKey = () => 'ichi-live-course-gap-v1';
  }
  for(const mat of [mats.ground,mats.path,mats.stone,mats.cracks,mats.grass,mats.moss,mats.water])cuttable(mat);
  const setGaps = (gaps=[]) => {for(let i=0;i<3;i++){const gap=gaps[i];gapUniforms.value[i].set(gap&&Number.isFinite(gap.z)?gap.z:10000,gap?Math.max(0,Number(gap.length)||0)*.5:0);}};

  function collector(parent) {
    const entries = new Map();
    const receives = mat => mat===mats.path||mat===mats.ground||mat===mats.stone||mat===mats.wood;
    const place = t => {dummy.position.set(t[0],t[1],t[2]);dummy.scale.set(t[3],t[4],t[5]);dummy.rotation.set(t[6],t[7],t[8]);dummy.updateMatrix();};
    function instanced({geo,mat,items}) {
      const mesh=new THREE.InstancedMesh(geo,mat,items.length);
      items.forEach((t,i)=>{place(t);mesh.setMatrixAt(i,dummy.matrix);});
      mesh.receiveShadow=receives(mat);mesh.castShadow=false;parent.add(mesh);return mesh;
    }
    function baked(records,mat) {
      let vertexCount=0,indexCount=0;
      for(const {geo,items} of records){vertexCount+=geo.attributes.position.count*items.length;indexCount+=(geo.index?.count??geo.attributes.position.count)*items.length;}
      const positions=new Float32Array(vertexCount*3),normals=new Float32Array(vertexCount*3),uvs=new Float32Array(vertexCount*2);
      const indices=vertexCount>65535?new Uint32Array(indexCount):new Uint16Array(indexCount);
      const position=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
      let vertexOffset=0,indexOffset=0;
      for(const {geo,items} of records){
        const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
        for(const t of items){
          place(t);normalMatrix.getNormalMatrix(dummy.matrix);
          for(let i=0;i<p.count;i++){
            position.fromBufferAttribute(p,i).applyMatrix4(dummy.matrix);position.toArray(positions,(vertexOffset+i)*3);
            if(n)normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();else normal.set(0,1,0);
            normal.toArray(normals,(vertexOffset+i)*3);
            uvs[(vertexOffset+i)*2]=uv?uv.getX(i):0;uvs[(vertexOffset+i)*2+1]=uv?uv.getY(i):0;
          }
          const count=geo.index?.count??p.count;
          for(let i=0;i<count;i++)indices[indexOffset++]=vertexOffset+(geo.index?geo.index.getX(i):i);
          vertexOffset+=p.count;
        }
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(new THREE.BufferAttribute(indices,1));geometry.computeBoundingSphere();
      const mesh=new THREE.Mesh(geometry,mat);mesh.name='Static material batch';mesh.userData.worldMaterialBatch=true;mesh.receiveShadow=receives(mat);mesh.castShadow=false;parent.add(mesh);return mesh;
    }
    return {
      add(geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0) {
        const key=geo.uuid+'|'+mat.uuid;
        if(!entries.has(key))entries.set(key,{geo,mat,items:[]});
        entries.get(key).items.push([x,y,z,sx,sy,sz,rx,ry,rz]);
      },
      finish() {
        const meshes=[],byMaterial=new Map();
        for(const record of entries.values()){if(!byMaterial.has(record.mat))byMaterial.set(record.mat,[]);byMaterial.get(record.mat).push(record);}
        for(const [mat,records] of byMaterial){
          // Single-geometry families already cost one draw and retain compact GPU
          // instancing. Only mixed geometry families benefit from baking together.
          if(records.length===1){meshes.push(instanced(records[0]));continue;}
          const merge=[];
          for(const record of records){
            // Large repeated foliage/detail remains instanced rather than expanding
            // hundreds of copies just to save a draw. The other pieces share a mesh.
            if(record.items.length>=96&&record.geo.attributes.position.count>=180)meshes.push(instanced(record));else merge.push(record);
          }
          if(merge.length===1)meshes.push(instanced(merge[0]));else if(merge.length)meshes.push(baked(merge,mat));
        }
        return meshes;
      }
    };
  }
  function direct(parent,geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(rx,ry,rz);mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function tube(points,radius=.05,segments=20){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,5,false);}
  function line(c,mat,a,b,width=.1){
    const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),mid=av.clone().add(bv).multiplyScalar(.5),direction=bv.clone().sub(av);
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
    const e=new THREE.Euler().setFromQuaternion(dummy.quaternion);c.add(cylinder,mat,mid.x,mid.y,mid.z,width,direction.length(),width,e.x,e.y,e.z);
  }
  function beveledSlab(){
    return cached('paving-slab',()=>{
      const shape=new THREE.Shape();const w=.5,r=.035;
      shape.moveTo(-w+r,-w);shape.lineTo(w-r,-w);shape.quadraticCurveTo(w,-w,w,-w+r);shape.lineTo(w,w-r);shape.quadraticCurveTo(w,w,w-r,w);shape.lineTo(-w+r,w);shape.quadraticCurveTo(-w,w,-w,w-r);shape.lineTo(-w,-w+r);shape.quadraticCurveTo(-w,-w,-w+r,-w);
      const g=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSegments:1,bevelSize:.018,bevelThickness:.018,steps:1,curveSegments:2});g.rotateX(-Math.PI/2);return g;
    });
  }
  // Curved hipped roofs have an upturned corner profile, broad smooth silhouettes and
  // individually traced tile ribs. All floors share cached geometry.
  function roofGeometry(width,depth,height){
    return cached(`roof-${width}-${depth}-${height}`,()=>{
      const positions=[],uvs=[],indices=[];const rows=8,around=32;
      for(let r=0;r<=rows;r++)for(let a=0;a<=around;a++){
        const radius=.09+.91*r/rows,angle=a/around*Math.PI*2;
        const dx=Math.cos(angle),dz=Math.sin(angle),edge=Math.max(Math.abs(dx),Math.abs(dz));
        const x=dx/edge*width*.5*radius,z=dz/edge*depth*.5*radius;
        const corner=Math.min(Math.abs(dx),Math.abs(dz))/Math.max(.001,edge);
        const y=height*Math.pow(1-radius,1.18)+.29*Math.pow(radius,6)*(corner*corner+.14);
        positions.push(x,y,z);uvs.push(a/around,r/rows);
        if(r<rows&&a<around){const i=r*(around+1)+a;indices.push(i,i+1,i+around+1,i+1,i+around+2,i+around+1);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
    });
  }
  function ridgeGeometry(seedOffset,side,depth){
    const positions=[],uvs=[],indices=[],nx=168,nz=16;
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const x=-140+i/nx*280,v=j/nz,z=depth+(v-.5)*42;
      const shoulder=Math.pow(Math.max(0,Math.sin(v*Math.PI)),.6);
      const ridge=19+Math.sin(x*.069+seedOffset)*9+Math.sin(x*.171+seedOffset*.7)*5+Math.sin(x*.39+seedOffset)*2.2+Math.abs(Math.sin(x*.88+v*3.7))*2.8;
      const h=-7+Math.max(8,ridge)*shoulder*(Math.abs(x)<14?.48:1)+Math.sin(x*.22+z*.31)*shoulder*2;
      positions.push(x,h,z);uvs.push(x/25,v*3);
      if(j<nz&&i<nx){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }

  direct(group,box,mats.ground,0,-.64,-74,260,.8,250);
  direct(group,box,mats.water,-23,-.23,-74,11,.09,250);direct(group,box,mats.water,27,-.23,-74,9,.09,250);
  const ridgeFar=direct(group,ridgeGeometry(2,-1,-179),mats.farMountain,0,0,0);
  const ridgeNear=direct(group,ridgeGeometry(7,1,-142),mats.mountain,0,-1,0);
  mats.mountain.side=THREE.DoubleSide;mats.farMountain.side=THREE.DoubleSide;

  function glowTexture(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
    const gradient=ctx.createRadialGradient(64,64,1,64,64,64);gradient.addColorStop(0,'rgba(255,247,220,.9)');gradient.addColorStop(.13,'rgba(255,225,172,.4)');gradient.addColorStop(.5,'rgba(220,222,243,.09)');gradient.addColorStop(1,'rgba(180,195,235,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);
  }
  const glowMap=glowTexture();
  const skyCanvas=document.createElement('canvas');skyCanvas.width=4;skyCanvas.height=256;const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;
  const skyMat=new THREE.MeshBasicMaterial({map:skyTexture,side:THREE.BackSide,depthWrite:false,fog:false});
  const sky=direct(group,new THREE.SphereGeometry(235,32,20),skyMat,0,0,0);sky.renderOrder=-100;
  // A locally authored lunar albedo adds maria and crater rims to the skyline.
  const moonPixels=new Uint8Array(256*128*4),craters=[];
  for(let n=0;n<29;n++)craters.push({u:(n*.618034+.13)%1,v:.18+((n*.381966)%1)*.64,r:.012+(n%5)*.008});
  for(let y=0;y<128;y++)for(let x=0;x<256;x++){
    const u=x/255,v=y/127,grain=Math.sin(x*127.1+y*311.7)*43758.5453;
    let shade=.74+.07*Math.sin(u*19+Math.sin(v*13)*2)+.055*Math.sin(u*43-v*29)+.045*(grain-Math.floor(grain));
    for(const c of craters){const dx=Math.min(Math.abs(u-c.u),1-Math.abs(u-c.u))*Math.sin(v*Math.PI),d=Math.hypot(dx,v-c.v)/c.r;if(d<1.3)shade+=.14*Math.exp(-(((d-1)*8)**2))-.14*Math.exp(-d*d*2);}
    shade*=.8+.2*Math.cos((u-.28)*Math.PI*2);const i=(y*256+x)*4,value=Math.round(clamp(shade,.28,.98)*255);moonPixels[i]=value;moonPixels[i+1]=value;moonPixels[i+2]=Math.min(255,value+7);moonPixels[i+3]=255;
  }
  const moonTexture=new THREE.DataTexture(moonPixels,256,128,THREE.RGBAFormat);moonTexture.colorSpace=THREE.SRGBColorSpace;moonTexture.minFilter=THREE.LinearMipmapLinearFilter;moonTexture.generateMipmaps=true;moonTexture.needsUpdate=true;
  const moonMat=new THREE.MeshBasicMaterial({color:0xd7e3ed,map:moonTexture,fog:false});
  const moon=direct(group,new THREE.SphereGeometry(5.8,32,20),moonMat,-28,33,-155);
  const moonHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color:0x88aee5,transparent:true,opacity:.48,depthWrite:false,fog:false}));moonHalo.position.copy(moon.position);moonHalo.scale.set(65,65,1);group.add(moonHalo);
  const mist=[];
  for(let i=0;i<7;i++){
    const fog=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color:0x9fb9cc,transparent:true,opacity:i<3?.1:.18,depthWrite:false}));
    fog.position.set((i%3-1)*32,.6+(i%3)*1.7,-27-i*17);fog.scale.set(105,8+(i%3)*5,1);group.add(fog);mist.push(fog);
  }
  const lanternHalos=[];const windRibbons=[];
  const motesGeometry=new THREE.BufferGeometry(),motePositions=new Float32Array(250*3);
  for(let i=0;i<250;i++){motePositions[i*3]=range(-35,35);motePositions[i*3+1]=range(.3,15);motePositions[i*3+2]=range(-150,18);}
  motesGeometry.setAttribute('position',new THREE.BufferAttribute(motePositions,3));
  const moteMat=new THREE.PointsMaterial({color:0xa4c0c8,size:.043,transparent:true,opacity:.55,depthWrite:false});group.add(new THREE.Points(motesGeometry,moteMat));
  const rainGeometry=new THREE.BufferGeometry(),rainPositions=new Float32Array(120*6);
  for(let i=0;i<120;i++){const x=range(-22,22),y=range(0,22),z=range(-92,20);rainPositions.set([x,y,z,x-.05,y-.42,z+.05],i*6);}
  rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rainMat=new THREE.LineBasicMaterial({color:0x9ab6c8,transparent:true,opacity:.11,depthWrite:false});const rain=new THREE.LineSegments(rainGeometry,rainMat);group.add(rain);

  function leafSprig(){return cached('botanical-leaf-sprig',()=>{
    const positions=[],uvs=[],indices=[];
    for(let leaf=0;leaf<12;leaf++){
      const side=leaf%2?-1:1,row=Math.floor(leaf/2),a=side*(.6+row*.05),cy=row*.12;
      const origin=new THREE.Vector3(side*.05,cy,0),direction=new THREE.Vector3(Math.sin(a),.4,Math.cos(a)*.25).normalize();
      const across=new THREE.Vector3(-direction.y,direction.x,.12).normalize(),length=.4+(row%3)*.075,width=.12+(row%2)*.025,base=positions.length/3;
      for(let step=0;step<=8;step++){
        const t=step/8,breadth=Math.sin(Math.PI*t)*width;
        for(const edge of [-1,1]){const p=origin.clone().addScaledVector(direction,t*length).addScaledVector(across,edge*breadth);p.z+=Math.sin(t*Math.PI)*.065;positions.push(p.x,p.y,p.z);uvs.push((edge+1)*.5,t);}
        if(step<8){const q=base+step*2;indices.push(q,q+1,q+2,q+1,q+3,q+2);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
  });}
  function addTree(c,x,z,scale=1,dead=false){
    const h=7,lean=(x<0?-1:1)*.6,variant=Math.floor(Math.abs(x+z))%3;
    const trunk=cached(`tree-trunk-${x<0?'left':'right'}-${variant}`,()=>tube([[0,0,0],[lean*.3,h*.28,.1+variant*.06],[-lean*.1,h*.58,-.2],[lean*.8,h*.82,0],[lean*1.15,h,.25]],.25,24));
    c.add(trunk,mats.bark,x,0,z,scale,scale,scale);
    for(let k=0;k<7;k++){
      const a=k*1.61+.3,attach=h*(.38+k*.07),dx=Math.cos(a)*(1.9+(k%2)*1.1),dz=Math.sin(a)*2;
      const branch=cached(`tree-branch-${k}`,()=>tube([[0,0,0],[dx*.4,.48,dz*.4],[dx,.8,dz],[dx*1.12,1.16,dz*1.1]],.075,16));
      c.add(branch,mats.bark,x+lean*.25*scale,attach*scale,z,scale,scale,scale);
      const twig=cached(`tree-twig-${k}`,()=>tube([[0,0,0],[dx*.14,.25,dz*.1],[dx*.32,.52,dz*.17]],.023,10));
      for(let q=0;q<3;q++){
        const t=.55+q*.22,tx=x+(lean*.25+dx*t)*scale,ty=(attach+.8*t)*scale,tz=z+dz*t*scale;
        c.add(twig,mats.bark,tx,ty,tz,scale,scale,scale,0,q*2.1,0);
        if(!dead)for(let sprig=0;sprig<3;sprig++)c.add(leafSprig(),mats.leaf,tx+range(-.25,.25)*scale,ty+range(.1,.45)*scale,tz+range(-.3,.3)*scale,range(1.1,1.8)*scale,range(1.1,1.6)*scale,range(1.1,1.7)*scale,range(-.6,.6),a+sprig*2.1,range(-.65,.65));
      }
    }
    // Tapered roots, exposed bark curls and small stones anchor the trunk in the soil.
    for(let k=0;k<5;k++){const a=k*Math.PI*2/5;c.add(stone,mats.bark,x+Math.cos(a)*.42*scale,.1,z+Math.sin(a)*.42*scale,.7*scale,.17*scale,.25*scale,0,a,0);}
  }
  function addLantern(c,parent,x,z){
    c.add(box,mats.stone,x,.12,z,.9,.24,.9);c.add(cylinder,mats.stone,x,.67,z,.18,1.1,.18);
    c.add(cylinder,mats.stone,x,1.31,z,.44,.13,.44);c.add(box,mats.window,x,1.68,z,.51,.57,.51);
    for(let s of [-1,1])for(let t of [-1,1])c.add(cylinder,mats.dark,x+s*.29,1.68,z+t*.29,.035,.65,.035);
    c.add(roofGeometry(1.12,1.12,.42),mats.stone,x,2.03,z);c.add(sphere,mats.stone,x,2.5,z,.1,.12,.1);
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap,color:0xffae64,transparent:true,opacity:.3,depthWrite:false}));halo.position.set(x,1.68,z);halo.scale.set(2.4,2.4,1);parent.add(halo);lanternHalos.push(halo);
  }
  const roadTorii=[],toriiWorldPosition=new THREE.Vector3();
  let bossCinematic=false,bossCinematicZ=-24;
  function refreshBossOcclusion(){
    for(const torii of roadTorii){
      toriiWorldPosition.set(0,0,torii.userData.roadZ);torii.localToWorld(toriiWorldPosition);
      // Only the decorative upper arch yields the sightline. Footings, roadside
      // columns, terrain and every gameplay object stay visible and unchanged.
      torii.visible=toriiWorldPosition.z<=(bossCinematic?bossCinematicZ+1:-4);
    }
  }
  function setBossCinematic(active,bossZ=-24){
    bossCinematic=!!active;bossCinematicZ=Number.isFinite(bossZ)?bossZ:-24;refreshBossOcclusion();
  }
  function roadArch(parent,z,name){
    const arch=new THREE.Group();arch.name=name;arch.userData.worldTorii=true;arch.userData.roadZ=z;
    parent.add(arch);roadTorii.push(arch);return collector(arch);
  }
  function addTorii(c,parent,z,broken=false){
    // Keep the complete roadside supports in the parent batches. Only the
    // overhead span yields the sightline; its posts and caps stay grounded.
    for(const side of[-1,1]){
      c.add(cylinder,mats.stone,side*6.35,.16,z,.57,.32,.57);
      c.add(cylinder,mats.red,side*6.35,3.25,z,.24,6.3,.24,0,0,-side*.045);
      c.add(cylinder,mats.dark,side*6.35,5.9,z,.29,.18,.29);
    }
    const torii=new THREE.Group();torii.name='Road torii · cinematic occluder';torii.userData.worldTorii=true;torii.userData.roadZ=z;
    parent.add(torii);roadTorii.push(torii);c=collector(torii);
    c.add(box,mats.red,-.15,5.68,z,13.8,.27,.42,0,0,.013);
    if(broken){c.add(box,mats.dark,-3.4,6.54,z,6.8,.37,.85,0,0,.015);c.add(box,mats.dark,4.1,6.34,z+.35,5.2,.37,.85,0,.13,-.19);}
    else{
      c.add(box,mats.dark,0,6.5,z,13.7,.32,.78);c.add(box,mats.dark,-6.8,6.62,z,1.45,.27,.76,0,0,-.13);c.add(box,mats.dark,6.8,6.62,z,1.45,.27,.76,0,0,.13);
    }
    c.add(box,mats.gold,0,6.01,z+.27,.6,.9,.09);
    const rope=tube([[-5.9,0,0],[-3.3,-.38,0],[0,-.56,.04],[3.3,-.38,0],[5.9,0,0]],.047,26);c.add(rope,mats.rope,0,5.2,z+.22);
    for(let k=0;k<7;k++){
      const x=(k-3)*1.38,drop=.46*(1-Math.abs(x)/6);
      line(c,mats.rope,[x,5.2-drop,z+.22],[x,4.78-drop,z+.24],.016);
      for(let f=0;f<3;f++)c.add(box,mats.paper,x+(f%2?.08:0),4.73-drop-f*.15,z+.24,.17,.19,.012,0,0,(f%2?1:-1)*.3);
    }
    c.finish();
  }
  function addTemple(c,x,z,scale=1,ruined=false){
    const A=(geo,mat,px,py,pz,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>c.add(geo,mat,x+px*scale,py*scale,z+pz*scale,sx*scale,sy*scale,sz*scale,rx,ry,rz);
    A(box,mats.stone,0,.4,0,7,.8,6.5);for(let i=0;i<4;i++)A(box,mats.stone,0,.12+i*.15,3.2+i*.28,3.7-i*.3,.24,.5);
    for(let floor=0;floor<3;floor++){
      const base=1.1+floor*2.4,w=5.4-floor*1.05,d=w*.83;
      A(box,mats.plaster,0,base+.75,0,w,1.5,d);
      for(const side of [-1,1]){
        A(cylinder,mats.wood,side*w*.48,base+.75,d*.46,.13,1.8,.13);
        A(cylinder,mats.wood,side*w*.48,base+.75,-d*.46,.13,1.8,.13);
      }
      A(box,mats.wood,0,base+.13,0,w+0.25,.17,d+.24);A(box,mats.wood,0,base+1.5,0,w+.3,.2,d+.3);
      for(let i=-2;i<=2;i++){
        const px=i*w*.16;
        if(ruined&&floor===1&&i>0)continue;
        A(box,mats.dark,px,base+.75,d*.501,w*.115,1.05,.035);
        A(box,mats.window,px,base+.75,d*.51,w*.08,.78,.025);
        for(let k=0;k<3;k++)A(box,mats.wood,px,base+.45+k*.28,d*.52,w*.1,.022,.035);
        A(box,mats.wood,px,base+.75,d*.53,.025,.94,.04);
      }
      const rw=w+2.4,rd=d+2.1;
      A(roofGeometry(rw,rd,.95),mats.roof,0,base+1.62,0);
      // Tile ribs repeat the curved profile and catch the moon rim light.
      const tileCurve=cached(`tile-rib-${floor}`,()=>tube([[0,.84,0],[0,.48,rd*.22],[0,.12,rd*.4],[0,.05,rd*.49]],.032,9));
      for(let i=-7;i<=7;i++){
        if(ruined&&floor===2&&i>3)continue;
        A(tileCurve,mats.roofEdge,i*rw/17,base+1.64,0,1,1,1,0,0,0);
        A(tileCurve,mats.roofEdge,i*rw/17,base+1.64,0,1,1,1,0,Math.PI,0);
      }
      for(const side of [-1,1])A(cylinder,mats.roofEdge,0,base+1.7,side*rd*.5,.06,rw,.06,0,0,Math.PI/2);
    }
    A(cylinder,mats.gold,0,9.04,0,.055,1.5,.055);for(let i=0;i<4;i++)A(sphere,mats.gold,0,8.6+i*.27,0,.17-i*.025,.06,.17-i*.025);
    if(ruined){
      for(let i=0;i<12;i++)A(stone,mats.stone,range(-4,4),range(.12,.45),range(1.8,5),range(.2,.6),range(.12,.3),range(.2,.6),range(0,3),range(0,6),range(0,3));
      A(box,mats.wood,2.6,.65,2.1,.17,4.5,.2,0,0,-.68);
    }
  }
  function addGrave(c,x,z,index){
    c.add(box,mats.stone,x,.12,z,.9,.23,.73);c.add(box,mats.stone,x,.55,z,.6,.65,.4,0,range(-.12,.12),range(-.12,.12));
    c.add(cylinder,mats.stone,x,1.02,z,.32,.17,.32);c.add(sphere,mats.stone,x,1.23,z,.23,.25,.22);
    for(let i=0;i<3;i++)c.add(box,mats.cracks,x-.12+(i%2)*.06,.5+i*.1,z+.207,.11,.025,.012,0,0,.15);
    c.add(stone,mats.moss,x-.23,.16,z+.2,.45,.12,.3);
  }

  const chunks=[],themeNodes=[[],[],[]],length=46,total=length*4;
  for(let ci=0;ci<4;ci++){
    const chunk=new THREE.Group();chunk.position.z=22-ci*length;group.add(chunk);chunks.push(chunk);
    const common=collector(chunk);
    for(let row=0;row<15;row++)for(let col=0;col<3;col++){
      const x=(col-1)*3.48,z=-row*3.08-1.3;
      common.add(beveledSlab(),mats.path,x,-.12,z,3.42,1,3.0,0,range(-.008,.008),range(-.002,.002));
      if((row+col)%4===0){const crackX=x+range(-1,1),crackZ=z+range(-.8,.8);common.add(box,mats.cracks,crackX,.04,crackZ,.018,.012,range(.4,1.3),0,range(-.8,.8),0);}
      if(col!==1&&random()<.35)common.add(stone,mats.moss,x+(col===0?-.9:.9),.025,z,range(.15,.32),.022,range(.2,.6));
    }
    for(const side of [-1,1]){
      for(let i=0;i<23;i++)common.add(box,mats.stone,side*5.43,.04,-i*2.05,.22,.23,1.98,0,0,side*range(-.02,.02));
      for(let i=0;i<15;i++){
        const x=side*range(6.2,22),z=range(-46,0);
        common.add(stone,mats.stone,x,range(.15,.5),z,range(.3,1.25),range(.25,.8),range(.4,1.3),range(-.3,.3),range(0,6),range(-.4,.4));
        if(i%3===0)common.add(stone,mats.moss,x,.1,z,range(.5,1.2),.1,range(.5,1));
      }
      for(let i=0;i<36;i++){
        const x=side*range(5.9,24),z=range(-46,0),height=range(.18,.7);
        common.add(wedge,mats.grass,x,height*.48,z,.07,height,.33,range(-.2,.2),range(0,6),side*.1);
      }
      for(let i=0;i<2;i++)addLantern(common,chunk,side*6.5,-8-i*25);
      for(let i=0;i<5;i++)if(i%2===ci%2)addGrave(common,side*range(7.4,11),-i*9-2,i);
    }
    common.finish();

    const shrine=new THREE.Group();chunk.add(shrine);themeNodes[0].push(shrine);const sc=collector(shrine);
    for(const side of [-1,1]){
      addTree(sc,side*range(10,13),-5,range(.85,1.05),false);
      addTree(sc,side*range(13,18),-29,range(.95,1.3),ci%3===1);
      for(let j=0;j<3;j++){
        const x=side*range(7.4,10),z=-j*16-range(0,4);
        sc.add(cylinder,mats.stone,x,range(.7,1.3),z,.36,range(1.4,2.5),.36,range(-.13,.13),range(0,3),side*.12);
        sc.add(stone,mats.stone,x+.4,.14,z+.4,.5,.2,.4);
      }
    }
    if(ci%2===0)addTorii(sc,shrine,-18,ci===2);
    if(ci===1||ci===3)addTemple(sc,ci===1?-21:21,-27,ci===1?1.15:.92,true);
    sc.finish();

    const bamboo=new THREE.Group();chunk.add(bamboo);themeNodes[1].push(bamboo);const bc=collector(bamboo);
    for(let i=0;i<50;i++){
      const side=i%2?-1:1,x=side*range(7.7,27),z=range(-46,0),h=range(6,14),tilt=side*range(-.03,.06);
      bc.add(cylinder,mats.wood,x,h*.5,z,.11,h,.11,0,0,tilt);
      for(let k=1;k<6;k++)bc.add(cylinder,mats.dark,x-Math.sin(tilt)*h*k/6,h*k/6,z,.125,.045,.125,0,0,tilt);
      if(i%2===0){for(let q=0;q<4;q++){const a=q*1.57;bc.add(leafSprig(),mats.leaf,x+Math.cos(a)*.9,h*.7+Math.sin(q)*.3,z+Math.sin(a)*.7,1.5,1.0,1.1,0,a,side*.2);}}
    }
    if(ci%2===0){
      for(const side of [-1,1]){bc.add(cylinder,mats.stone,side*6.7,2.7,-22,.65,5.4,.65);bc.add(roofGeometry(2,2,.6),mats.stone,side*6.7,5.5,-22);}
      const arch=roadArch(bamboo,-22,'Bamboo lintel · clear action sightline');
      arch.add(box,mats.stone,0,5,-22,13.8,.55,1.5);arch.add(box,mats.moss,0,5.31,-22,13,.08,1.3);arch.finish();
    }
    for(let i=0;i<3;i++)addGrave(bc,(i%2?-1:1)*8.4,-7-i*14,i);
    bc.finish();

    const citadel=new THREE.Group();chunk.add(citadel);themeNodes[2].push(citadel);const cc=collector(citadel);
    for(const side of [-1,1]){
      for(let j=0;j<3;j++){
        const x=side*(10+j*5),z=-9-j*13;
        cc.add(stone,mats.dark,x,2.2+j*.4,z,2.1,3.8+j*.6,2.5,0,range(0,6),side*.2);
        cc.add(stone,mats.glow,x+.2,.02,z+2,range(.5,1.1),.04,2.8,0,side*.6,0);
      }
      const x=side*14,z=-28;
      cc.add(cylinder,mats.stone,x,3.5,z,2.5,7,2.5);cc.add(cylinder,mats.dark,x,6.9,z,2.8,.7,2.8);
      for(let n=0;n<8;n++){const a=n/8*Math.PI*2;cc.add(box,mats.stone,x+Math.cos(a)*2.5,7.6,z+Math.sin(a)*2.5,.8,1.1,.8,0,-a,0);}
      for(let i=0;i<4;i++)cc.add(box,mats.glow,x+.2,1+i*1.35,z+2.49,.18,.75,.025);
      addTree(cc,side*range(8.6,11),-12,.9,true);
      for(let n=0;n<3;n++)cc.add(cone,mats.dark,side*6.5,1.2,-n*13-4,.4,2.4,.4,0,0,side*.17);
    }
    if(ci%2===0){
      for(const side of [-1,1]){cc.add(cylinder,mats.dark,side*6.7,4,-17,.7,8,.7);cc.add(roofGeometry(2.1,2.3,.9),mats.dark,side*6.7,8,-17);cc.add(sphere,mats.glow,side*6.7,9,-17,.18,.5,.18);}
      const arch=roadArch(citadel,-17,'Citadel roof · clear action sightline');
      arch.add(roofGeometry(14.5,3.5,1.3),mats.dark,0,7.1,-17);arch.finish();
    }
    cc.finish();
  }

  // One authored skyline silhouette per world. These are scenery, outside the
  // road, batched in 2–3 existing materials and built once. No new light or FX.
  const landmarks=[];
  function landmark(theme,id,x,z){const node=new THREE.Group();node.name=id;node.position.set(x,0,z);node.userData.landmarkTheme=theme;node.userData.landmarkId=id;group.add(node);themeNodes[theme].push(node);landmarks.push(node);return collector(node);}
  const moonGate=landmark(0,'Shattered Moon Seal',-19,-104);
  const moonRing=cached('landmark-moon-ring',()=>new THREE.TorusGeometry(1,.105,6,48,Math.PI*1.7));
  moonGate.add(moonRing,mats.stone,0,9,0,7,7,1.8,0,0,.45);
  for(const side of[-1,1]){moonGate.add(box,mats.stone,side*4.1,2.4,.4,1.7,4.8,2.6,0,side*.1,side*.055);moonGate.add(box,mats.gold,side*4.1,4.8,.4,1.8,.16,2.7);}
  moonGate.add(box,mats.gold,-.6,15.4,.25,.2,1.9,.22,0,0,-.3);moonGate.finish();
  const bambooBell=landmark(1,'Ancient Bamboo Bell',20,-108);
  const bell=cached('landmark-bell',()=>new THREE.LatheGeometry([[0,4.3],[.45,4.35],[.85,3.75],[1.04,1.8],[1.8,.38],[2.1,0],[1.98,-.15],[0,-.15]].map(p=>new THREE.Vector2(...p)),24));
  bambooBell.add(bell,mats.gold,0,10,0,1.6,1.6,1.6);
  for(const side of[-1,1]){const stem=cached('landmark-bamboo-'+side,()=>tube([[side*4,0,0],[side*4.4,9,0],[side*3.5,19,.2],[side*1.8,24,.4]],.42,22));bambooBell.add(stem,mats.wood,0,0,0);for(let y=3;y<22;y+=3)bambooBell.add(cylinder,mats.wood,side*(4.4-(y/24)*1.5),y,0,.47,.12,.47);for(let i=0;i<3;i++)bambooBell.add(leafSprig(),mats.leaf,side*(2.7+i*.6),21+i*.9,0,5,4,4,0,side*.6+i*.7,-side*.4);}
  bambooBell.add(cylinder,mats.wood,0,19.2,0,.065,4.2,.065);bambooBell.finish();
  const citadelSpire=landmark(2,'Shattered Ashen Keep',-24,-112);
  for(let tier=0;tier<3;tier++){const width=10-tier*2.4,y=5+tier*8,offset=tier===2?1.2:0;citadelSpire.add(box,mats.dark,offset,y,0,width,10-tier,7-tier,0,tier*.045,tier===2?.055:0);citadelSpire.add(box,mats.stone,offset,y+4.5-tier*.5,0,width+1.1,.5,7.8-tier);for(const side of[-1,1])citadelSpire.add(box,mats.stone,offset+side*width*.43,y+5.4-tier*.5,0,.6,1.7,7.6-tier);}
  citadelSpire.add(box,mats.glow,.7,17.4,3.05,7.8,.13,.07,0,0,.22);citadelSpire.add(box,mats.glow,1.2,23.4,2.55,.16,4.1,.07,0,0,.12);citadelSpire.finish();

  // Firefly/lantern sprite layers stay subtle; the silhouette and road carry the composition.
  function setTheme(index){
    setBossCinematic(false);
    themeIndex=((index%3)+3)%3;const p=palettes[themeIndex];
    scene.background=new THREE.Color(p.sky);scene.fog=new THREE.Fog(p.fog,44,165);
    const skyCtx=skyCanvas.getContext('2d'),gradient=skyCtx.createLinearGradient(0,0,0,256),css=c=>'#'+c.toString(16).padStart(6,'0');
    gradient.addColorStop(0,css(p.sky));gradient.addColorStop(.42,css(p.sky));gradient.addColorStop(.61,css(p.fog));gradient.addColorStop(1,css(p.ground));skyCtx.fillStyle=gradient;skyCtx.fillRect(0,0,4,256);skyTexture.needsUpdate=true;
    for(const name of ['ground','path','stone','wood','leaf','water','mountain','red','moss'])mats[name].color.setHex(p[name]);
    mats.glow.color.setHex(p.accent);mats.window.emissive.setHex(themeIndex===1?0x42977c:0xf78b38);mats.window.color.setHex(themeIndex===1?0xb4f1d0:0xffc58a);
    mats.grass.color.setHex(themeIndex===1?0x315d45:themeIndex===2?0x44333a:0x33463e);
    moonMat.color.setHex(themeIndex===2?0xf3c0b0:themeIndex===1?0xb8ded9:0xd7e3ed);
    moteMat.color.setHex(themeIndex===2?0xff9b71:themeIndex===1?0xa3e3c7:0xa4c0c8);rain.visible=themeIndex!==2;
    for(let i=0;i<3;i++)themeNodes[i].forEach(node=>node.visible=i===themeIndex);
    for(const halo of lanternHalos)halo.material.color.setHex(p.accent);
  }
  function reset(){chunks.forEach((chunk,i)=>chunk.position.z=22-i*length);setGaps([]);setBossCinematic(false);}
  setTheme(0);
  return {group,setTheme,setGaps,setBossCinematic,reset,update(dt,speed,elapsed){
    const travel=speed*dt;
    for(const chunk of chunks){chunk.position.z+=travel;if(chunk.position.z>22+length)chunk.position.z-=total;}
    refreshBossOcclusion();
    for(let i=0;i<250;i++){
      motePositions[i*3]+=(.13+Math.sin(elapsed*.25+i)*.1)*dt;motePositions[i*3+1]+=Math.sin(elapsed*.6+i)*.055*dt;motePositions[i*3+2]+=travel*.8;
      if(motePositions[i*3+2]>22)motePositions[i*3+2]=-148;if(motePositions[i*3]>36)motePositions[i*3]=-36;
    }
    motesGeometry.attributes.position.needsUpdate=true;
    for(let i=0;i<120;i++){
      const o=i*6;rainPositions[o]-=.5*dt;rainPositions[o+1]-=9*dt;rainPositions[o+2]+=travel*.5;
      if(rainPositions[o+1]<0)rainPositions[o+1]=22;if(rainPositions[o+2]>22)rainPositions[o+2]=-92;
      rainPositions[o+3]=rainPositions[o]-.05;rainPositions[o+4]=rainPositions[o+1]-.42;rainPositions[o+5]=rainPositions[o+2]+.05;
    }
    rainGeometry.attributes.position.needsUpdate=true;
    for(let i=0;i<mist.length;i++)mist[i].position.x=(i%3-1)*32+Math.sin(elapsed*.04+i)*8;
    for(let i=0;i<lanternHalos.length;i++)lanternHalos[i].material.opacity=.25+Math.sin(elapsed*2.5+i*2.1)*.035;
    moonHalo.material.opacity=.42+Math.sin(elapsed*.2)*.035;
  }};
}
