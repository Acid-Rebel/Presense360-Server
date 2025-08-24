require('@tensorflow/tfjs-node');
//const faceapi = require('face-api.js');
const {Client} = require('pg');
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const path = require('path');

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join(__dirname, 'face-api.js-models');
const fs = require('fs');
const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'AmritaAttend',
    password: 'sql@123',
    port: 5432,
  });
  client.connect();

async function register(userId,filepath) {
  // Load models
  await faceapi.nets.ssdMobilenetv1.loadFromDisk('./face-api.js-models/ssd_Mobilenetv1');
  await faceapi.nets.faceLandmark68Net.loadFromDisk('./face-api.js-models/face_landmark_68');
  await faceapi.nets.faceRecognitionNet.loadFromDisk('./face-api.js-models/face_recognition');

  // Load image
  const imagePath = path.join(__dirname, filepath);
  const img = await canvas.loadImage(imagePath);

  // Detect face and generate descriptor
  const detection = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    return 'No face detected in the image';
  }

 const descriptor = detection.descriptor;
//   console.log('Face descriptor:', descriptor);
  const arr= Array.from(descriptor); // Convert Float32Array to a regular array
  console.log(arr);
  client.query(`INSERT into face_id values('${userId}', ARRAY[${arr}]::FLOAT8[])`, async(err, ress) => 
    {
        if(err)
        {
            console.log(err);
            return;
        }
    });
}

// Run the async function

register("CSE21002","inp3.jpg")

