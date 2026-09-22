const THREE = require('three');
const fs = require('fs');

console.log('Testing card.glb exists and size:', fs.statSync('public/card.glb').size);
