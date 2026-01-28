import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Buraya kendi Firebase bilgilerini yapıştırman lazım.
// Şimdilik site açılsın diye boş bırakıyorum ama oyunun kaydetmesi için burayı doldurmalısın.
const firebaseConfig = {
  apiKey: "SENIN_API_KEYIN",
  authDomain: "SENIN_PROJEN.firebaseapp.com",
  databaseURL: "https://SENIN_PROJEN.firebaseio.com",
  projectId: "SENIN_PROJE_ID",
  storageBucket: "SENIN_PROJEN.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);