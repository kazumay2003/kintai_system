// ▼▼▼ Firebaseコンソールで取得したあなたの設定情報をここに貼り付けてください ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyAIWEakyGQQLOLKI1WGD63yx8ptICMjAmY",
  authDomain: "kintai-67481.firebaseapp.com",
  projectId: "kintai-67481",
  storageBucket: "kintai-67481.firebasestorage.app",
  messagingSenderId: "780797228158",
  appId: "1:780797228158:web:9336fee4c932903afb142f",
  measurementId: "G-SC2X485SR1"
};
// ▲▲▲ Firebaseコンソールで取得したあなたの設定情報をここに貼り付けてください ▲▲▲

// Firebaseの初期化とエクスポート
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
