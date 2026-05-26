// 取得 DOM 元素
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusText = document.getElementById('status');
const emotionEmoji = document.getElementById('emotion-emoji');
const emotionText = document.getElementById('emotion-text');

// 基於 MediaPipe 特徵點進行表情與情緒偵測
function detectEmotion(landmarks) {
    // 輔助函式：計算兩點之間的歐幾里得距離
    const getDistance = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    
    // 臉部基礎尺寸：作為特徵點位移的比例基準
    const faceWidth = getDistance(landmarks[234], landmarks[454]); // 左臉頰到右臉頰
    const faceHeight = getDistance(landmarks[10], landmarks[152]); // 額頭到下巴
    
    // 1. 嘴巴開合程度 (上唇 13, 下唇 14)
    const mouthOpen = getDistance(landmarks[13], landmarks[14]);
    const mouthOpenRatio = mouthOpen / faceHeight;
    
    // 2. 嘴巴寬度 (左嘴角 61, 右嘴角 291)
    const mouthWidth = getDistance(landmarks[61], landmarks[291]);
    const mouthWidthRatio = mouthWidth / faceWidth;
    
    // 3. 眉毛高度 (左眼 159 和左眉 52)
    const eyebrowDistance = getDistance(landmarks[159], landmarks[52]);
    const eyebrowRatio = eyebrowDistance / faceHeight;

    // 4. 判斷嘴角是否上揚 (計算嘴角與下唇底部的 Y 軸相對位置)
    const leftCornerY = landmarks[61].y;
    const rightCornerY = landmarks[291].y;
    const bottomLipY = landmarks[14].y;
    // 當嘴角大幅高於下唇時，代表正在微笑
    const smileThreshold = (bottomLipY - (leftCornerY + rightCornerY) / 2) / faceHeight;

    let emotion = "平靜 (Neutral)";
    let emoji = "😐";

    // 簡單的規則式情緒判斷
    if (mouthOpenRatio > 0.07 && eyebrowRatio > 0.09) {
        // 嘴巴張開且眉毛抬高 -> 驚訝
        emotion = "驚訝 (Surprised)";
        emoji = "😲";
    } else if (smileThreshold > 0.035 && mouthWidthRatio > 0.35) {
        // 嘴角上揚且嘴巴拉寬 -> 開心
        emotion = "開心 (Happy)";
        emoji = "😊";
    } else if (smileThreshold < 0.015 && mouthWidthRatio < 0.3) {
        // 嘴角低垂且嘴巴縮窄 -> 難過
        emotion = "難過 (Sad)";
        emoji = "😢";
    }

    return { emotion, emoji };
}

// 處理 Face Mesh 偵測結果
function onResults(results) {
    // 更新狀態文字
    if (statusText.classList.contains('loading')) {
        statusText.textContent = '模型載入完成，偵測中...';
        statusText.className = 'success';
    }

    // 調整 canvas 大小與 video 相同
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        for (const landmarks of results.multiFaceLandmarks) {
            // 繪製臉部網格與重點部位
            drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {color: '#C0C0C070', lineWidth: 1});
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {color: '#FF3030', lineWidth: 1});
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, {color: '#FF3030', lineWidth: 1});
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {color: '#30FF30', lineWidth: 1});
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, {color: '#30FF30', lineWidth: 1});
            drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {color: '#E0E0E0', lineWidth: 1});
            drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, {color: '#E0E0E0', lineWidth: 1});

            // 進行情緒判斷 (這裡以偵測到的第一張臉為主要輸出)
            const { emotion, emoji } = detectEmotion(landmarks);
            emotionEmoji.innerText = emoji;
            emotionText.innerText = emotion;
        }
    } else {
        // 沒有偵測到臉時的狀態
        emotionEmoji.innerText = "🔍";
        emotionText.innerText = "未偵測到臉部";
    }
    
    canvasCtx.restore();
}

// 初始化 MediaPipe Face Mesh
const faceMesh = new FaceMesh({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
}});

faceMesh.setOptions({
    maxNumFaces: 1, // 可調整偵測的人臉數量
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

// 啟動攝影機
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({image: videoElement});
    },
    width: 640,
    height: 480
});

camera.start().catch(err => {
    statusText.textContent = '無法存取攝影機，請確認權限';
    statusText.className = 'error';
    console.error('攝影機啟動失敗:', err);
});
