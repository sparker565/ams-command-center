import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyBD-RK7vDtp2HDubOjoBf5GTZ7pYz5Zh8U",
  authDomain: "ams-command-center.firebaseapp.com",
  projectId: "ams-command-center",
  storageBucket: "ams-command-center.firebasestorage.app",
  messagingSenderId: "680568201029",
  appId: "1:680568201029:web:4584df13ee85c0b008282c"
};

export const app = initializeApp(firebaseConfig);