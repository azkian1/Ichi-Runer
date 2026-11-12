// Authored procedural character meshes for Ichi's Blade. No external model assets.
// Actor roots face -Z and keep the collision origin at their feet.
export function createActors(THREE) {
  const geometries = new Map(), materials = new Map();
  const G = (key, build) => { if (!geometries.has(key)) geometries.set(key, build()); return geometries.get(key); };
  // These authored surface maps make fibres, pores and lacquer respond to grazing light.
  // Generated once per material family; no canvas, external fetch or per-frame texture work.
  const surfaceMaps = new Map();
  function surface(kind) {
    if (surfaceMaps.has(kind)) return surfaceMaps.get(kind);
    const size = 128, pixels = new Uint8Array(size * size * 4), relief = new Uint8Array(size * size * 4), rough = new Uint8Array(size * size * 4);
    const noise = (x,y) => {const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const grain=noise(x,y), warp=Math.sin(x*Math.PI*.5), weft=Math.cos(y*Math.PI*.5), thread=(x%4<2)===(y%4<2)?1:-1;
      let h=.5, value=.92, r=.8;
      if(kind==='cloth'){h=.48+thread*.15+warp*.08+weft*.08+(grain-.5)*.08;value=.91+thread*.045+(grain-.5)*.035;r=.82+thread*.06;}
      else if(kind==='straw'){
        // Alternating over/under ribbons: visible basket weave, not wood grain.
        const over=(Math.floor(x/4)+Math.floor(y/4))%2===0;
        const ribbon=Math.cos((over?x:y)*Math.PI*.5),joint=x%4===0||y%4===0;
        h=.5+ribbon*.16+(joint?-.09:0)+(grain-.5)*.06;
        value=.88+ribbon*.065+(joint?-.07:0)+(grain-.5)*.045;r=.71+(joint?.09:0)+(grain-.5)*.07;
      }
      else if(kind==='leather'){h=.4+Math.sin(x*.19+Math.sin(y*.07)*3)*.05+grain*.17;value=.9+(grain-.5)*.14;r=.57+grain*.15;}
      else if(kind==='skin'){h=.45+grain*.09+Math.sin(x*.1)*Math.cos(y*.1)*.025;value=.94+(grain-.5)*.025;r=.53+grain*.1;}
      else if(kind==='bone'){h=.45+grain*.09+Math.sin(x*.16+y*.02)*.05;value=.92+(grain-.5)*.04;r=.62+grain*.13;}
      else {h=.48+grain*.05;value=.95+(grain-.5)*.04;r=.5+grain*.1;}
      const i=(y*size+x)*4;
      for(let c=0;c<3;c++){pixels[i+c]=Math.max(0,Math.min(255,Math.round(value*255)));relief[i+c]=Math.round(h*255);rough[i+c]=Math.round(r*255);}
      pixels[i+3]=relief[i+3]=rough[i+3]=255;
    }
    function texture(data,color=false){const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;if(color)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;}
    const maps={map:texture(pixels,true),bumpMap:texture(relief),roughnessMap:texture(rough)};surfaceMaps.set(kind,maps);return maps;
  }
  const toon = (key, color, extra = {}) => {
    if (!materials.has(key)) {
      const kind=key.includes('skin')?'skin':key.includes('straw')?'straw':key.includes('bone')?'bone':key.includes('leather')?'leather':'cloth';
      const maps=key.includes('glow')?{}:surface(kind);
      materials.set(key,new THREE.MeshPhysicalMaterial({color,...maps,roughness:kind==='skin'?.57:kind==='leather'?.67:.86,metalness:0,bumpScale:kind==='cloth'?.009:kind==='straw'?.015:.006,sheen:kind==='cloth'?.32:0,sheenColor:new THREE.Color(0x708291),sheenRoughness:.8,...extra}));
    }
    return materials.get(key);
  };
  const metal = (key, color, extra = {}) => {
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .39, metalness: .68, ...extra }));
    return materials.get(key);
  };
  const ink = toon('ink', 0x0b1119), cloth = toon('cloth', 0x243744), clothLit = toon('cloth-lit', 0x485c68);
  const fold = toon('fold', 0x101c27), skin = toon('skin', 0xc99a83), pale = toon('wraps', 0xb5b6aa);
  const hair = toon('hair-black', 0x080e16), leather = toon('leather', 0x3d2d2b), red = toon('red-cloth', 0x7b303b);
  const straw = toon('straw', 0x9d8250), strawDark = toon('straw-dark', 0x675431), strawLight = toon('straw-light', 0xbea16b);
  const steel = metal('steel', 0x8aabb6), blackSteel = metal('black-steel', 0x263744), gold = metal('gold', 0x9d8655);
  const edge = metal('edge', 0xb8e7e7, { emissive: 0x73c7d2, emissiveIntensity: .65, metalness: .35 });
  const sphere = G('sphere', () => new THREE.SphereGeometry(1, 24, 16));
  const cylinder = G('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 20));
  const cone = G('cone', () => new THREE.ConeGeometry(1, 1, 16));
  const torus = G('torus', () => new THREE.TorusGeometry(1, .055, 5, 32));
  const dummy = new THREE.Object3D();
  function group(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  function mesh(parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  function instances(parent, geo, mat, transforms) {
    const result = new THREE.InstancedMesh(geo, mat, transforms.length);
    transforms.forEach((t, i) => { dummy.position.set(t[0], t[1], t[2]); dummy.scale.set(t[3], t[4], t[5]); dummy.rotation.set(t[6] || 0, t[7] || 0, t[8] || 0); dummy.updateMatrix(); result.setMatrixAt(i, dummy.matrix); });
    result.castShadow = result.receiveShadow = true; parent.add(result); return result;
  }
  function curve(key, points, radius = .012, segments = 16, sides = 5) {
    return G(key, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, sides, false));
  }
  function line(parent, key, points, mat, radius = .012) { return mesh(parent, curve(key, points, radius), mat); }
  function lathe(key, points, segments = 32) { return G(key, () => new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), segments)); }
  function tailored(key,profiles,{segments=40,rings=30,folds=0,anatomy=false}={}) {
    return G(key,()=>{
      const positions=[],uv=[],indices=[],min=profiles[0][0],max=profiles.at(-1)[0];
      for(let i=0;i<=rings;i++){
        const v=i/rings,y=min+(max-min)*v;let k=0;while(k<profiles.length-2&&y>profiles[k+1][0])k++;
        const a=profiles[k],b=profiles[k+1],t=(y-a[0])/(b[0]-a[0]),s=t*t*(3-2*t),rx=a[1]+(b[1]-a[1])*s,rz=a[2]+(b[2]-a[2])*s;
        for(let j=0;j<=segments;j++){
          const u=j/segments,theta=u*Math.PI*2,fold=1+folds*(.65*Math.cos(theta*10+v*.45)+.35*Math.cos(theta*17-v*.9));
          let x=Math.cos(theta)*rx*fold,z=Math.sin(theta)*rz*fold;
          if(anatomy&&z<0){const front=Math.pow(-Math.sin(theta),3),pec=.027*Math.exp(-Math.pow((y-.34)/.16,2))*Math.exp(-Math.pow((Math.abs(x)-.17)/.14,2));const abs=.013*Math.exp(-Math.pow((Math.abs(x)-.07)/.09,2))*(Math.exp(-Math.pow((y-.1)/.065,2))+Math.exp(-Math.pow((y+.03)/.065,2))+Math.exp(-Math.pow((y+.14)/.065,2)));z-=(pec+abs)*front;}
          positions.push(x,y,z);uv.push(u,v);
          if(i<rings&&j<segments){const n=i*(segments+1)+j;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2);}
        }
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
    });
  }
  function clothPanel(key, width, length, skew = 0) {
    return G(key, () => {
      const s = new THREE.Shape();
      s.moveTo(-width * .48, 0); s.quadraticCurveTo(0, .07, width * .48, 0);
      s.bezierCurveTo(width * .53, -length * .3, width * .7 + skew, -length * .67, width * .45 + skew, -length);
      s.lineTo(skew, -length * .9); s.lineTo(-width * .51 + skew, -length * .98);
      s.bezierCurveTo(-width * .68, -length * .65, -width * .46, -length * .25, -width * .48, 0);
      const geometry=new THREE.ExtrudeGeometry(s, { depth: .035, bevelEnabled: true, bevelSize: .018, bevelThickness: .012, bevelSegments: 3, steps: 5, curveSegments: 18 });
      const p=geometry.attributes.position;
      for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),v=Math.max(0,Math.min(1,-y/length));p.setZ(i,p.getZ(i)+Math.sin((x/width+.5)*Math.PI*6+v*.55)*.014*Math.sin(v*Math.PI*.8)+Math.sin(v*Math.PI)*.025);}
      geometry.computeVertexNormals();return geometry;
    });
  }
  function katanaGeometry(boss = false) {
    return G(boss ? 'oni-cleaver' : 'katana', () => {
      const s = new THREE.Shape();
      if (boss) {
        s.moveTo(-.17, -.09); s.lineTo(.17, -.09); s.lineTo(.32, -1.15); s.lineTo(.1, -1.62); s.lineTo(-.23, -1.35); s.lineTo(-.17, -.09);
      } else {
        s.moveTo(-.035, -.1); s.lineTo(.075, -.1); s.quadraticCurveTo(.11, -.85, .12, -1.26); s.lineTo(.035, -1.48); s.quadraticCurveTo(.025, -.73, -.035, -.1);
      }
      return new THREE.ExtrudeGeometry(s, { depth: boss ? .075 : .025, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 1, steps: 1 });
    });
  }
  function hornGeometry() {
    return G('curved-horn', () => {
      const points = [[0, 0, 0], [.04, .2, .025], [.14, .4, .02], [.21, .59, -.055], [.18, .74, -.2]];
      const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
      const rings=28,sides=16,frames = c.computeFrenetFrames(rings, false), positions = [], indices = [],uv=[],colors=[];
      for (let i = 0; i <= rings; i++) {
        const t=i/rings,center=c.getPointAt(t),ridge=Math.sin(t*Math.PI*18),radius=(.105*Math.pow(1-t,.8)+.002)*(1+.075*ridge*(1-t));
        const base=new THREE.Color(0x5f493a),ivory=new THREE.Color(0xe5d7b5),tip=new THREE.Color(0x8a8179);
        const pigment=t<.28?base.lerp(ivory,t/.28):ivory.lerp(tip,Math.max(0,(t-.7)/.3));
        for (let j = 0; j <= sides; j++) {
          const a = j / sides * Math.PI * 2,flute=1+.035*Math.cos(a*5)*(1-t),p=center.clone().addScaledVector(frames.normals[i],Math.cos(a)*radius*flute).addScaledVector(frames.binormals[i],Math.sin(a)*radius*flute);
          positions.push(p.x, p.y, p.z);uv.push(j/sides,t);colors.push(pigment.r*(1+ridge*.035),pigment.g*(1+ridge*.035),pigment.b*(1+ridge*.035));
          if (i < rings && j < sides) { const k = i * (sides+1) + j; indices.push(k, k + 1, k + sides+1, k + 1, k + sides+2, k + sides+1); }
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); g.setIndex(indices); g.computeVertexNormals(); return g;
    });
  }

  // Decorations attached to one joint share its animation. Bake only those
  // siblings with identical materials; shoulders, elbows, cloth and head joints
  // remain independent. Repeated guardians reuse the finished GPU geometry.
  const staticBatches = new Map();
  function batchStatic(actor) {
    const joints = [];
    actor.traverse(node => { if (node.isGroup) joints.push(node); });
    const instance = new THREE.Matrix4();
    for (const joint of joints) {
      const buckets = new Map();
      for (const child of joint.children) {
        // Named/authored features, including the perforated oni mask, retain
        // their original identity for inspection and face raycasts.
        if (!child.isMesh || child.isSkinnedMesh || child.name || Object.keys(child.userData).length || Array.isArray(child.material) || child.material.transparent) continue;
        const attributes = Object.entries(child.geometry.attributes).map(([name, a]) => `${name}:${a.itemSize}:${a.normalized}`).sort().join(',');
        const key = `${child.material.uuid}|${attributes}|${child.castShadow}|${child.receiveShadow}|${child.visible}|${child.layers.mask}|${child.renderOrder}|${child.frustumCulled}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(child);
      }
      for (const members of buckets.values()) {
        if (members.length < 2) continue;
        const parts = [];
        for (const child of members) {
          child.updateMatrix();
          const count = child.isInstancedMesh ? child.count : 1;
          for (let i = 0; i < count; i++) {
            const matrix = child.matrix.clone();
            if (child.isInstancedMesh) { child.getMatrixAt(i, instance); matrix.multiply(instance); }
            parts.push({ geometry: child.geometry, matrix });
          }
        }
        const signature = parts.map(p => `${p.geometry.uuid}:${p.matrix.elements.join(',')}`).join('|');
        let geometry = staticBatches.get(signature);
        if (!geometry) {
          const baked = parts.map(({ geometry: source, matrix }) => {
            const g = source.clone().applyMatrix4(matrix);
            // A reflected horn formerly relied on the renderer's front-face
            // switch. Preserve that winding after moving its scale into vertices.
            if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
            if (matrix.determinant() < 0) {
              const indices = g.index.array;
              for (let i = 0; i < indices.length; i += 3) { const a = indices[i + 1]; indices[i + 1] = indices[i + 2]; indices[i + 2] = a; }
            }
            return g;
          });
          const vertexCount = baked.reduce((n, g) => n + g.attributes.position.count, 0);
          const indexCount = baked.reduce((n, g) => n + g.index.count, 0);
          geometry = new THREE.BufferGeometry();
          for (const [name, attribute] of Object.entries(baked[0].attributes)) {
            const values = new attribute.array.constructor(vertexCount * attribute.itemSize);
            let offset = 0;
            for (const part of baked) { values.set(part.attributes[name].array, offset); offset += part.attributes[name].array.length; }
            geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized));
          }
          const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
          let indexOffset = 0, vertexOffset = 0;
          for (const part of baked) {
            for (const index of part.index.array) indices[indexOffset++] = index + vertexOffset;
            vertexOffset += part.attributes.position.count;
          }
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          geometry.computeBoundingBox(); geometry.computeBoundingSphere();
          staticBatches.set(signature, geometry);
        }
        const source = members[0], merged = new THREE.Mesh(geometry, source.material);
        merged.castShadow = source.castShadow; merged.receiveShadow = source.receiveShadow;
        merged.visible = source.visible; merged.layers.mask = source.layers.mask;
        merged.renderOrder = source.renderOrder; merged.frustumCulled = source.frustumCulled;
        merged.matrixAutoUpdate = false;
        joint.remove(...members); joint.add(merged);
      }
    }
    return actor;
  }

  function createIchi() {
    const actor = new THREE.Group(); actor.name = 'Ichi · bamboo-hat swordsman';
    // Rotation about the hips keeps the somersault separate from physical height.
    const visual = group(actor, 0, 1.13, 0), content = group(visual, 0, -1.13, 0);
    const body = group(content, 0, 1.16, 0);
    const torso = tailored('robe-torso', [[-.25,.245,.155],[-.13,.275,.17],[.08,.255,.175],[.32,.29,.18],[.43,.28,.16],[.53,.16,.13],[.56,.08,.09]],{folds:.024});
    mesh(body, torso, cloth, 0, .01, 0);
    mesh(body, clothPanel('back-mantle', .57, .53), clothLit, 0, .49, .17, 1, 1, 1, -.06);
    line(body, 'lapel-l', [[-.25, .48, -.135], [-.12, .28, -.205], [.11, -.08, -.185]], pale, .029);
    line(body, 'lapel-r', [[.24, .47, -.135], [.08, .24, -.22], [-.1, -.08, -.185]], clothLit, .042);
    line(body, 'back-strap-l', [[-.27, .45, .17], [-.06, .15, .23], [.18, -.11, .185]], leather, .026);
    line(body, 'back-strap-r', [[.25, .43, .17], [.06, .16, .24], [-.18, -.11, .185]], clothLit, .018);
    for (let i = 0; i < 3; i++) mesh(body, torus, i === 1 ? leather : fold, 0, -.1 + i * .034, 0, .295, .21, .295, Math.PI / 2);
    mesh(body, sphere, leather, -.05, -.08, .22, .065, .05, .045);
    line(body, 'obi-tie', [[-.04, -.05, .22], [-.14, -.16, .24], [-.12, -.27, .25]], leather, .018);
    const beads = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; beads.push([Math.cos(a) * .16, .54 + Math.sin(a) * .01, Math.sin(a) * .13, .025, .025, .025]); }
    instances(body, sphere, gold, beads);
    // Overlapping lacquered scales and brass fasteners give the waist an actual
    // samurai silhouette. They bake into two existing/static material batches.
    const lamellar=metal('ichi-lamellar',0x283c49,{roughness:.48,metalness:.48});
    const plate=G('obi-lamella',()=>{
      const s=new THREE.Shape();s.moveTo(-.044,.006);s.lineTo(.044,.006);s.lineTo(.047,-.061);s.quadraticCurveTo(0,-.098,-.047,-.061);s.closePath();
      return new THREE.ExtrudeGeometry(s,{depth:.008,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:1,curveSegments:4,steps:1});
    });
    const scales=[],fasteners=[];
    for(let row=0;row<2;row++)for(let i=0;i<14;i++){
      const a=(i+(row?.5:0))/14*Math.PI*2,x=Math.sin(a)*.295,z=Math.cos(a)*.208,y=-.115-row*.066;
      scales.push([x,y,z,1,1,1,0,a,0]);
      for(const side of[-1,1])fasteners.push([x+Math.cos(a)*side*.025+Math.sin(a)*.014,y-.014,z-Math.sin(a)*side*.025+Math.cos(a)*.014,.0075,.0075,.004,0,a,0]);
    }
    instances(body,plate,lamellar,scales);
    instances(body,G('obi-rivet',()=>new THREE.SphereGeometry(1,8,4)),gold,fasteners);
    mesh(body,torus,gold,0,-.105,0,.3,.219,.3,Math.PI/2);
    const crest=G('three-leaf-kamon',()=>{
      const ring=new THREE.Shape();ring.absarc(0,0,.079,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,.069,0,Math.PI*2,true);ring.holes.push(hole);
      const shapes=[ring];
      for(let i=0;i<3;i++){
        const a=i*Math.PI*2/3,point=(x,y)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)],leaf=new THREE.Shape();
        leaf.moveTo(...point(0,.009));leaf.quadraticCurveTo(...point(-.027,.03),...point(-.015,.06));leaf.quadraticCurveTo(...point(.023,.058),...point(0,.009));shapes.push(leaf);
      }
      return new THREE.ShapeGeometry(shapes,10);
    });
    mesh(body,crest,pale,0,.29,.263);

    const legs = [], knees = [];
    const sleeve = tailored('tailored-sleeve',[[-.29,.115,.12],[-.22,.135,.135],[.02,.157,.145],[.16,.14,.13],[.2,.08,.08]],{folds:.034,rings:22,segments:32});
    const thigh=tailored('hakama-thigh',[[-.43,.12,.125],[-.31,.145,.14],[-.08,.158,.145],[.02,.14,.13]],{folds:.035,rings:22,segments:32});
    const shin=tailored('hakama-shin',[[-.39,.085,.1],[-.25,.105,.115],[-.04,.13,.125],[.025,.123,.12]],{folds:.03,rings:22,segments:32});
    const forearm=tailored('wrapped-forearm',[[-.29,.062,.066],[-.21,.079,.077],[-.04,.088,.08],[.04,.075,.07]],{folds:.012,rings:18,segments:28});
    const arms = [], elbows = [];
    for (const side of [-1, 1]) {
      const hip = group(content, side * .165, 1.02, 0);
      mesh(hip, thigh, ink, 0, 0, 0, 1, 1, 1, 0, 0, side * -.035);
      const knee = group(hip, 0, -.4, 0);
      mesh(knee, shin, cloth);
      mesh(knee, sphere, ink, 0, -.495, -.085, .145, .105, .24);
      const wraps = [];
      for (let i = 0; i < 4; i++) wraps.push([0, -.27 - i * .035, 0, .132, .125, .132, Math.PI / 2, 0, (i % 2 ? 1 : -1) * .14]);
      instances(knee, torus, pale, wraps);
      line(knee, 'tabi-seam', [[-.02, -.505, -.31], [-.025, -.475, -.15], [-.02, -.455, .02]], fold, .006);
      legs.push(hip); knees.push(knee);

      const shoulder = group(body, side * .315, .39, -.055);
      mesh(shoulder, sleeve, cloth, side * .025, -.06, 0, 1, 1, 1, 0, 0, side * -.07);
      mesh(shoulder, torus, fold, side * .025, -.31, 0, .117, .11, .12, Math.PI / 2);
      const elbow = group(shoulder, side * .03, -.31, -.02);
      mesh(elbow, forearm, fold);
      const bands = [];
      for (let i = 0; i < 4; i++) bands.push([0, -.1 - i * .045, 0, .095, .09, .095, Math.PI / 2, 0, .18]);
      instances(elbow, torus, pale, bands);
      mesh(elbow, sphere, skin, 0, -.31, -.015, .08, .1, .07);
      mesh(elbow, sphere, skin, -side * .07, -.29, -.015, .04, .065, .045, 0, 0, side * .6);
      const knuckles=[];for(let k=0;k<4;k++)knuckles.push([(k-1.5)*.032,-.33,-.072,.021,.036,.022]);instances(elbow,sphere,skin,knuckles);
      line(shoulder,'sleeve-seam-'+side,[[side*.1,.08,.075],[side*.135,-.1,.09],[side*.1,-.28,.07]],clothLit,.0055);
      arms.push(shoulder); elbows.push(elbow);
    }
    const tails = [];
    for (const side of [-1, 1]) {
      const tail = group(body, side * .18, -.14, .14);
      mesh(tail, clothPanel('robe-tail', .37, .76), side < 0 ? cloth : fold, 0, 0, 0, 1, 1, 1);
      for (let f = 0; f < 2; f++) line(tail, 'tail-fold-' + f, [[(f - .5) * .17, -.05, .045], [(f - .5) * .2, -.32, .06], [(f - .5) * .23, -.66, .055]], clothLit, .008);
      tails.push(tail);
    }
    const frontTail = group(body, 0, -.17, -.16);
    mesh(frontTail, clothPanel('front-tail', .42, .57), ink, 0, 0, 0, 1, 1, 1, .12); tails.push(frontTail);
    const scarf = group(body, -.12, .5, .12);
    mesh(scarf, clothPanel('scarf-a', .16, .53, .09), red, 0, .04, 0, 1, 1, 1, -1.1, .2, -.25);
    const scarfTip = group(scarf, .08, -.23, .43);
    mesh(scarfTip, clothPanel('scarf-b', .12, .43, -.05), red, 0, 0, 0, 1, 1, 1, -1.2, .1);

    const head = group(body, 0, .72, -.015);
    mesh(head, cylinder, skin, 0, -.1, 0, .08, .16, .08);
    mesh(head, sphere, skin, 0, .06, -.01, .16, .2, .145);
    mesh(head, sphere, hair, 0, .15, .035, .19, .18, .16);
    mesh(head,sphere,skin,0,.025,-.155,.027,.051,.04);
    line(head,'lower-lip',[[-.042,-.025,-.143],[0,-.035,-.153],[.042,-.025,-.143]],leather,.004);
    // Dark loose hair remains visible below the hat, especially from behind.
    mesh(head, clothPanel('hair-tail', .17, .28, .015), hair, 0, .07, .16, 1, 1, 1, -.12);
    for(let i=0;i<5;i++){const x=(i-2)*.055;line(head,'nape-hair-'+i,[[x,.14,.17],[x*1.05,.01,.178],[x*.7,-.15-(i%2)*.025,.155]],hair,.014);}
    for (const side of [-1, 1]) {
      mesh(head, sphere, skin, side * .16, .055, -.005, .035, .06, .035);
      line(head, 'eyebrow-' + side, [[side * .03, .11, -.146], [side * .09, .12, -.147], [side * .13, .1, -.133]], hair, .012);
      line(head, 'eye-' + side, [[side * .04, .078, -.15], [side * .1, .077, -.147]], pale, .006);
    }
    const hat = group(head, 0, .2, .015);
    const hatProfile=[[0,.27],[.065,.25],[.18,.19],[.34,.09],[.51,-.015],[.62,-.085]];
    const hatHeight=r=>{let i=0;while(i<hatProfile.length-2&&r>hatProfile[i+1][0])i++;const a=hatProfile[i],b=hatProfile[i+1];return a[1]+(b[1]-a[1])*(r-a[0])/(b[0]-a[0]);};
    mesh(hat, lathe('kasa', [...hatProfile, [.615, -.1], [.5, -.045], [.32, .06], [.15, .16], [0, .24]], 48), straw);
    mesh(hat, torus, strawDark, 0, -.088, 0, .615, .615, .615, Math.PI / 2);
    const weaves = [];
    for (let i = 0; i < 13; i++) { const r = .06 + i * .043; weaves.push([0,hatHeight(r)+.008,0,r,r,r,Math.PI/2]); }
    instances(hat,G('kasa-weave',()=>new THREE.TorusGeometry(1,.012,4,48)),strawDark,weaves);
    const ribs = [];
    for (let i = 0; i < 32; i++) {
      ribs.push([0,0,0,1,1,1,0,i*Math.PI/16,0]);
    }
    const meridian=G('kasa-radial-weave',()=>{
      const points=[];for(let i=0;i<=12;i++){const r=.035+i*.048;points.push(new THREE.Vector3(r,hatHeight(r)+.008+Math.sin(i*Math.PI*.9)*.0025,0));}
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,.0035,4,false);
    });
    instances(hat,meridian,strawLight,ribs);
    line(head, 'hat-chin-cord', [[-.27, .15, .015], [-.18, -.09, -.015], [0, -.155, -.04], [.18, -.09, -.015], [.27, .15, .015]], strawDark, .009);

    const sword = group(elbows[1], 0, -.31, -.025);
    mesh(sword, cylinder, leather, 0, .07, 0, .038, .27, .038);
    const handleWrap = [];
    for (let i = 0; i < 6; i++) handleWrap.push([0, -.035 + i * .043, 0, .042, .042, .042, Math.PI / 2, 0, (i % 2 ? 1 : -1) * .24]);
    instances(sword, torus, pale, handleWrap);
    mesh(sword, sphere, gold, 0, .225, 0, .047, .025, .047);
    mesh(sword, torus, blackSteel, 0, -.075, 0, .15, .11, .15, Math.PI / 2);
    mesh(sword, katanaGeometry(), steel, 0, 0, -.0125);
    line(sword, 'katana-hamon', [[.066, -.14, .018], [.079, -.5, .019], [.1, -.9, .019], [.109, -1.25, .019], [.04, -1.43, .019]], edge, .009);
    sword.rotation.set(1.1, .04, -.25);
    actor.userData = { visual, content, body, head, hat, legs, knees, arms, elbows, tails, scarf, scarfTip, sword, actorType: 'ichi', height: 2.45 };
    return batchStatic(actor);
  }

  function createDemon(isBoss = false, theme = 0) {
    const actor = new THREE.Group(); actor.name = isBoss ? 'Oni · shrine-devouring warlord' : 'Oni · broken temple guardian';
    const visual = group(actor), body = group(visual, 0, 1.04, 0);
    const colors = [0x743b47, 0x425d65, 0x713b30], index = ((theme % 3) + 3) % 3;
    const skinD = toon('oni-skin-' + index, colors[index]);
    const armor = metal('oni-armor', 0x26313d, { roughness: .52 });
    const bone = toon('oni-bone', 0xbcb09a), boneDark = toon('oni-bone-dark', 0x59433f);
    const horn=toon('oni-bone-horn',0xc7b99e,{vertexColors:true,roughness:.7});
    const maskBone=toon('oni-bone-mask',0xc8b99e,{vertexColors:true,roughness:.73});
    const glow = toon('oni-glow-' + index, [0xff956c, 0x98e8ca, 0xff7048][index], { emissive: [0xf1492f, 0x35b999, 0xf33d15][index], emissiveIntensity: 1.4 });
    const torsoWidth = isBoss ? .56 : .39;
    const torso=tailored('oni-anatomy-'+isBoss,[[-.28,torsoWidth*.6,.19],[-.14,torsoWidth*.63,.2],[.1,torsoWidth*.76,.245],[.34,torsoWidth,.275],[.49,torsoWidth*.93,.225],[.61,torsoWidth*.59,.18],[.72,.135,.13]],{anatomy:true,rings:44,segments:48});
    mesh(body,torso,skinD);
    for (const side of [-1, 1]) {
      line(body, 'oni-rib-' + side, [[side * .22, .24, -.25], [side * .14, .03, -.255], [side * .1, -.16, -.2]], boneDark, .012);
      line(body,'oni-pectoral-seam-'+side,[[side*.035,.37,-.292],[side*.17,.29,-.3],[side*torsoWidth*.78,.3,-.22]],skinD,.009);
    }
    line(body,'oni-sternum',[[0,.51,-.24],[0,.28,-.287],[0,-.13,-.205]],boneDark,.008);
    const upperLeg=tailored('oni-thigh',[[-.44,.135,.14],[-.26,.175,.185],[-.08,.17,.16],[.07,.13,.13]],{anatomy:false,rings:24,segments:32});
    const upperArm=tailored('oni-upper-arm',[[-.44,.13,.13],[-.28,.177,.17],[-.11,.193,.18],[.13,.145,.15]],{rings:24,segments:32});
    const bracer=tailored('oni-bracer',[[-.34,.102,.1],[-.2,.147,.138],[.03,.15,.145],[.08,.132,.13]],{rings:22,segments:32,folds:.012});
    const shoulderArmor=G('sculpted-pauldron',()=>new THREE.SphereGeometry(1,28,18,0,Math.PI*2,0,Math.PI*.62));
    const legs = [], arms = [], elbows = [];
    for (const side of [-1, 1]) {
      const leg = group(visual, side * .22, .94, 0);
      mesh(leg, upperLeg, skinD,0,0,0);
      mesh(leg, bracer, armor, 0, -.42, .01, .95, 1.1, 1.05, -.07);
      mesh(leg, sphere, ink, 0, -.84, -.1, .19, .12, .28);
      mesh(leg, sphere, boneDark, 0, -.42, -.13, .15, .14, .065);
      const toes=[];for(let i=0;i<3;i++)toes.push([(i-1)*.085,-.86,-.31,.028,.13,.035,-Math.PI/2,0,0]);instances(leg,cone,bone,toes);
      legs.push(leg);
      const arm = group(body, side * (torsoWidth + .035), .45, 0);
      mesh(arm, upperArm, skinD, side * .045, -.02, 0,1,1,1, 0, 0, side * .08);
      mesh(arm, shoulderArmor, armor, side * .025, .03, .01, isBoss ? .32 : .25, .2, .28,0,0,-side*.2);
      line(arm,'pauldron-edge-'+side,[[-.23,-.025,.02],[-.16,.035,-.21],[0,.06,-.27],[.16,.035,-.21],[.23,-.025,.02]],gold,.009);
      const elbow = group(arm, side * .07, -.4, 0);
      mesh(elbow, bracer, armor);
      mesh(elbow, sphere, skinD, 0, -.36, -.025, .145, .15, .1);
      const claws = [];
      for (let i = 0; i < 3; i++) claws.push([(i - 1) * .075, -.48, -.095, .022, .19, .027, -.55, 0, (i - 1) * .16]);
      instances(elbow, cone, bone, claws);
      const spikes = [];
      for (let i = 0; i < (isBoss ? 3 : 2); i++) spikes.push([side * (.07 + i * .08), .19 + (i % 2) * .025, .03, .045, isBoss ? .28 : .19, .045, .1, 0, -side * .42]);
      instances(arm, cone, boneDark, spikes);
      arms.push(arm); elbows.push(elbow);
    }
    mesh(body, torus, leather, 0, -.19, 0, .27, .23, .27, Math.PI / 2);
    mesh(body, clothPanel('oni-loincloth', .43, .57), red, 0, -.17, -.19, 1, 1, 1, .1);
    mesh(body, clothPanel('oni-loincloth-back', .42, .49), ink, 0, -.16, .17, 1, 1, 1, -.1);
    const head = group(body, 0, .86, -.015);
    mesh(head, sphere, skinD, 0, .015, .015, .28, .31, .245);
    const maskShape = G('oni-mask', () => {
      const s = new THREE.Shape(); s.moveTo(0, .31); s.bezierCurveTo(.15, .33, .29, .18, .25, -.02); s.quadraticCurveTo(.22, -.2, .11, -.27); s.lineTo(0, -.31); s.lineTo(-.11, -.27); s.quadraticCurveTo(-.22, -.2, -.25, -.02); s.bezierCurveTo(-.29, .18, -.15, .33, 0, .31);
      // The eyes and mouth are real apertures. Painting eyes behind a solid extruded
      // face used to hide them completely from the frontal gameplay view.
      for(const side of[-1,1]){
        const eye=new THREE.Path();eye.moveTo(side*.035,.098);eye.quadraticCurveTo(side*.12,.13,side*.222,.165);eye.quadraticCurveTo(side*.232,.063,side*.17,.027);eye.lineTo(side*.055,.045);eye.quadraticCurveTo(side*.033,.067,side*.035,.098);s.holes.push(eye);
      }
      const mouth=new THREE.Path();mouth.moveTo(-.145,-.122);mouth.quadraticCurveTo(0,-.095,.145,-.122);mouth.quadraticCurveTo(.143,-.218,.086,-.244);mouth.quadraticCurveTo(0,-.265,-.086,-.244);mouth.quadraticCurveTo(-.143,-.218,-.145,-.122);s.holes.push(mouth);
      const geometry=new THREE.ExtrudeGeometry(s, { depth: .09, bevelEnabled: true, bevelSize: .012, bevelThickness: .025, bevelSegments: 3, curveSegments: 18, steps: 1 });
      const p=geometry.attributes.position,colors=[];
      for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),patina=.77+.22*Math.exp(-Math.pow(x/.23,2)-Math.pow((y-.025)/.35,2))+.015*Math.sin(x*51+y*23);colors.push(patina,patina*.97,patina*.9);}
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geometry;
    });
    const mask=mesh(head, maskShape, maskBone, 0, .005, -.285, 1, 1, 1, 0, Math.PI);mask.name='Oni mask · open eyes and mouth';
    mask.userData.eyeApertures=2;mask.userData.mouthAperture=true;
    mesh(head, sphere, ink, 0, -.18, -.35, .155, .085, .025);
    line(head,'oni-jaw-rim',[[-.145,-.16,-.415],[-.105,-.255,-.413],[0,-.285,-.393],[.105,-.255,-.413],[.145,-.16,-.415]],boneDark,.018);
    mesh(head,tailored('oni-tapered-snout',[[-.095,.057,.039],[-.06,.072,.055],[.005,.04,.045],[.14,.024,.024]],{rings:20,segments:24}),bone,0,0,-.412);
    for(const side of[-1,1])mesh(head,sphere,ink,side*.039,-.064,-.455,.021,.009,.012,0,0,side*.18);
    const fangs = [];
    for(const side of[-1,1])fangs.push([side*.112,-.143,-.424,.023,.133,.024,0,0,Math.PI+side*.08]);
    for(let i=0;i<4;i++){const x=(i-1.5)*.036;fangs.push([x,-.132,-.422,.016,.053,.018,0,0,Math.PI]);fangs.push([x,-.232,-.413,.014,.042,.016,0,0,0]);}
    instances(head, cone, bone, fangs);
    for (const side of [-1, 1]) {
      mesh(head, sphere, ink, side * .115, .09, -.328, .095, .055, .025, 0, 0, side * -.2);
      mesh(head, sphere, glow, side * .12, .09, -.353, .067, .023, .012, 0, 0, side * -.24);
      line(head, 'oni-brow-' + side, [[side * .035, .145, -.423], [side * .115, .174, -.43], [side * .217, .209, -.407]], boneDark, .026);
      line(head,'oni-cheek-engraving-'+side,[[side*.23,.04,-.408],[side*.18,-.055,-.425],[side*.2,-.13,-.414],[side*.105,-.23,-.415]],red,.013);
      line(head,'oni-forehead-engraving-'+side,[[side*.1,.25,-.41],[side*.145,.215,-.423],[side*.1,.19,-.429]],gold,.006);
      mesh(head, hornGeometry(), horn, side * .19, .27, -.015, side * (isBoss ? 1.2 : .9), isBoss ? 1.15 : .78, isBoss ? 1.15 : .8, -.1, 0, -side * .12);
      mesh(head, sphere, skinD, side * .29, .01, .015, .1, .12, .055, 0, 0, side * -.5);
    }
    line(head, 'oni-mask-crack', [[-.075, .26, -.412], [-.035, .19, -.425], [-.016, .08, -.433], [-.025, .01, -.438]], glow, .006);
    let sword = null;
    if (isBoss) {
      const charms = [];
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; charms.push([Math.cos(a) * .25, .64 + Math.sin(a) * .04, Math.sin(a) * .21, .048, .048, .048]); }
      instances(body, sphere, gold, charms);
      mesh(body, sphere, armor, 0, .21, .24, .3, .4, .08);
      sword = group(elbows[1], .05, -.35, -.02);
      mesh(sword, cylinder, leather, 0, .08, 0, .058, .39, .058);
      mesh(sword, torus, gold, 0, -.15, 0, .2, .12, .2, Math.PI / 2);
      mesh(sword, katanaGeometry(true), armor, 0, -.1, -.03);
      line(sword, 'cleaver-edge', [[.17, -.2, .06], [.25, -.82, .06], [.31, -1.24, .06], [.12, -1.59, .06]], glow, .018);
      sword.rotation.set(-1.04, 0, -.22);
    }
    actor.userData = { visual, body, head, arms, elbows, legs, sword, isBoss, theme: index, actorType: 'demon', height: isBoss ? 2.9 : 2.62 };
    return batchStatic(actor);
  }

  // Attack arrives as a remaining fraction (1 -> 0 over .42 seconds).
  // The cut crosses the front at .14 s, then follows through high on the left.
  // Late keys bring the sword back around the outside, clear of the torso.
  const slashKeys = [
    [0, -.4, -.12, .16, .42, .24, -.44, .86, 0],
    [.1, -.55, -.18, .3, .48, .35, -.48, .8, -.18],
    [.215, .1, -.28, .3, .7, .75, .1, -.65, -.07],
    [1 / 3, .8, -.2, .15, .7, -.6, .25, -.75, .1],
    [.67, 1, .35, -.85, 1.1, -.75, .62, -.23, .38],
    [.77, 1, .35, -.85, 1.1, -.75, .62, -.23, .38],
    [.84, .9, .18, -.5, .95, -.3, .7, -.65, .24],
    [.91, .2, -.15, .35, .65, .8, .45, -.4, .05],
    [1, -.4, -.12, .16, .42, .24, -.44, .86, 0]
  ];
  const bladeAxis = new THREE.Vector3(0, -1, 0), bladeDirection = new THREE.Vector3();
  const bladeOrientation = new THREE.Quaternion(), bladeParent = new THREE.Quaternion();
  function orientBlade(d) {
    bladeOrientation.setFromUnitVectors(bladeAxis, bladeDirection.normalize());
    bladeParent.copy(d.arms[1].quaternion).multiply(d.elbows[1].quaternion).invert();
    d.sword.quaternion.copy(bladeParent).multiply(bladeOrientation);
  }
  function animateIchi(actor, state) {
    const d = actor.userData, t = Number(state.elapsed) || 0;
    const moving = Math.min(1, Math.abs(Number(state.speed) || 0)), airborne = Number(state.jump) > .1;
    const attack = Math.max(0, Math.min(1, Number(state.attack) || 0));
    const flip = Math.max(0, Math.min(1, Number(state.flip) || 0)), tuck = flip > .02 && flip < .94;
    const slideInput=Math.max(0,Math.min(1,Number(state.slide)||0)),stride=Math.sin(t*12.7)*moving;
    const pose=d.poseBlend??={time:t,slide:slideInput,air:airborne?1:0,lean:Number(state.lean)||0};
    const dt=t-pose.time,continuous=dt>0&&dt<=.1,weight=continuous?1-Math.exp(-24*dt):1;
    pose.slide+=(slideInput-pose.slide)*weight;pose.air+=((airborne?1:0)-pose.air)*weight;pose.lean+=((Number(state.lean)||0)-pose.lean)*weight;pose.time=t;
    if(Math.abs(pose.slide-slideInput)<.0001)pose.slide=slideInput;
    if(Math.abs(pose.air-(airborne?1:0))<.0001)pose.air=airborne?1:0;
    const slide=pose.slide,air=pose.air,sliding=slideInput>0;
    const mix=(a,b,w)=>a+(b-a)*w;
    const boost=Math.max(0,Math.min(1,Number(state.boost)||0));
    const rush=airborne||sliding||flip>.02?0:boost;
    d.visual.visible = true; // Keep the silhouette readable during jumps and recovery.
    d.visual.position.y = 1.13 - slide * .58;
    d.visual.rotation.x = -Math.PI * 2 * flip - slide * .55;
    d.visual.rotation.z = -Math.max(-.8,Math.min(.8,pose.lean)) * .075;
    d.body.position.y = 1.16 + Math.abs(Math.sin(t * 12.7)) * .035 * moving*(1-air)*(1-slide);
    d.body.rotation.set(-.07 - moving * .065-rush*.16, 0, 0);
    d.head.rotation.set(.045+rush*.09, 0, 0);
    d.hat.rotation.z = Math.sin(t * 6.3) * .015 * moving;
    for (let i = 0; i < 2; i++) {
      const p = i ? -stride : stride, sign = i ? -1 : 1;
      d.legs[i].rotation.x=mix(tuck?-.95:mix(p*(.8+rush*.12),i?.45:-.65,air),-1.1,slide);
      d.knees[i].rotation.x=mix(tuck?1.75:mix(Math.max(0,-p)*1.03,.9,air),1.95,slide);
      // The left hand balances in front. The sword hand rests by the right hip;
      // jump/slide/flip keep their protected, tucked arm poses.
      d.arms[i].rotation.x=mix(tuck?.95:mix(.32+p*.18+rush*.1,.62,air),1.02,slide);
      d.arms[i].rotation.z = sign * .11;
      d.arms[i].rotation.y = sign * -.1;
      d.elbows[i].rotation.x=mix(tuck?1.4:1.15+p*.1+rush*.05,.88,slide);
      if(i===1&&flip<=.02){
        // Blend from this arm's hip carry on BOTH edges of slide. Choosing the
        // left arm's run pose during entry or snapping back while residual
        // slide remains creates a >1-radian jump in a single rendered frame.
        d.arms[i].rotation.set(mix(mix(-.4+p*.06+rush*.04,.62,air),1.02,slide),mix(mix(-.12,sign*-.1,air),sign*-.1,slide),mix(mix(.16,sign*.11,air),sign*.11,slide));
        d.elbows[i].rotation.x=mix(mix(.42+p*.04,1.15+p*.1+rush*.05,air),.88,slide);
      }
      d.tails[i].rotation.set(-.28-moving*.45-rush*.32-Math.sin(t*10+i)*(.1+rush*.06),Math.sin(t*8+i)*(.1+rush*.04),-sign*(.11+moving*.12+rush*.08));
    }
    d.tails[2].rotation.x = .08-rush*.12 + Math.sin(t * 9) * .07;
    d.sword.rotation.set(1.15,.04,-.16);
    if(attack>0&&!sliding&&flip<=.02){
      const progress=1-attack;
      let key=0;while(key<slashKeys.length-2&&progress>slashKeys[key+1][0])key++;
      const a=slashKeys[key],b=slashKeys[key+1],u=(progress-a[0])/(b[0]-a[0]),w=u*u*(3-2*u),v=1-w;
      d.arms[1].rotation.set(a[1]*v+b[1]*w,a[2]*v+b[2]*w,a[3]*v+b[3]*w);
      d.elbows[1].rotation.set(a[4]*v+b[4]*w,0,0);
      d.body.rotation.y=a[8]*v+b[8]*w;d.head.rotation.y=-d.body.rotation.y*.45;
      bladeDirection.set(a[5]*v+b[5]*w,a[6]*v+b[6]*w,a[7]*v+b[7]*w);orientBlade(d);
    }else if(!airborne&&!sliding&&flip<=.02){
      // A diagonal rearward blade clears the ground and stays outside the legs.
      bladeDirection.set(.24,-.44,.86);orientBlade(d);
    }
    d.scarf.rotation.set(Math.sin(t*11)*(.13+rush*.07)-moving*.1-rush*.27,Math.sin(t*7)*(.13+rush*.04),0);
    d.scarfTip.rotation.x = Math.sin(t*12+1.1)*(.2+rush*.14)-rush*.18;
  }
  function animateDemon(actor, elapsed, attacking) {
    const d = actor.userData, t = Number(elapsed) || 0, attack = Math.max(0, Math.min(1, Number(attacking) || 0));
    d.visual.rotation.z = Math.sin(t * 2.1) * .018;
    d.body.position.y = 1.04 + Math.sin(t * 3.3) * .025;
    d.body.rotation.x = -.045; d.head.rotation.x = .04 + Math.sin(t * 2.6) * .025;
    for (let i = 0; i < 2; i++) { const side = i ? 1 : -1; d.arms[i].rotation.z = side * (.18 + attack * .5); d.arms[i].rotation.x = .12 + Math.sin(t * 7) * side * .1 + attack * .8; d.elbows[i].rotation.x = .22 + attack * .45; d.legs[i].rotation.x = Math.sin(t * 7) * side * (d.isBoss ? .07 : .22); }
    if (d.sword) d.sword.rotation.x = 1.04 - attack * 1.2;
  }
  return { createIchi, createDemon, animateIchi, animateDemon };
}
