// timer.js
let timeLeft = 60; // 1분
const timerDisplay = document.createElement('div');

// 기본 스타일 설정
timerDisplay.style.position = 'absolute';
timerDisplay.style.top = '20px';
timerDisplay.style.right = '20px';
timerDisplay.style.fontSize = '30px';
timerDisplay.style.fontFamily = 'monospace';
timerDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
timerDisplay.style.color = 'white';
timerDisplay.style.padding = '10px 20px';
timerDisplay.style.borderRadius = '8px';
timerDisplay.style.zIndex = '1000';

document.body.appendChild(timerDisplay);

function updateTimer() {
	timerDisplay.textContent = `⏱️ ${timeLeft}초`;

	if (timeLeft <= 0) {
		clearInterval(timerInterval);
		endGamePopup();
		return;
	}

	timeLeft--;
}

const timerInterval = setInterval(updateTimer, 1000);
updateTimer();

// 팝업 표시 함수
function endGamePopup() {
	// 오토바이 조작 중지
	window.isGameOver = true;

	const popup = document.createElement('div');
	popup.style.position = 'fixed';
	popup.style.top = '50%';
	popup.style.left = '50%';
	popup.style.transform = 'translate(-50%, -50%)';
	popup.style.backgroundColor = 'white';
	popup.style.border = '2px solid black';
	popup.style.borderRadius = '10px';
	popup.style.padding = '30px';
	popup.style.zIndex = '9999';
	popup.style.textAlign = 'center';
	popup.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';

	const message = document.createElement('h2');
	message.textContent = `⏰ 시간 종료!\n총 배달: ${window.score || 0}건`;
	message.style.marginBottom = '20px';

	const retryButton = document.createElement('button');
	retryButton.textContent = '다시하기';
	retryButton.style.padding = '10px 20px';
	retryButton.style.fontSize = '16px';
	retryButton.style.cursor = 'pointer';
	retryButton.style.border = 'none';
	retryButton.style.backgroundColor = '#3498db';
	retryButton.style.color = 'white';
	retryButton.style.borderRadius = '5px';

	retryButton.onclick = () => {
		location.reload(); // 페이지 새로고침으로 초기화
	};

	popup.appendChild(message);
	popup.appendChild(retryButton);
	document.body.appendChild(popup);
}
