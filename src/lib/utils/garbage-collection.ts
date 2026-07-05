import * as THREE from 'three';

export function disposeOfTexture(
  texture: THREE.Texture | THREE.Texture[],
  debug: boolean = false
) {
  if (Array.isArray(texture)) {
    texture.forEach((tex) => disposeOfTexture(tex, debug));
  } else {
    texture.dispose();
    if (debug) console.log(`Disposed texture ${texture.uuid}`);
  }
}

function disposeOfMaterial(
  material: THREE.Material | THREE.Material[],
  debug: boolean = false
) {
  const textureProperties = [
    'map',
    'alphaMap',
    'envMap',
    'lightMap',
    'aoMap',
    'emissiveMap',
    'bumpMap',
    'normalMap',
    'displacementMap',
    'roughnessMap',
    'metalnessMap',
  ];

  if (Array.isArray(material)) {
    material.forEach((mat) => disposeOfMaterial(mat, debug));
  } else {
    textureProperties.forEach((prop) => {
      if (
        (material as THREE.MeshStandardMaterial)[prop] instanceof THREE.Texture
      ) {
        (material as THREE.MeshStandardMaterial)[prop].dispose();
        if (debug)
          console.log(
            `Disposed texture from material ${material.name}, property: ${prop}`
          );
      }
    });

    material.dispose();
    if (debug) console.log(`Disposed material ${material.name}`);
  }
}

export function disposeOfModel(
  model: { scene: THREE.Object3D } | null | undefined,
  debug: boolean = false
) {
  if (!model) return;

  model.scene.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) {
      if ((object as THREE.Mesh).geometry) {
        (object as THREE.Mesh).geometry.dispose();
        if (debug) console.log(`Disposed geometry for ${object.name}`);
      }

      if ((object as THREE.Mesh).material) {
        disposeOfMaterial((object as THREE.Mesh).material, debug);
      }
    }
  });

  if (debug) console.log(`Completed disposing of model resources`);
}
