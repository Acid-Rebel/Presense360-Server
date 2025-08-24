// faceAuth.js
const tf = require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const path = require('path');
const jwt = require('jsonwebtoken');
//const { generateAuthToken } = require('./index');

// const fs = require('fs');
// const { v4: uuidv4 } = require('uuid');
const AUTH_KEY='123456789';
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join(__dirname, 'face-api.js-models');

async function loadModels() {
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(MODEL_PATH, 'ssd_mobilenetv1'));
  await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(MODEL_PATH, 'face_landmark_68'));
  await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(MODEL_PATH, 'face_recognition'));
  console.log('✅ Face API models loaded');
}

function generateAuthToken(userId,action) {
  return jwt.sign(
    {
      userId: userId,
      action: action,
    },
    AUTH_KEY,
    { expiresIn: '2m' }
  );
}

async function handleFaceAuth(ws, descriptorDB, userId, attemptNo ,action,onCloseCallback) 
{
  //const descriptorDB = await getDescriptorForUser(userId);
  if (!descriptorDB) 
  {
    console.log('❌ Unknown user');
    ws.send('❌ Unknown user');
    ws.close(4001);
    onCloseCallback(userId, 'fail');
    return;
  }

  let count = 0;

  ws.on('message', async (message) => 
    {
    try 
    {
      attemptNo+=1;
      const buffer = Buffer.from(message.toString(), 'base64');
      const img = await canvas.loadImage(buffer);

      //Save image to img/ folder with a unique name
    //   const imgDir = path.join(__dirname, 'img');
    // if (!fs.existsSync(imgDir)) {
    //   fs.mkdirSync(imgDir); // create img folder if not exists
    // }

    // const filename = `img_${Date.now()}_${uuidv4().slice(0, 8)}.jpg`;
    // const filepath = path.join(imgDir, filename);
    // fs.writeFileSync(filepath, buffer);
    // console.log(`📷 Image saved to ${filepath}`);

      const result = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

        if (result) 
        {
         
        console.log(result.descriptor.length);
        console.log(descriptorDB.length);
        const distance = faceapi.euclideanDistance(result.descriptor, descriptorDB);
        console.log(`🔍 Distance: ${distance.toFixed(4)}`);
        
        if (distance <= 0.35) 
        {
          const authToken = generateAuthToken(userId,action);
          console.log('✅ Face matched');
          ws.send(JSON.stringify({
          status: "success",
          message: "✅ Face matched",
          actionToken: authToken
         }));
          ws.close(1000);
          onCloseCallback(userId, 'success');
        } 
        else 
        {
          console.log('❌ Face mismatch,retrying');
          ws.send('❌ Face mismatch,retrying');
          if(attemptNo>=50)
          {
            const authToken = generateAuthToken(userId,action);
            ws.send(JSON.stringify({
            status: "failure mismatch",
            message: "❌ Face mismatch",
            actionToken: authToken
            }));
            console.log('❌ Face mismatch, max count');
            ws.close(4002);
          }
          onCloseCallback(userId, 'fail on mismatch');
        }
      } 
      else 
      {
        console.log('❌ No face detected,retrying');
        ws.send('❌ No face detected,retrying');
        if(attemptNo >= 50)
        {
          const authToken = generateAuthToken(userId,action);
          console.log('❌ No face detected, closing');
          ws.send(JSON.stringify({
          status: "failure no face",
          message: "❌ No face detected",
          actionToken: authToken
         }));
          ws.close(4002);
          onCloseCallback(userId, 'fail on no face');
        }
      }
    } 
    catch (err) 
    {
      console.error('❗ Error:', err);
      ws.send('❌ Error processing image');
      ws.close(1011);
      onCloseCallback(userId, 'fail');
    }
  });

  ws.on('close', () => 
  {
    console.log(`🔒 Disconnected: ${userId}`);
  });
}

module.exports = { loadModels, handleFaceAuth };
