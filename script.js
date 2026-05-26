const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusDiv = document.getElementById('status');
const container = document.getElementById('container');

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
        // 【手機優化】改用 faceLandmark68TinyNet (Tiny 特徵點模型)，大幅降低運算負擔與載入時間
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
        ]);
        
        statusDiv.innerText = '模型載入完成，正在啟動攝影機...';
        statusDiv.className = 'success';
        startVideo();
    } catch (err) {
        console.error("載入模型失敗:", err);
        statusDiv.innerText = '載入模型失敗，請檢查網路連線。';
        statusDiv.className = 'error';
    }
}

function startVideo() {
    // 【手機優化】強制要求使用前置鏡頭 (facingMode: 'user')
    navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
    })
    .then(stream => {
        video.srcObject = stream;
        statusDiv.innerText = '系統運作中，請將臉部對準鏡頭。';
    })
    .catch(err => {
        console.error("無法取得攝影機權限:", err);
        statusDiv.innerText = '無法啟動攝影機，請確認瀏覽器已給予權限。';
        statusDiv.className = 'error';
    });
}

// 當取得影片真實尺寸後，設定容器的長寬比，確保手機螢幕上不變形
video.addEventListener('loadedmetadata', () => {
    const ratio = video.videoWidth / video.videoHeight;
    container.style.aspectRatio = ratio;
});

video.addEventListener('play', () => {
    const ctx = canvas.getContext('2d');
    
    // 【手機優化】將畫布實際解析度設定為影片的真實解析度
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        if (video.paused || video.ended) return;

        // 【修復】withFaceLandmarks(true) 中的 true 代表強制使用 Tiny 模型，否則它會找不到預設的笨重模型而失敗
        const detections = await faceapi.detectAllFaces(
            video, 
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })
        ).withFaceLandmarks(true).withFaceExpressions();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 繪製臉部全部 68 個特徵點
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
            
            // 繪製情緒標籤背景 (加上些微透明度更具質感)
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(box.x, box.y - 32, 120, 32);
            ctx.globalAlpha = 1.0;

            // 繪製情緒標籤文字
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(`${zhLabel} (${score}%)`, box.x + 5, box.y - 10);
        });
    }, 100);
});

// 啟動應用程式
init();