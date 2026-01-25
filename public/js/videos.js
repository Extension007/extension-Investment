document.addEventListener('DOMContentLoaded', () => {
  const applyState = () => {
    const isAuth = Boolean(window.IS_AUTH);
    const isVerified = Boolean(window.IS_EMAIL_VERIFIED);
    const addBtn = document.getElementById('addVideoBtn');
    const addUnauthBtn = document.getElementById('addVideoBtnUnauth');

    if (addBtn) {
      if (isAuth && isVerified) {
        addBtn.disabled = false;
        addBtn.classList.remove('disabled');
        addBtn.title = '';
      } else {
        addBtn.disabled = true;
        addBtn.classList.add('disabled');
        addBtn.title = isAuth ? 'Подтвердите email, чтобы добавлять видео' : 'Войдите, чтобы добавлять видео';
      }
    }

    if (addUnauthBtn) {
      addUnauthBtn.style.display = isAuth ? 'none' : '';
    }

    console.log('videos.js state', {
      IS_AUTH: window.IS_AUTH,
      IS_EMAIL_VERIFIED: window.IS_EMAIL_VERIFIED,
      USER_ROLE: window.USER_ROLE
    });
  };

  applyState();

  // Re-apply after async /api/me sync completes
  setTimeout(applyState, 1200);

  // Voting handlers
  document.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const videoId = btn.dataset.videoId;
      const vote = btn.dataset.vote;
      if (!videoId || !vote) return;

      try {
        const res = await fetch(`/videos/${videoId}/vote`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'CSRF-Token': document.querySelector('meta[name=\"csrf-token\"]')?.getAttribute('content') || ''
          },
          body: JSON.stringify({ vote })
        });
        const data = await res.json();
        if (data.success && data.video) {
          const container = btn.closest('.video-rating');
          if (container) {
            const upBtn = container.querySelector('[data-vote=\"up\"]');
            const downBtn = container.querySelector('[data-vote=\"down\"]');
            if (upBtn) upBtn.textContent = `👍 ${data.video.rating_up}`;
            if (downBtn) downBtn.textContent = `👎 ${data.video.rating_down}`;
          }
        } else {
          alert(data.message || 'Ошибка голосования');
        }
      } catch (err) {
        console.error('vote error', err);
        alert('Ошибка соединения');
      }
    });
  });
});
