const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusDiv = document.getElementById('status');
const container = document.getElementById('container');

// 設定 MediaPipe Face Mesh 模型
const faceMesh = new FaceMesh({locateFile: (file) => {
    // 確保正確載入 .wasm 等二進位檔案
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
}});

faceMesh.setOptions({
    maxNumFaces: 1, // 為了效能，預設偵測 1 張臉，可依需求調整
    refineLandmarks: true, // 啟用瞳孔與嘴唇的更精細特徵點 (478 點)
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// 當模型成功處理完每一幀影像時觸發的回呼函式
faceMesh.onResults(onResults);

// 為了確保模型已載入，我們先手動初始化
async function initModel() {
    try {
        statusDiv.innerText = '正在下載 MediaPipe 模型... (初次載入需數秒)';
        await faceMesh.initialize();
        statusDiv.innerText = '模型載入完成，正在啟動攝影機...';
        startCamera();
    } catch (err) {
        console.error("載入模型失敗:", err);
        statusDiv.innerText = '載入模型失敗，請檢查網路連線或使用其他網路。';
        statusDiv.className = 'error';
    }
}

function onResults(results) {
    // 當收到第一筆資料時，更新狀態文字
    if (statusDiv.className === 'loading') {
        statusDiv.innerText = '系統運作中，成功捕捉臉部。';
        statusDiv.className = 'success';
    }

    // 將畫布大小調整為與影片真實尺寸一致
    if (canvasElement.width !== videoElement.videoWidth) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        container.style.aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
    }

    canvasCtx.save();
    // 清除上一幀的畫布
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 如果有偵測到臉部特徵點
    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
            
            // 繪製臉部網格 (Face Mesh) 連線
            drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, 
                {color: '#C0C0C070', lineWidth: 1}); // 銀灰色半透明網格
            
            // 繪製右眼
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {color: '#FF3030'});
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, {color: '#FF3030'});
            drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, {color: '#FF3030'});
            
            // 繪製左眼
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {color: '#30FF30'});
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, {color: '#30FF30'});
            drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, {color: '#30FF30'});
            
            // 繪製臉部輪廓
            drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {color: '#E0E0E0'});
            
            // 繪製嘴唇
            drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, {color: '#E0E0E0'});

            // 若不需要全部連線，也可以用 drawLandmarks 畫出每一顆點：
            // drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 1});
        }
    }
    canvasCtx.restore();
}

function startCamera() {
    // 初始化攝影機，並將影像串流餵給 MediaPipe
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({image: videoElement});
        },
        // 手機優化：寬高設定，並要求前置鏡頭 (MediaPipe Camera Utils 預設會處理)
        width: 640,
        height: 480,
        facingMode: 'user'
    });

    // 啟動相機
    camera.start().catch(err => {
        console.error("無法取得攝影機權限:", err);
        statusDiv.innerText = '無法啟動攝影機，請確認瀏覽器已給予權限。';
        statusDiv.className = 'error';
    });
}

// 啟動應用程式
initModel();