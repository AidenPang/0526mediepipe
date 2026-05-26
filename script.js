const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusDiv = document.getElementById('status');

// 使用開源的 face-api.js 模型 CDN
const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';

// 情緒的中文對照表
const expressionMap = {
    neutral: '平靜',
    happy: '開心',
    sad: '悲傷',
    angry: '生氣',
    fearful: '害怕',
    disgusted: '厭惡',
    surprised: '驚訝'
};

// 顏色對照表，讓不同情緒有不同顏色的框
const colorMap = {
    neutral: '#A0A0A0',
    happy: '#FFD700',
    sad: '#1E90FF',
    angry: '#FF4500',
    fearful: '#8A2BE2',
    disgusted: '#32CD32',
    surprised: '#FF69B4'
};

async function init() {
    try {
        // 載入輕量級臉部偵測模型、表情偵測模型與特徵點偵測模型
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        
        statusDiv.innerText = '模型載入完成，正在啟動攝影機...';
        statusDiv.style.color = '#4caf50';
        startVideo();
    } catch (err) {
        console.error("載入模型失敗:", err);
        statusDiv.innerText = '載入模型失敗，請檢查網路連線或 F12 控制台。';
        statusDiv.style.color = '#f44336';
    }
}

function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            statusDiv.innerText = '系統運作中，請將臉部對準鏡頭。';
        })
        .catch(err => {
            console.error("無法取得攝影機權限:", err);
            statusDiv.innerText = '無法啟動攝影機，請確認瀏覽器已給予攝影機權限。';
            statusDiv.style.color = '#f44336';
        });
}

// 當影像開始播放時，觸發即時偵測
video.addEventListener('play', () => {
    const ctx = canvas.getContext('2d');
    const displaySize = { width: video.width, height: video.height };
    
    // 將 canvas 大小與 video 對齊
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        // 偵測所有臉部，並附帶特徵點與表情資訊
        const detections = await faceapi.detectAllFaces(
            video, 
            new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceExpressions();

        // 調整偵測框的尺寸以符合畫布
        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        // 清空上一影格的畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 繪製臉部特徵點
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

        resizedDetections.forEach(detection => {
            const box = detection.detection.box;
            const expressions = detection.expressions;
            
            // 找出機率最高的情緒
            const maxExpression = Object.keys(expressions).reduce((a, b) => 
                expressions[a] > expressions[b] ? a : b
            );
            
            const score = Math.round(expressions[maxExpression] * 100);
            const zhLabel = expressionMap[maxExpression];
            const color = colorMap[maxExpression] || '#00FF00';

            // 繪製自定義的臉部外框
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            
            // 繪製情緒標籤背景
            ctx.fillStyle = color;
            ctx.fillRect(box.x, box.y - 30, 140, 30);

            // 繪製情緒標籤文字
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(`${zhLabel} (${score}%)`, box.x + 5, box.y - 8);
        });
    }, 100); // 100 毫秒偵測一次 (約 10 FPS)
});

// 啟動應用程式
init();