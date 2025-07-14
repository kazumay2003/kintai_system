// ▼▼▼ Firebaseコンソールで取得したあなたの設定情報をここに貼り付けてください ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
// ▲▲▲ Firebaseコンソールで取得したあなたの設定情報をここに貼り付けてください ▲▲▲

// Firebaseの初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// DOM要素の取得
const authLoading = document.getElementById('auth-loading');
const appContainer = document.getElementById('app-container');
const startWorkBtn = document.getElementById('start-work-btn');
const endWorkBtn = document.getElementById('end-work-btn');
const startBreakBtn = document.getElementById('start-break-btn');
const endBreakBtn = document.getElementById('end-break-btn');
const reportInput = document.getElementById('report-input');
const saveReportBtn = document.getElementById('save-report-btn');
const currentStatus = document.getElementById('current-status');
const todayLog = document.getElementById('today-log');
const totalWorkTimeSpan = document.getElementById('total-work-time');

let currentUser = null;
let todayDocId = null; // 今日の勤務記録のドキュメントID
let todayDocData = null; // 今日の勤務記録のデータ
let workTimer = null; // 労働時間を更新するタイマー

// 匿名認証でログイン
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        authLoading.style.display = 'none';
        appContainer.style.display = 'block';
        loadTodayData();
    } else {
        auth.signInAnonymously().catch(error => {
            console.error("匿名認証に失敗:", error);
            authLoading.innerText = '認証に失敗しました。ページをリロードしてください。';
        });
    }
});

// 今日の日付 (YYYY-MM-DD) を取得
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 今日の勤務データを読み込む
function loadTodayData() {
    if (!currentUser) return;
    todayDocId = getTodayDateString();

    // リアルタイムでデータを監視
    db.collection('users').doc(currentUser.uid).collection('worklogs').doc(todayDocId)
      .onSnapshot(doc => {
        if (doc.exists) {
            todayDocData = doc.data();
            updateUI();
            updateTodayLog();
        } else {
            todayDocData = null; // データがない場合
            updateUI();
            todayLog.innerHTML = '本日の記録はまだありません。';
        }
      });
}

// UI（ボタンの状態など）を更新する
function updateUI() {
    if (!todayDocData || !todayDocData.status) { // 未出勤
        currentStatus.innerText = '未出勤';
        startWorkBtn.disabled = false;
        endWorkBtn.disabled = true;
        startBreakBtn.disabled = true;
        endBreakBtn.disabled = true;
        stopWorkTimer();
        return;
    }

    currentStatus.innerText = todayDocData.status;

    switch (todayDocData.status) {
        case '勤務中':
            startWorkBtn.disabled = true;
            endWorkBtn.disabled = false;
            startBreakBtn.disabled = false;
            endBreakBtn.disabled = true;
            startWorkTimer();
            break;
        case '休憩中':
            startWorkBtn.disabled = true;
            endWorkBtn.disabled = true;
            startBreakBtn.disabled = true;
            endBreakBtn.disabled = false;
            stopWorkTimer();
            break;
        case '退勤済み':
            startWorkBtn.disabled = true;
            endWorkBtn.disabled = true;
            startBreakBtn.disabled = true;
            endBreakBtn.disabled = true;
            stopWorkTimer();
            break;
    }
    reportInput.value = todayDocData.report || '';
}

// --- ボタンのイベントリスナー ---
startWorkBtn.addEventListener('click', () => {
    const now = new Date();
    const data = {
        startTime: now,
        status: '勤務中',
        breaks: [],
        report: ''
    };
    db.collection('users').doc(currentUser.uid).collection('worklogs').doc(todayDocId)
      .set(data)
      .catch(e => console.error("出勤エラー:", e));
});

endWorkBtn.addEventListener('click', () => {
    const now = new Date();
    db.collection('users').doc(currentUser.uid).collection('worklogs').doc(todayDocId)
      .update({ endTime: now, status: '退勤済み' })
      .catch(e => console.error("退勤エラー:", e));
});

startBreakBtn.addEventListener('click', () => {
    const now = new Date();
    db.collection('users').doc(currentUser.uid).collection('worklogs').doc(todayDocId)
      .update({
          status: '休憩中',
          breaks: firebase.firestore.FieldValue.arrayUnion({ start: now, end: null })
      })
      .catch(e => console.error("休憩開始エラー:", e));
});

endBreakBtn.addEventListener('click', () => {
    const now = new Date();
    const latestBreaks = todayDocData.breaks || [];
    // 最後の休憩に終了時間を設定
    if (latestBreaks.length > 0) {
        latestBreaks[latestBreaks.length - 1].end = now;
    }
    db.collection('users').doc(currentUser.uid).collection('worklogs').doc(todayDocId)
      .update({ status: '勤務中', breaks: latestBreaks })
      .catch(e => console.error("休憩終了エラー:", e));
});

saveReportBtn.addEventListener('click', () => {
    if (!todayDocId || !todayDocData) {
        alert('先に出勤打刻をしてください。');
        return;
    }
    const reportText = reportInput.value;
    db.collection('users').doc(currentUser.uid).collection('worklogs').doc(todayDocId)
      .update({ report: reportText })
      .then(() => alert('日報を保存しました。'))
      .catch(e => console.error("日報保存エラー:", e));
});


// --- 表示関連の関数 ---

// 時刻を HH:MM:SS 形式にフォーマット
function formatTime(date) {
    if (!date) return '';
    return new Date(date.seconds * 1000).toLocaleTimeString('ja-JP');
}

// 今日の記録を整形して表示
function updateTodayLog() {
    if (!todayDocData) return;
    let logHtml = `<pre>出勤: ${formatTime(todayDocData.startTime)}\n`;
    if (todayDocData.breaks && todayDocData.breaks.length > 0) {
        todayDocData.breaks.forEach((b, index) => {
            logHtml += `休憩${index + 1}: ${formatTime(b.start)} - ${formatTime(b.end)}\n`;
        });
    }
    if (todayDocData.endTime) {
        logHtml += `退勤: ${formatTime(todayDocData.endTime)}\n`;
    }
    logHtml += `</pre>`;
    todayLog.innerHTML = logHtml;
}

// 労働時間を計算して表示
function calculateTotalWorkTime() {
    if (!todayDocData || !todayDocData.startTime) return 0;

    // 退勤時刻 or 現在時刻
    const end = todayDocData.endTime ? todayDocData.endTime.toMillis() : new Date().getTime();
    let totalWorkMillis = end - todayDocData.startTime.toMillis();
    
    let totalBreakMillis = 0;
    if (todayDocData.breaks) {
        todayDocData.breaks.forEach(b => {
            if (b.start && b.end) {
                totalBreakMillis += (b.end.toMillis() - b.start.toMillis());
            } else if (b.start && !b.end) { // 休憩中の場合
                totalBreakMillis += (new Date().getTime() - b.start.toMillis());
            }
        });
    }

    const netWorkMillis = totalWorkMillis - totalBreakMillis;
    return Math.max(0, netWorkMillis);
}

function startWorkTimer() {
    if (workTimer) clearInterval(workTimer);
    workTimer = setInterval(() => {
        const totalMillis = calculateTotalWorkTime();
        const hours = Math.floor(totalMillis / 3600000);
        const minutes = Math.floor((totalMillis % 3600000) / 60000);
        const seconds = Math.floor((totalMillis % 60000) / 1000);
        totalWorkTimeSpan.innerText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

function stopWorkTimer() {
    if (workTimer) clearInterval(workTimer);
    // 停止時にも一度計算して表示を正確にする
    const totalMillis = calculateTotalWorkTime();
    const hours = Math.floor(totalMillis / 3600000);
    const minutes = Math.floor((totalMillis % 3600000) / 60000);
    const seconds = Math.floor((totalMillis % 60000) / 1000);
    totalWorkTimeSpan.innerText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
