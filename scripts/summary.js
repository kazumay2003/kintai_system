document.addEventListener('DOMContentLoaded', () => {
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    const fetchDataBtn = document.getElementById('fetch-data-btn');
    const tableBody = document.querySelector('#summary-table tbody');
    const summaryTotal = document.getElementById('summary-total');

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

        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${new Date(year, month, 0).getDate()}`;

        try {
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

    fetchAndDisplayData(); // 初期表示
});