require('@tensorflow/tfjs-node'); // Enables the fast native TensorFlow backend
//const faceapi = require('face-api.js');
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const path = require('path');
const fs = require('fs');

// Patch nodejs environment, we need to provide an implementation of
// HTMLCanvasElement and HTMLImageElement
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join(__dirname, '/face-api.js-models');

async function run() {
  await faceapi.nets.ssdMobilenetv1.loadFromDisk('./face-api.js-models/ssd_Mobilenetv1');
  await faceapi.nets.faceLandmark68Net.loadFromDisk('./face-api.js-models/face_landmark_68');
  await faceapi.nets.faceRecognitionNet.loadFromDisk('./face-api.js-models/face_recognition');



const imagePath = path.join(__dirname, '/ajeth.jpg');
const imageBuffer = fs.readFileSync(imagePath);
const img = await canvas.loadImage(imageBuffer);


const singleResult = await faceapi
  .detectSingleFace(img)
  .withFaceLandmarks()
  .withFaceDescriptor();

if (!singleResult) {
  console.log('No face detected');
  return;
}
else
{
  console.log(imageBuffer);
  console.log(img);
  console.log('face detected');
}

const descriptor = singleResult.descriptor;


// Example: Load reference descriptors from a JSON file
const referenceData = JSON.parse(fs.readFileSync('faceDescriptor.json'));
const labeledDescriptors = referenceData.map(person => new faceapi.LabeledFaceDescriptors(
  person.label,
  person.descriptors.map(d => new Float32Array(d))
));

const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors);

const bestMatch = faceMatcher.findBestMatch(descriptor);
console.log(`Best match: ${bestMatch.toString()}`);
}

run().catch(console.error);
