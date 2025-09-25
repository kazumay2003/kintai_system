document.addEventListener('DOMContentLoaded', () => {
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    const fetchDataBtn = document.getElementById('fetch-data-btn');
    const tableBody = document.querySelector('#summary-table tbody');
    const summaryTotal = document.getElementById('summary-total');
    const addNewBtn = document.getElementById('add-new-btn'); // <<< 新しいボタンを取得
    const csvExportBtn = document.getElementById('csv-export-btn'); // CSVエクスポートボタンを取得

    // 年月のプルダウンを初期化
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    for (let y = currentYear - 3; y <= currentYear + 1; y++) {
        const option = new Option(y, y);
        if (y === currentYear) option.selected = true;
        yearSelect.add(option);
    }
    for (let m = 1; m <= 12; m++) {
        const option = new Option(m, m);
        if (m === currentMonth) option.selected = true;
        monthSelect.add(option);
    }

    fetchDataBtn.addEventListener('click', fetchAndDisplayData);

    // CSVエクスポートボタンのイベントリスナーを追加
    csvExportBtn.addEventListener('click', exportToCSV);

    // ▼▼▼ 新しいボタンのイベントリスナーを追加 ▼▼▼
    addNewBtn.addEventListener('click', () => {
        const year = yearSelect.value;
        const month = monthSelect.value;
        
        // 日付の入力を求める
        const day = prompt(`${year}年${month}月の日付を入力してください。(1-31)`);

        if (day && !isNaN(day) && day >= 1 && day <= 31) {
            // 正しい日付なら、そのIDで編集ページに飛ぶ
            const dateId = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            window.location.href = `/edit.html?id=${dateId}`;
        } else if (day) {
            // 入力があったが、不正な値だった場合
            alert('無効な日付です。1から31の数字を入力してください。');
        }
        // dayがnull（キャンセルされた）場合は何もしない
    });

    // ミリ秒を HH:MM:SS 形式に変換
    function formatMillis(millis) {
        if (isNaN(millis) || millis < 0) return "00:00:00";
        const totalSeconds = Math.floor(millis / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    // 時刻を HH:MM 形式に変換
    function formatTime(date) {
        if (!date || !date.seconds) return "-";
        return new Date(date.seconds * 1000).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }

    async function fetchAndDisplayData() {
        const year = yearSelect.value;
        const month = monthSelect.value.padStart(2, '0');
        
        tableBody.innerHTML = '<tr><td colspan="6">読み込み中...</td></tr>';
        summaryTotal.innerHTML = '';

        try {
            const startDate = `${year}-${month}-01`;
            const endDate = `${year}-${month}-${new Date(year, month, 0).getDate()}`;

            const snapshot = await db.collection('worklogs')
                .where(firebase.firestore.FieldPath.documentId(), '>=', startDate)
                .where(firebase.firestore.FieldPath.documentId(), '<=', endDate)
                .orderBy(firebase.firestore.FieldPath.documentId())
                .get();

            if (snapshot.empty) {
                tableBody.innerHTML = '<tr><td colspan="6">この月のデータはありません。</td></tr>';
                summaryTotal.innerHTML = '';
                return;
            }

            let monthTotalWorkMillis = 0;
            tableBody.innerHTML = '';

            snapshot.forEach(doc => {
                const data = doc.data();
                const date = doc.id;

                let totalBreakMillis = 0;
                if (data.breaks) {
                    data.breaks.forEach(b => {
                        if (b.start && b.end) {
                            totalBreakMillis += (b.end.toMillis() - b.start.toMillis());
                        }
                    });
                }

                let totalWorkMillis = 0;
                if (data.startTime && data.endTime) {
                    totalWorkMillis = (data.endTime.toMillis() - data.startTime.toMillis()) - totalBreakMillis;
                    monthTotalWorkMillis += totalWorkMillis;
                }

                const tr = document.createElement('tr');
                const reportSnippet = (data.report || '').substring(0, 15);
                tr.innerHTML = `
                    <td>${date}</td>
                    <td>${formatTime(data.startTime)} - ${formatTime(data.endTime)}</td>
                    <td>${formatMillis(totalBreakMillis)}</td>
                    <td>${formatMillis(totalWorkMillis)}</td>
                    <td title="${data.report || ''}">${reportSnippet}${data.report && data.report.length > 15 ? '...' : ''}</td>
                    <td><a href="/edit.html?id=${date}">編集</a></td>
                `;
                tableBody.appendChild(tr);
            });
            
            summaryTotal.innerHTML = `<h3>${year}年${month}月の合計労働時間: ${formatMillis(monthTotalWorkMillis)}</h3>`;

        } catch (error) {
            console.error("データの取得に失敗しました:", error);
            tableBody.innerHTML = '<tr><td colspan="6">データの取得に失敗しました。</td></tr>';
        }
    }

    // CSV エクスポート機能
    async function exportToCSV() {
        const year = yearSelect.value;
        const month = monthSelect.value.padStart(2, '0');
        
        try {
            const startDate = `${year}-${month}-01`;
            const endDate = `${year}-${month}-${new Date(year, month, 0).getDate()}`;

            const snapshot = await db.collection('worklogs')
                .where(firebase.firestore.FieldPath.documentId(), '>=', startDate)
                .where(firebase.firestore.FieldPath.documentId(), '<=', endDate)
                .orderBy(firebase.firestore.FieldPath.documentId())
                .get();

            if (snapshot.empty) {
                alert('この月のデータはありません。');
                return;
            }

            // CSVヘッダー（A列：日、B列：開始時間、C列：終了時間、J列：合計休憩時間）
            let csvContent = 'A,B,C,D,E,F,G,H,I,J\n'; // J列まで準備

            snapshot.forEach(doc => {
                const data = doc.data();
                const date = doc.id;
                
                // A列：日付から日のみを半角で抽出
                const dayOnly = date.split('-')[2]; // YYYY-MM-DD から DD を取得
                
                // B列：開始時間をhh:mm形式で
                const startTime = data.startTime ? 
                    new Date(data.startTime.seconds * 1000).toLocaleTimeString('ja-JP', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                    }) : '';
                
                // C列：終了時間をhh:mm形式で
                const endTime = data.endTime ? 
                    new Date(data.endTime.seconds * 1000).toLocaleTimeString('ja-JP', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                    }) : '';
                
                // J列：合計休憩時間を小数で（時間単位）
                let totalBreakHours = 0;
                if (data.breaks) {
                    let totalBreakMillis = 0;
                    data.breaks.forEach(b => {
                        if (b.start && b.end) {
                            totalBreakMillis += (b.end.toMillis() - b.start.toMillis());
                        }
                    });
                    totalBreakHours = totalBreakMillis / (1000 * 60 * 60); // ミリ秒を時間に変換
                }
                
                // CSV行を作成（A,B,C列とJ列のみ使用、他は空）
                const csvRow = `${dayOnly},${startTime},${endTime},,,,,,,"${totalBreakHours.toFixed(2)}"\n`;
                csvContent += csvRow;
            });

            // CSVファイルをダウンロード
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `勤怠記録_${year}年${month}月.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (error) {
            console.error("CSVエクスポートに失敗しました:", error);
            alert('CSVエクスポートに失敗しました。');
        }
    }

    fetchAndDisplayData(); // 初期表示
});