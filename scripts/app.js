// scripts/app.js にこの内容を貼り付けてください

// DOM要素の取得
const startWorkBtn = document.getElementById('start-work-btn');
const endWorkBtn = document.getElementById('end-work-btn');
const startBreakBtn = document.getElementById('start-break-btn');
const endBreakBtn = document.getElementById('end-break-btn');
const reportInput = document.getElementById('report-input');
const saveReportBtn = document.getElementById('save-report-btn');
const currentStatus = document.getElementById('current-status');
const todayLog = document.getElementById('today-log');
const totalWorkTimeSpan = document.getElementById('total-work-time');

let todayDocId = null;
let todayDocData = null;
let workTimer = null;

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
    todayDocId = getTodayDateString();
    db.collection('worklogs').doc(todayDocId)
      .onSnapshot(doc => {
        if (doc.exists) {
            todayDocData = doc.data();
        } else {
            todayDocData = null;
        }
        updateUI();
        updateTodayLog();
      }, err => {
          console.error("データの読み込みに失敗:", err);
          currentStatus.innerText = 'データ読込エラー';
      });
}

// UI（ボタンの状態など）を更新する
function updateUI() {
    if (!todayDocData || !todayDocData.status) {
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
    db.collection('worklogs').doc(todayDocId).set(data).catch(e => console.error("出勤エラー:", e));
});

endWorkBtn.addEventListener('click', () => {
    const now = new Date();
    db.collection('worklogs').doc(todayDocId).update({ endTime: now, status: '退勤済み' }).catch(e => console.error("退勤エラー:", e));
});

startBreakBtn.addEventListener('click', () => {
    const now = new Date();
    const newBreak = { start: now, end: null };
    db.collection('worklogs').doc(todayDocId).update({
        status: '休憩中',
        breaks: firebase.firestore.FieldValue.arrayUnion(newBreak)
    }).catch(e => console.error("休憩開始エラー:", e));
});

endBreakBtn.addEventListener('click', () => {
    const now = new Date();
    const latestBreaks = todayDocData.breaks || [];
    if (latestBreaks.length > 0 && latestBreaks[latestBreaks.length - 1].end === null) {
        latestBreaks[latestBreaks.length - 1].end = now;
        db.collection('worklogs').doc(todayDocId).update({ status: '勤務中', breaks: latestBreaks }).catch(e => console.error("休憩終了エラー:", e));
    }
});

saveReportBtn.addEventListener('click', () => {
    if (!todayDocId || !todayDocData) {
        alert('先に出勤打刻をしてください。');
        return;
    }
    const reportText = reportInput.value;
    db.collection('worklogs').doc(todayDocId).update({ report: reportText })
      .then(() => alert('日報を保存しました。'))
      .catch(e => console.error("日報保存エラー:", e));
});

// --- 表示関連の関数 ---
function formatTime(date) {
    if (!date || !date.seconds) return '';
    return new Date(date.seconds * 1000).toLocaleTimeString('ja-JP');
}

function updateTodayLog() {
    if (!todayDocData) {
        todayLog.textContent = '本日の記録はまだありません。';
        return;
    }
    let logHtml = `出勤: ${formatTime(todayDocData.startTime)}\n`;
    if (todayDocData.breaks && todayDocData.breaks.length > 0) {
        todayDocData.breaks.forEach((b, index) => {
            logHtml += `休憩${index + 1}: ${formatTime(b.start)} - ${formatTime(b.end)}\n`;
        });
    }
    if (todayDocData.endTime) {
        logHtml += `退勤: ${formatTime(todayDocData.endTime)}\n`;
    }
    todayLog.textContent = logHtml;
}

function calculateTotalWorkTime() {
    if (!todayDocData || !todayDocData.startTime) return 0;

    const end = (todayDocData.endTime) ? todayDocData.endTime.toMillis() : new Date().getTime();
    let totalWorkMillis = end - todayDocData.startTime.toMillis();
    
    let totalBreakMillis = 0;
    if (todayDocData.breaks) {
        todayDocData.breaks.forEach(b => {
            const breakStart = b.start ? b.start.toMillis() : 0;
            const breakEnd = b.end ? b.end.toMillis() : new Date().getTime();
            if (b.start && b.end) {
                totalBreakMillis += (breakEnd - breakStart);
            } else if (b.start && !b.end) { // 休憩中の場合
                totalBreakMillis += (breakEnd - breakStart);
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
    const totalMillis = calculateTotalWorkTime();
    const hours = Math.floor(totalMillis / 3600000);
    const minutes = Math.floor((totalMillis % 3600000) / 60000);
    const seconds = Math.floor((totalMillis % 60000) / 1000);
    totalWorkTimeSpan.innerText = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ページの読み込みが完了したらデータをロード
document.addEventListener('DOMContentLoaded', loadTodayData);