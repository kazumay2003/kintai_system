document.addEventListener('DOMContentLoaded', () => {
    // URLから編集対象のドキュメントID (日付) を取得
    const urlParams = new URLSearchParams(window.location.search);
    const docId = urlParams.get('id');

    // DOM要素の取得
    const editDateEl = document.getElementById('edit-date');
    const loadingMessage = document.getElementById('loading-message');
    const editForm = document.getElementById('edit-form');
    const startTimeInput = document.getElementById('start-time-input');
    const endTimeInput = document.getElementById('end-time-input');
    const breaksContainer = document.getElementById('breaks-container');
    const addBreakBtn = document.getElementById('add-break-btn');
    const reportInput = document.getElementById('report-input');
    const saveBtn = document.getElementById('save-btn');
    const deleteBtn = document.getElementById('delete-btn');

    if (!docId) {
        loadingMessage.textContent = 'エラー: 編集する記録のIDが指定されていません。';
        return;
    }

    editDateEl.textContent = docId;
    const docRef = db.collection('worklogs').doc(docId);

    // --- データ読み込み ---
    const loadRecord = async () => {
        try {
            const docSnap = await docRef.get();
            if (docSnap.exists()) {
                populateForm(docSnap.data());
                loadingMessage.style.display = 'none';
                editForm.style.display = 'block';
            } else {
                loadingMessage.textContent = 'エラー: データが見つかりませんでした。';
            }
        } catch (error) {
            console.error("データの読み込みに失敗しました:", error);
            loadingMessage.textContent = 'データの読み込み中にエラーが発生しました。';
        }
    };

    // --- フォームにデータを設定 ---
    const populateForm = (data) => {
        startTimeInput.value = formatTimestampForInput(data.startTime);
        endTimeInput.value = formatTimestampForInput(data.endTime);
        reportInput.value = data.report || '';
        
        breaksContainer.innerHTML = ''; // 既存の休憩欄をクリア
        if (data.breaks && data.breaks.length > 0) {
            data.breaks.forEach(b => addBreakRow(b));
        }
    };

    // FirestoreのTimestampをdatetime-local入力欄の形式に変換するヘルパー関数
    function formatTimestampForInput(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        // タイムゾーンのオフセットを考慮してローカル時刻に補正
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, 16);
        return localISOTime;
    }

    // --- 休憩入力欄の動的追加 ---
    const addBreakRow = (breakData = {}) => {
        const breakRow = document.createElement('div');
        breakRow.className = 'break-row';
        breakRow.innerHTML = `
            <input type="datetime-local" class="break-start">
            <span>～</span>
            <input type="datetime-local" class="break-end">
            <button type="button" class="remove-break-btn">×</button>
        `;
        breakRow.querySelector('.break-start').value = formatTimestampForInput(breakData.start);
        breakRow.querySelector('.break-end').value = formatTimestampForInput(breakData.end);
        
        breakRow.querySelector('.remove-break-btn').addEventListener('click', () => {
            breakRow.remove();
        });
        
        breaksContainer.appendChild(breakRow);
    };

    addBreakBtn.addEventListener('click', () => addBreakRow());

    // --- 保存処理 ---
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';

        try {
            const dataToSave = {
                startTime: startTimeInput.value ? firebase.firestore.Timestamp.fromDate(new Date(startTimeInput.value)) : null,
                endTime: endTimeInput.value ? firebase.firestore.Timestamp.fromDate(new Date(endTimeInput.value)) : null,
                report: reportInput.value,
                breaks: []
            };

            const breakRows = breaksContainer.querySelectorAll('.break-row');
            breakRows.forEach(row => {
                const start = row.querySelector('.break-start').value;
                const end = row.querySelector('.break-end').value;
                if (start && end) {
                    dataToSave.breaks.push({
                        start: firebase.firestore.Timestamp.fromDate(new Date(start)),
                        end: firebase.firestore.Timestamp.fromDate(new Date(end))
                    });
                }
            });

            await docRef.set(dataToSave, { merge: true }); // updateの代わりにset+mergeを使用
            alert('保存しました。');
            window.location.href = '/summary.html';

        } catch (error) {
            console.error("保存に失敗しました:", error);
            alert('保存中にエラーが発生しました。');
            saveBtn.disabled = false;
            saveBtn.textContent = '保存する';
        }
    });

    // --- 削除処理 ---
    deleteBtn.addEventListener('click', async () => {
        if (confirm('本当にこの日の記録を削除しますか？この操作は元に戻せません。')) {
            try {
                await docRef.delete();
                alert('記録を削除しました。');
                window.location.href = '/summary.html';
            } catch (error) {
                console.error("削除に失敗しました:", error);
                alert('削除中にエラーが発生しました。');
            }
        }
    });

    // 初期データを読み込む
    loadRecord();
});```
