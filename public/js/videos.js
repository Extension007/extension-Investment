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
});
