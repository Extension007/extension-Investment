// =======================
// Вспомогательные функции
// =======================

// =======================
// Универсальный видеоплеер
// =======================

// Определение iOS устройства
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Определение типа видео по URL
function getVideoType(url) {
  if (!url) return null;
  const urlLower = url.toLowerCase();
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('vk.com') || urlLower.includes('vkontakte.ru')) return 'vk';
  if (urlLower.includes('instagram.com')) return 'instagram';
  return null;
}

// Извлечение videoId из разных форматов ссылок YouTube (включая Shorts)
function extractVideoId(url) {
  if (!url) return null;
  
  // https://www.youtube.com/watch?v=VIDEO_ID
  // https://youtu.be/VIDEO_ID
  // https://www.youtube.com/embed/VIDEO_ID
  // https://www.youtube.com/shorts/VIDEO_ID
  // https://youtube.com/shorts/VIDEO_ID
  // https://m.youtube.com/shorts/VIDEO_ID
  // https://m.youtube.com/watch?v=VIDEO_ID
  
  // Проверяем embed формат
  if (url.includes('/embed/')) {
    return url.split('/embed/')[1].split(/[?#]/)[0];
  }
  
  // Проверяем shorts формат (YouTube Shorts)
  if (url.includes('/shorts/')) {
    return url.split('/shorts/')[1].split(/[?#]/)[0];
  }
  
  // Проверяем короткий формат youtu.be
  if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1].split(/[?#]/)[0];
  }
  
  // Проверяем стандартный формат watch?v=
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

// Извлечение параметров из URL ВКонтакте (поддержка video и clip)
function extractVKVideoParams(url) {
  if (!url) return null;
  
  // Формат: https://vk.com/video{owner_id}_{video_id}
  // Формат: https://vk.com/video?z=video{owner_id}_{video_id}
  // Формат: https://vk.com/clip{owner_id}_{clip_id}
  // Формат: https://vk.com/video_ext.php?oid=...&id=...
  
  // Проверяем формат video{owner_id}_{video_id}
  let match = url.match(/video(-?\d+)_(\d+)/);
  if (match) {
    return { ownerId: match[1], videoId: match[2], type: 'video' };
  }
  
  // Проверяем формат clip{owner_id}_{clip_id}
  match = url.match(/clip(-?\d+)_(\d+)/);
  if (match) {
    return { ownerId: match[1], videoId: match[2], type: 'clip' };
  }
  
  // Альтернативный формат: https://vk.com/video_ext.php?oid=...&id=...
  match = url.match(/[?&]oid=(-?\d+).*[?&]id=(\d+)/);
  if (match) {
    return { ownerId: match[1], videoId: match[2], type: 'video' };
  }
  
  return null;
}

// Извлечение ID публикации из URL Instagram
function extractInstagramPostId(url) {
  if (!url) return null;
  
  // Формат: https://www.instagram.com/p/{post_id}/
  // Формат: https://www.instagram.com/reel/{reel_id}/
  // Формат: https://www.instagram.com/tv/{tv_id}/
  // Формат: https://instagram.com/p/{post_id}/
  
  const match = url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (match) {
    return { postId: match[2], type: match[1] };
  }
  return null;
}

// Формирование URL для ВКонтакте embed
function buildVKEmbedUrl(params) {
  if (!params || !params.ownerId || !params.videoId) return '';
  const type = params.type || 'video';
  // Для clip используем другой формат
  if (type === 'clip') {
    return `https://vk.com/video_ext.php?oid=${params.ownerId}&id=${params.videoId}&hash=${Date.now()}&hd=1`;
  }
  return `https://vk.com/video_ext.php?oid=${params.ownerId}&id=${params.videoId}&hash=${Date.now()}&hd=1`;
}

// Получение Instagram embed через oEmbed API
async function getInstagramEmbed(url) {
  try {
    const response = await fetch(`/api/instagram/oembed?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    if (data.success && data.html) {
      return data.html;
    }
    // Fallback на прямой embed
    const postData = extractInstagramPostId(url);
    if (postData) {
      const embedUrl = `https://www.instagram.com/p/${postData.postId}/embed/`;
      return `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" scrolling="no" allowtransparency="true" allow="encrypted-media"></iframe>`;
    }
    return null;
  } catch (err) {
    console.error('Ошибка получения Instagram embed:', err);
    // Fallback на прямой embed
    const postData = extractInstagramPostId(url);
    if (postData) {
      const embedUrl = `https://www.instagram.com/p/${postData.postId}/embed/`;
      return `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" scrolling="no" allowtransparency="true" allow="encrypted-media"></iframe>`;
    }
    return null;
  }
}

// =======================
// Обработчики видео overlay, регистрация, категории, рейтинг
// =======================

document.addEventListener("DOMContentLoaded", () => {
  // FIX: Объявляем productId один раз на уровне DOMContentLoaded для избежания повторных объявлений
  let productId;
  
  // Инициализация состояния голосования для гостей (проверка cookie)
  if (!window.IS_AUTH) {
    document.querySelectorAll(".product-rating").forEach(ratingBlock => {
      // FIX: убрано повторное объявление productId - используем присвоение
      productId = ratingBlock.dataset.id;
      if (productId) {
        const voteCookie = document.cookie.split(';').some(cookie => cookie.trim().startsWith(`exto_vote_${productId}=`));
        if (voteCookie) {
          ratingBlock.dataset.voted = "true";
          ratingBlock.querySelectorAll("button").forEach((b) => {
            b.disabled = true;
          });
        }
      }
    });
  }
  // FIX: Полноэкранный overlay для YouTube видео
  const videoOverlay = document.getElementById('videoOverlay');
  const videoIframeContainer = document.getElementById('videoIframeContainer');
  let currentVideoIframe = null;
  let currentVideoUrl = null;
  let isVideoOpening = false; // Флаг для предотвращения повторных вызовов
  let youtubePlayer = null; // Глобальная переменная для YouTube IFrame API плеера
  let isPlaying = false; // Флаг для защиты от двойного вызова play()
  let isPaused = false; // Флаг для защиты от двойного вызова pause()
  
  // Проверка наличия элементов видео overlay
  if (!videoOverlay) {
    console.warn('⚠️ videoOverlay element not found in DOM');
  }
  if (!videoIframeContainer) {
    console.warn('⚠️ videoIframeContainer element not found in DOM');
  }

  // FIX: Overlay для просмотра изображений
  const imageOverlay = document.getElementById('imageOverlay');
  const imageOverlayImg = document.getElementById('imageOverlayImg');
  
  // FIX: Модальное окно для просмотра изображений
  const imageModal = document.getElementById('imageModal');
  const imageModalImage = document.getElementById('imageModalImage');
  const imageModalCurrent = document.getElementById('imageModalCurrent');
  const imageModalTotal = document.getElementById('imageModalTotal');
  const imageModalTitle = document.getElementById('imageModalTitle');
  
  let currentImageIndex = 0;
  let currentImages = [];
  let currentProductName = '';
  
  // Создание YouTube iframe с использованием YouTube IFrame API (исправление ошибки 153)
  function createYouTubeIframe(videoId) {
    if (!videoId || !videoIframeContainer) {
      console.error('❌ createYouTubeIframe: отсутствует videoId или videoIframeContainer');
      if (currentVideoUrl) {
        window.open(currentVideoUrl, '_blank');
      }
      closeVideoOverlay();
      return;
    }
    
    // Сбрасываем флаги воспроизведения
    isPlaying = false;
    isPaused = false;
    
    // Уничтожаем предыдущий плеер, если он существует
    if (youtubePlayer) {
      try {
        youtubePlayer.destroy();
        console.log('🗑️ Предыдущий YouTube плеер уничтожен');
      } catch (e) {
        console.warn('⚠️ Ошибка при уничтожении предыдущего плеера:', e);
      }
      youtubePlayer = null;
    }
    
    // Очищаем контейнер
    videoIframeContainer.innerHTML = '';
    
    // Проверяем, что overlay видим перед созданием плеера (критично для YouTube API)
    if (!videoOverlay || videoOverlay.style.display === 'none' || !videoOverlay.classList.contains('show')) {
      console.error('❌ Overlay не виден, невозможно создать YouTube плеер');
      if (currentVideoUrl) {
        window.open(currentVideoUrl, '_blank');
      }
      closeVideoOverlay();
      return;
    }
    
    // Проверяем размеры контейнера
    const containerRect = videoIframeContainer.getBoundingClientRect();
    console.log('📐 Размеры контейнера перед созданием плеера:', {
      width: containerRect.width,
      height: containerRect.height,
      visible: containerRect.width > 0 && containerRect.height > 0
    });
    
    if (containerRect.width === 0 || containerRect.height === 0) {
      console.error('❌ Контейнер имеет нулевые размеры, невозможно создать плеер');
      // FIX: Рекурсивный вызов при нулевых размерах (может потребоваться при быстром открытии)
      // Но это не должно происходить, так как overlay уже показан при клике на кнопку
      setTimeout(() => {
        createYouTubeIframe(videoId);
      }, 100);
      return;
    }
    
    try {
      // FIX: Создаём плеер строго внутри обработчика клика пользователя для устранения ошибки 153 в Chrome на iPhone
      // Gesture context передаётся корректно в WKWebView
      // enablejsapi=1 - включает JavaScript API для управления плеером
      // FIX: origin берётся из window.location.origin (без encodeURIComponent) для корректной работы postMessage
      
      console.log('🎬 Создание YouTube плеера через IFrame API внутри клика пользователя (gesture context):', videoId);
      
      youtubePlayer = new YT.Player(videoIframeContainer, {
        videoId: videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          'autoplay': 0,           // FIX: Отключить автозапуск - видео запускается только после нажатия встроенной кнопки Play
          'playsinline': 1,        // Воспроизведение встроенного видео (критично для iOS)
          'controls': 1,           // Показывать элементы управления (включая кнопку Play)
          'rel': 0,                // Не показывать похожие видео
          'enablejsapi': 1,        // Включить JavaScript API (критично для исправления ошибки 153)
          'origin': window.location.origin, // FIX: origin берётся из window.location.origin без encodeURIComponent
          'modestbranding': 1      // Уменьшить брендинг YouTube
          // FIX: Параметры соответствуют лучшим практикам для iOS: ручной запуск, встроенное воспроизведение, без автозапуска
        },
        events: {
          'onReady': function(event) {
            console.log('✅ YouTube плеер готов к воспроизведению (onReady вызван)');
            console.log('📊 Состояние плеера:', {
              videoId: event.target.getVideoData().video_id,
              duration: event.target.getDuration(),
              playerState: event.target.getPlayerState()
            });
            
            // Проверяем размеры плеера
            const iframe = videoIframeContainer.querySelector('iframe');
            if (iframe) {
              const iframeRect = iframe.getBoundingClientRect();
              console.log('📐 Размеры iframe плеера:', {
                width: iframeRect.width,
                height: iframeRect.height
              });
              
              const computedStyle = window.getComputedStyle(iframe);
              console.log('📊 Стили iframe плеера:', {
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                opacity: computedStyle.opacity
              });
              
              currentVideoIframe = iframe;
            }
            
            // FIX: Плеер готов, но НЕ запускаем автоматически - видео запускается только после нажатия встроенной кнопки Play
            // Это лучшая практика и соответствует требованиям для Chrome на iPhone
            console.log('ℹ️ Плеер готов. Пользователь может нажать кнопку Play для воспроизведения.');
          },
          'onError': function(event) {
            const errorCode = event.data;
            console.error('❌ Ошибка YouTube плеера:', errorCode);
            
            let errorMessage = 'Неизвестная ошибка YouTube';
            switch(errorCode) {
              case 2:
                errorMessage = 'Ошибка 2: Неверный параметр значения. Проверьте videoId.';
                break;
              case 5:
                errorMessage = 'Ошибка 5: HTML5 ошибка воспроизведения. Возможно, проблема с браузером.';
                break;
              case 100:
                errorMessage = 'Ошибка 100: Видео не найдено или недоступно.';
                break;
              case 101:
                errorMessage = 'Ошибка 101: Воспроизведение на этом сайте не разрешено владельцем видео.';
                break;
              case 150:
                errorMessage = 'Ошибка 150: Воспроизведение на этом сайте не разрешено владельцем видео.';
                break;
              case 153:
                errorMessage = 'Ошибка 153: Проблема с кодированием видеопотока. Попробуйте обновить страницу.';
                // Для ошибки 153 пытаемся пересоздать плеер
                console.warn('⚠️ Обнаружена ошибка 153, пробуем пересоздать плеер...');
                setTimeout(() => {
                  if (videoId && videoIframeContainer) {
                    createYouTubeIframe(videoId);
                  }
                }, 2000);
                return;
              default:
                errorMessage = `Ошибка ${errorCode}: Проблема с воспроизведением видео.`;
            }
            
            console.error('📋 Описание ошибки:', errorMessage);
            
            // При ошибке открываем видео в новой вкладке
            if (currentVideoUrl) {
              console.log('🔗 Открываем видео напрямую на YouTube:', currentVideoUrl);
              window.open(currentVideoUrl, '_blank');
            }
            
            // Закрываем overlay
            setTimeout(() => {
              closeVideoOverlay();
            }, 1000);
          },
          'onStateChange': function(event) {
            const state = event.data;
            const stateNames = {
              0: 'ENDED',
              1: 'PLAYING',
              2: 'PAUSED',
              3: 'BUFFERING',
              5: 'CUED'
            };
            
            const stateName = stateNames[state] || 'UNKNOWN';
            console.log('📺 Изменение состояния плеера:', stateName, `(${state})`);
            
            // Обновляем флаги
            if (state === YT.PlayerState.PLAYING) {
              isPlaying = true;
              isPaused = false;
            } else if (state === YT.PlayerState.PAUSED) {
              isPlaying = false;
              isPaused = true;
            }
          }
        }
      });
      
      console.log('✅ YouTube IFrame API плеер создан');
      
    } catch (error) {
      console.error('❌ Ошибка создания YouTube IFrame API плеера:', error);
      console.error('📋 Детали ошибки:', {
        message: error.message,
        stack: error.stack,
        videoId: videoId,
        containerExists: !!videoIframeContainer,
        YTApiAvailable: typeof YT !== 'undefined' && typeof YT.Player !== 'undefined'
      });
      
      // Fallback: если API недоступно, используем простой iframe
      // FIX: Не вызываем fallback автоматически - он должен вызываться из обработчика клика
      // Это обеспечит передачу gesture context в Chrome iOS
      if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
        console.warn('⚠️ YouTube IFrame API не загружен, fallback будет создан при клике пользователя');
        // Не создаём fallback здесь - он будет создан при клике пользователя
        return;
      } else {
        if (currentVideoUrl) {
          window.open(currentVideoUrl, '_blank');
        }
        closeVideoOverlay();
      }
    }
  }
  
  // Fallback функция для создания простого iframe (если API недоступно)
  // FIX: Эта функция вызывается строго внутри обработчика клика пользователя для передачи gesture context
  function createYouTubeIframeFallback(videoId) {
    try {
      // FIX: embedUrl содержит playsinline=1, enablejsapi=1, origin (без autoplay)
      // autoplay отсутствует - видео запускается только после нажатия встроенной кнопки Play
      const embedUrl = `https://www.youtube.com/embed/${videoId}?playsinline=1&controls=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
      
      const iframe = document.createElement('iframe');
      iframe.setAttribute('frameborder', '0');
      // FIX: allow="autoplay" присутствует - это разрешение (permission), но autoplay не включен в URL параметрах
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('allowfullscreen', '');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.display = 'block';
      
      // FIX: Вставляем iframe в DOM строго внутри клика пользователя
      videoIframeContainer.appendChild(iframe);
      currentVideoIframe = iframe;
      
      // FIX: Установка src строго внутри обработчика клика - gesture context передаётся корректно в WKWebView
      // Это критично для исправления ошибки 153 в Chrome на iPhone
      iframe.src = embedUrl;
      console.log('✅ Fallback iframe создан и src установлен при клике пользователя (gesture context передан)');
      
      iframe.onload = function() {
        console.log('✅ Fallback iframe загружен');
      };
      
    } catch (error) {
      console.error('❌ Ошибка создания fallback iframe:', error);
      if (currentVideoUrl) {
        window.open(currentVideoUrl, '_blank');
      }
      closeVideoOverlay();
    }
  }
  
  // Глобальная функция для обработки готовности YouTube IFrame API
  window.onYouTubeIframeAPIReady = function() {
    console.log('✅ YouTube IFrame API загружен и готов к использованию');
  };
  
  // Функция для пересчета размеров видео-контейнеров при смене ориентации
  function handleOrientationChange() {
    console.log('📱 Изменение ориентации экрана');
    
    // Если overlay открыт, пересчитываем размеры контейнера
    if (videoOverlay && videoOverlay.classList.contains('show')) {
      // Даем браузеру время на пересчет размеров
      setTimeout(() => {
        const container = videoIframeContainer;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          console.log('📐 Пересчет размеров контейнера после смены ориентации:', {
            width: containerRect.width,
            height: containerRect.height,
            orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
          });
          
          // Если есть YouTube плеер, обновляем его размеры
          if (youtubePlayer && typeof youtubePlayer.setSize === 'function') {
            try {
              // YouTube API автоматически пересчитает размеры при изменении контейнера
              // Но можно явно вызвать resize, если нужно
              const iframe = container.querySelector('iframe');
              if (iframe) {
                // Если размеры контейнера изменились, YouTube плеер автоматически адаптируется
                console.log('✅ Размеры YouTube плеера будут пересчитаны автоматически');
              }
            } catch (e) {
              console.warn('⚠️ Ошибка при обновлении размеров YouTube плеера:', e);
            }
          }
          
          // Пересчитываем размеры для VK и Instagram iframe
          const iframe = container.querySelector('iframe');
          if (iframe) {
            const iframeRect = iframe.getBoundingClientRect();
            console.log('📐 Размеры iframe после смены ориентации:', {
              width: iframeRect.width,
              height: iframeRect.height
            });
          }
        }
      }, 100);
    }
  }
  
  // Обработчик смены ориентации экрана
  let orientationChangeTimeout;
  window.addEventListener('orientationchange', function() {
    clearTimeout(orientationChangeTimeout);
    // Даем браузеру время на обработку смены ориентации
    orientationChangeTimeout = setTimeout(handleOrientationChange, 200);
  });
  
  // Обработчик изменения размера окна (работает и при смене ориентации на некоторых устройствах)
  window.addEventListener('resize', function() {
    // Используем debounce для оптимизации
    clearTimeout(orientationChangeTimeout);
    orientationChangeTimeout = setTimeout(function() {
      // Проверяем, изменилась ли ориентация
      const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      const previousOrientation = window.previousOrientation || currentOrientation;
      
      if (currentOrientation !== previousOrientation) {
        window.previousOrientation = currentOrientation;
        handleOrientationChange();
      }
    }, 200);
  });
  
  // Инициализируем предыдущую ориентацию
  window.previousOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  
  // Создание VK iframe (изолированная функция)
  function createVkIframe(url) {
    if (!url || !videoIframeContainer) {
      console.error('❌ createVkIframe: отсутствует url или videoIframeContainer');
      if (currentVideoUrl) {
        window.open(currentVideoUrl, '_blank');
      }
      closeVideoOverlay();
      return;
    }
    
    try {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('scrolling', 'no');
      iframe.setAttribute('allow', 'fullscreen');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.display = 'block';
      iframe.src = url;
      
      iframe.onerror = function() {
        console.error('❌ Ошибка загрузки VK iframe');
        if (currentVideoUrl) {
          window.open(currentVideoUrl, '_blank');
        }
        closeVideoOverlay();
      };
      
      iframe.onload = function() {
        console.log('✅ VK iframe загружен');
      };
      
      videoIframeContainer.appendChild(iframe);
      currentVideoIframe = iframe;
      console.log('✅ VK iframe создан и добавлен в контейнер');
      
    } catch (error) {
      console.error('❌ Ошибка создания VK iframe:', error);
      if (currentVideoUrl) {
        window.open(currentVideoUrl, '_blank');
      }
      closeVideoOverlay();
    }
  }
  
  // Создание Instagram iframe (изолированная функция)
  async function createInstagramIframe(url) {
    if (!url || !videoIframeContainer) {
      console.error('❌ createInstagramIframe: отсутствует url или videoIframeContainer');
      if (currentVideoUrl) {
        window.open(currentVideoUrl, '_blank');
      }
      closeVideoOverlay();
      return;
    }
    
    // Добавляем класс для Instagram контейнера (более гибкий размер)
    const container = videoOverlay.querySelector('.video-overlay-container');
    if (container) {
      container.classList.add('instagram-container');
    }
    
    // Показываем индикатор загрузки
    videoIframeContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;">Загрузка...</div>';
    
    try {
      console.log('▶️ Загрузка Instagram embed для:', url);
      const embedHtml = await getInstagramEmbed(url);
      if (!embedHtml) {
        console.warn('⚠️ Не удалось получить Instagram embed');
        window.open(url, '_blank');
        closeVideoOverlay();
        return;
      }
      
      // Вставляем HTML от Instagram oEmbed API
      videoIframeContainer.innerHTML = embedHtml;
      
      // Находим iframe в вставленном HTML
      const iframe = videoIframeContainer.querySelector('iframe');
      if (iframe) {
        iframe.setAttribute('allow', 'encrypted-media; fullscreen; picture-in-picture');
        iframe.setAttribute('scrolling', 'no');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        iframe.style.minHeight = '600px';
        currentVideoIframe = iframe;
        console.log('✅ Instagram iframe создан');
      } else {
        console.warn('⚠️ iframe не найден в Instagram embed HTML');
      }
    } catch (err) {
      console.error('❌ Ошибка загрузки Instagram:', err);
      window.open(url, '_blank');
      closeVideoOverlay();
    }
  }
  
  // Универсальная функция открытия видео overlay (поддержка YouTube, VK, Instagram)
  // Доступна для всех пользователей, включая гостей (без авторизации)
  async function openVideoOverlay(videoUrl) {
    if (!videoUrl) {
      console.warn('⚠️ openVideoOverlay: videoUrl не указан');
      return;
    }
    
    // Защита от повторных вызовов
    if (isVideoOpening) {
      console.log('ℹ️ Видео уже открывается, пропускаем повторный вызов');
      return;
    }
    
    // Проверяем наличие элементов
    if (!videoOverlay || !videoIframeContainer) {
      console.error('❌ Video overlay elements not found, opening in new tab');
      window.open(videoUrl, '_blank');
      return;
    }
    
    try {
      isVideoOpening = true;
      currentVideoUrl = videoUrl;
      
      // Определяем тип видео
      const videoType = getVideoType(videoUrl);
      
      if (!videoType) {
        console.warn('⚠️ Неизвестный тип видео:', videoUrl);
        window.open(videoUrl, '_blank');
        return;
      }
      
      // Очищаем предыдущий контент
      if (currentVideoIframe) {
        try {
          currentVideoIframe.src = '';
        } catch (e) {
          // Игнорируем ошибки при очистке
        }
        currentVideoIframe = null;
      }
      videoIframeContainer.innerHTML = '';
      
      // Показываем overlay сразу (с индикатором загрузки для Instagram)
      videoOverlay.classList.add('show');
      videoOverlay.setAttribute('aria-hidden', 'false');
      videoOverlay.style.display = 'flex'; // Дополнительно устанавливаем display для надежности
      document.body.style.overflow = 'hidden';
      
      console.log('✅ Overlay показан, класс show добавлен');
      
      // FIX: Для YouTube плеер создаётся строго в обработчике клика на кнопку "Обзор" (не через openVideoOverlay)
      // Это обеспечивает передачу gesture context для устранения ошибки 153 в Chrome на iPhone
      if (videoType === 'youtube') {
        console.warn('⚠️ YouTube видео должно обрабатываться через обработчик клика на кнопку "Обзор"');
        window.open(videoUrl, '_blank');
        closeVideoOverlay();
        return;
        
      } else if (videoType === 'vk') {
        const vkParams = extractVKVideoParams(videoUrl);
        if (!vkParams) {
          console.warn('⚠️ Не удалось извлечь параметры VK из URL:', videoUrl);
          window.open(videoUrl, '_blank');
          closeVideoOverlay();
          return;
        }
        const embedUrl = buildVKEmbedUrl(vkParams);
        console.log('▶️ Открытие VK видео:', embedUrl);
        createVkIframe(embedUrl);
        
      } else if (videoType === 'instagram') {
        console.log('▶️ Открытие Instagram видео:', videoUrl);
        await createInstagramIframe(videoUrl);
        
      } else {
        // Неизвестный тип - открываем в новой вкладке
        console.warn('⚠️ Неизвестный тип видео:', videoType);
        window.open(videoUrl, '_blank');
        closeVideoOverlay();
      }
    } catch (error) {
      console.error('❌ Критическая ошибка в openVideoOverlay:', error);
      window.open(videoUrl, '_blank');
      closeVideoOverlay();
    } finally {
      // Сбрасываем флаг после небольшой задержки, чтобы дать время iframe загрузиться
      setTimeout(() => {
        isVideoOpening = false;
      }, 500);
    }
  }
  
  
  // Функция закрытия видео overlay
  function closeVideoOverlay() {
    // Сбрасываем флаг открытия
    isVideoOpening = false;
    
    // Сбрасываем флаги воспроизведения
    isPlaying = false;
    isPaused = false;
    
    // Останавливаем и уничтожаем YouTube плеер
    if (youtubePlayer) {
      try {
        // Останавливаем воспроизведение
        if (youtubePlayer.stopVideo) {
          youtubePlayer.stopVideo();
        }
        // Уничтожаем плеер
        if (youtubePlayer.destroy) {
          youtubePlayer.destroy();
        }
        console.log('🛑 YouTube плеер остановлен и уничтожен');
      } catch (e) {
        console.warn('⚠️ Ошибка при остановке YouTube плеера:', e);
      }
      youtubePlayer = null;
    }
    
    // Очищаем src у iframe для остановки воспроизведения (fallback)
    if (currentVideoIframe) {
      try {
        currentVideoIframe.src = '';
      } catch (e) {
        // Игнорируем ошибки при очистке
      }
      currentVideoIframe = null;
    }
    
    // Очищаем контейнер
    if (videoIframeContainer) {
      videoIframeContainer.innerHTML = '';
    }
    
    // Убираем класс instagram-container если был добавлен
    const container = videoOverlay ? videoOverlay.querySelector('.video-overlay-container') : null;
    if (container) {
      container.classList.remove('instagram-container');
    }
    
    currentVideoUrl = null;
    
    // Скрываем overlay
    if (videoOverlay) {
      videoOverlay.classList.remove('show');
      videoOverlay.setAttribute('aria-hidden', 'true');
      videoOverlay.style.display = 'none'; // Дополнительно устанавливаем display для надежности
    }
    document.body.style.overflow = '';
    console.log('✅ Video overlay закрыт');
  }
  
  // FIX: Функция открытия overlay с изображением (старый вариант)
  function openImageOverlay(imageSrc, imageIndex, images, productId) {
    currentImages = images;
    currentImageIndex = imageIndex;
    if (imageOverlay && imageOverlayImg) {
      imageOverlayImg.src = imageSrc;
      imageOverlayImg.alt = `Изображение ${imageIndex + 1} из ${images.length}`;
      imageOverlay.classList.add('show');
      imageOverlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  // FIX: Функция открытия модального окна с изображением
  function openImageModal(imageSrc, imageIndex, images, productName) {
    currentImages = images || [imageSrc];
    currentImageIndex = imageIndex || 0;
    currentProductName = productName || '';
    
    if (imageModal && imageModalImage) {
      imageModalImage.src = currentImages[currentImageIndex];
      imageModalImage.alt = `${productName} - изображение ${currentImageIndex + 1}`;
      
      if (imageModalCurrent) {
        imageModalCurrent.textContent = currentImageIndex + 1;
      }
      if (imageModalTotal) {
        imageModalTotal.textContent = currentImages.length;
      }
      if (imageModalTitle) {
        imageModalTitle.textContent = productName;
      }
      
      imageModal.style.display = 'flex';
      imageModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  // FIX: Функция закрытия overlay с изображением
  function closeImageOverlay() {
    if (imageOverlay) {
      imageOverlay.classList.remove('show');
      imageOverlay.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    currentImages = [];
    currentImageIndex = 0;
  }

  // FIX: Функция закрытия модального окна с изображением
  function closeImageModal() {
    if (imageModal) {
      imageModal.style.display = 'none';
      imageModal.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    currentImages = [];
    currentImageIndex = 0;
    currentProductName = '';
  }

  // FIX: Функция переключения изображения в overlay
  function navigateImage(direction) {
    if (currentImages.length === 0) return;
    if (direction === 'next') {
      currentImageIndex = (currentImageIndex + 1) % currentImages.length;
    } else if (direction === 'prev') {
      currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
    }
    
    // Обновляем overlay (старый вариант)
    if (imageOverlay && imageOverlayImg) {
      imageOverlayImg.src = currentImages[currentImageIndex];
      imageOverlayImg.alt = `Изображение ${currentImageIndex + 1} из ${currentImages.length}`;
    }
    
    // Обновляем модальное окно (новый вариант)
    if (imageModal && imageModalImage) {
      imageModalImage.src = currentImages[currentImageIndex];
      imageModalImage.alt = `${currentProductName} - изображение ${currentImageIndex + 1}`;
      if (imageModalCurrent) {
        imageModalCurrent.textContent = currentImageIndex + 1;
      }
    }
  }

  // FIX: Инициализация слайдера изображений
  function initImageSliders() {
    const sliders = document.querySelectorAll('.product-images-slider');
    sliders.forEach(slider => {
      const images = slider.querySelectorAll('.product-image-slide');
      if (images.length <= 1) return;

      const prevBtn = slider.querySelector('.slider-arrow-prev');
      const nextBtn = slider.querySelector('.slider-arrow-next');
      const indicators = slider.querySelectorAll('.slider-indicator');
      let currentIndex = 0;

      // FIX: Функция переключения слайда
      function goToSlide(index) {
        images.forEach((img, idx) => {
          img.classList.toggle('active', idx === index);
        });
        indicators.forEach((ind, idx) => {
          ind.classList.toggle('active', idx === index);
        });
        currentIndex = index;
      }

      // FIX: Обработчики стрелок
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          goToSlide((currentIndex - 1 + images.length) % images.length);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          goToSlide((currentIndex + 1) % images.length);
        });
      }

      // FIX: Обработчики индикаторов
      indicators.forEach((ind, idx) => {
        ind.addEventListener('click', (e) => {
          e.stopPropagation();
          goToSlide(idx);
        });
      });

      // FIX: Обработчик клика на изображение для открытия в модальном окне
      images.forEach((img, idx) => {
        img.addEventListener('click', () => {
          // Пытаемся получить массив изображений из data-атрибута
          let allImages = [];
          try {
            const imagesData = img.getAttribute('data-product-images');
            if (imagesData) {
              allImages = JSON.parse(imagesData);
            } else {
              allImages = Array.from(images).map(i => i.getAttribute('data-image-src') || i.src);
            }
          } catch (e) {
            allImages = Array.from(images).map(i => i.getAttribute('data-image-src') || i.src);
          }
          
          const productName = img.getAttribute('data-product-name') || '';
          const imageSrc = img.getAttribute('data-image-src') || img.src;
          
          // Используем новое модальное окно
          if (imageModal) {
            openImageModal(imageSrc, idx, allImages, productName);
          } else if (imageOverlay) {
            // Fallback на старое overlay
            // FIX: убрано повторное объявление productId - используем присвоение
            productId = slider.getAttribute('data-product-id');
            openImageOverlay(imageSrc, idx, allImages, productId);
          }
        });
      });

      // FIX: Поддержка свайпа на мобильных устройствах
      let touchStartX = 0;
      let touchEndX = 0;
      let touchStartY = 0;
      let touchEndY = 0;

      slider.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      slider.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
      }, { passive: true });

      function handleSwipe() {
        const swipeThreshold = 50;
        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;
        
        // FIX: Проверяем, что свайп горизонтальный (не вертикальный)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > swipeThreshold) {
          if (diffX > 0) {
            // Свайп влево - следующее изображение
            goToSlide((currentIndex + 1) % images.length);
          } else {
            // Свайп вправо - предыдущее изображение
            goToSlide((currentIndex - 1 + images.length) % images.length);
          }
        }
      }

      // FIX: Поддержка клавиатурной навигации для слайдера (если фокус на карточке)
      const productCard = slider.closest('.product-card');
      if (productCard) {
        productCard.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToSlide((currentIndex - 1 + images.length) % images.length);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            goToSlide((currentIndex + 1) % images.length);
          }
        });
      }
    });
  }

  // FIX: Клавиатурная навигация для модального окна изображений
  document.addEventListener('keydown', (e) => {
    if (!imageModal || imageModal.style.display === 'none') return;
    
    if (e.key === 'Escape') {
      closeImageModal();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateImage('prev');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateImage('next');
    }
  });

  // FIX: Инициализация всех компонентов
  initImageSliders();

  // FIX: Обработчик клика на кнопку "Обзор" и закрытия overlay
  // Просмотр видео доступен для всех пользователей (включая гостей)
  document.addEventListener('click', (e) => {
    // FIX: Открытие видео по клику на кнопку "Обзор" - создаём плеер строго внутри клика пользователя
    const videoBtn = e.target.closest('.btn[data-video]');
    if (videoBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // Останавливаем дальнейшее распространение события
      
      const videoUrl = videoBtn.getAttribute('data-video');
      if (videoUrl) {
        console.log('🎬 Клик на кнопку видео, URL:', videoUrl);
        
        // FIX: Определяем тип видео для правильной обработки
        const videoType = getVideoType(videoUrl);
        
        if (videoType === 'youtube') {
          const videoId = extractVideoId(videoUrl);
          if (!videoId) {
            console.warn('⚠️ Не удалось извлечь videoId из URL:', videoUrl);
            window.open(videoUrl, '_blank');
            return false;
          }
          
          // FIX: Показываем overlay перед созданием плеера
          if (!videoOverlay || !videoIframeContainer) {
            console.error('❌ Video overlay elements not found, opening in new tab');
            window.open(videoUrl, '_blank');
            return false;
          }
          
          // Очищаем предыдущий контент
          if (currentVideoIframe) {
            try {
              currentVideoIframe.src = '';
            } catch (e) {
              // Игнорируем ошибки при очистке
            }
            currentVideoIframe = null;
          }
          if (youtubePlayer) {
            try {
              youtubePlayer.destroy();
            } catch (e) {
              // Игнорируем ошибки
            }
            youtubePlayer = null;
          }
          videoIframeContainer.innerHTML = '';
          
          // Показываем overlay
          videoOverlay.classList.add('show');
          videoOverlay.setAttribute('aria-hidden', 'false');
          videoOverlay.style.display = 'flex';
          document.body.style.overflow = 'hidden';
          
          currentVideoUrl = videoUrl;
          
          // FIX: Создаём плеер строго внутри клика пользователя для устранения ошибки 153 в Chrome на iPhone
          // Gesture context передаётся корректно в WKWebView
          console.log('✅ Создание YouTube плеера внутри обработчика клика (gesture context передан)');
          
          // Проверяем, что YouTube IFrame API загружен
          if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
            console.warn('⚠️ YouTube IFrame API еще не загружен, используем fallback');
            // FIX: Fallback создаётся строго внутри клика пользователя - gesture context передаётся в WKWebView
            createYouTubeIframeFallback(videoId);
          } else {
            // FIX: Создаём плеер строго внутри клика пользователя - gesture context передаётся в WKWebView
            createYouTubeIframe(videoId);
          }
        } else if (videoType === 'vk' || videoType === 'instagram') {
          // Для VK и Instagram используем старую логику (они не требуют gesture context)
          openVideoOverlay(videoUrl).catch(err => {
            console.error('❌ Ошибка при открытии видео:', err);
            window.open(videoUrl, '_blank');
          });
        } else {
          // Неизвестный тип - открываем в новой вкладке
          window.open(videoUrl, '_blank');
        }
      } else {
        console.warn('⚠️ Кнопка видео не содержит data-video атрибут');
      }
      return false; // Дополнительная защита от всплытия
    }
    
    // FIX: Закрытие видео overlay по кнопке закрытия (обрабатывается выше вместе с кликом на фон)
    
    // FIX: Обработчик клика на баннеры для открытия в overlay (но не на кнопку ссылки)
    if (e.target.closest('.banner-link-icon')) {
      // Клик на кнопку ссылки - не обрабатываем, позволяем перейти по ссылке
      return;
    }
    
    if (e.target.classList.contains('banner-clickable')) {
      e.preventDefault();
      e.stopPropagation();
      const bannerImage = e.target.getAttribute('data-banner-image') || e.target.src;
      if (bannerImage && imageOverlay && imageOverlayImg) {
        currentImages = [bannerImage];
        currentImageIndex = 0;
        openImageOverlay(bannerImage, 0, [bannerImage], null);
      }
      return;
    }
    
    // FIX: Обработчик клика на изображения с классом image-clickable
    if (e.target.classList.contains('image-clickable')) {
      e.preventDefault();
      e.stopPropagation();
      const img = e.target;
      let allImages = [];
      try {
        const imagesData = img.getAttribute('data-product-images');
        if (imagesData) {
          allImages = JSON.parse(imagesData);
        } else {
          allImages = [img.getAttribute('data-image-src') || img.src];
        }
      } catch (e) {
        allImages = [img.getAttribute('data-image-src') || img.src];
      }
      
      const imageIndex = parseInt(img.getAttribute('data-image-index')) || 0;
      const productName = img.getAttribute('data-product-name') || '';
      const imageSrc = img.getAttribute('data-image-src') || img.src;
      
      if (imageModal) {
        openImageModal(imageSrc, imageIndex, allImages, productName);
      }
      return;
    }
    
    // FIX: Закрытие модального окна изображений
    if (e.target.closest('[data-close-image]')) {
      e.preventDefault();
      e.stopPropagation();
      closeImageModal();
      return;
    }
    
    // FIX: Навигация по изображениям в модальном окне
    if (e.target.closest('.image-nav-prev')) {
      e.preventDefault();
      e.stopPropagation();
      navigateImage('prev');
      return;
    }
    
    if (e.target.closest('.image-nav-next')) {
      e.preventDefault();
      e.stopPropagation();
      navigateImage('next');
      return;
    }
    
    // FIX: Закрытие модального окна по клику на фон
    if (e.target === imageModal) {
      closeImageModal();
      return;
    }
    
    // FIX: Закрытие видео overlay по клику на фон или кнопке закрытия
    if (videoOverlay && (e.target === videoOverlay || e.target.closest('[data-close-video]'))) {
      e.preventDefault();
      e.stopPropagation();
      closeVideoOverlay();
      return;
    }
    
    // FIX: Закрытие изображения overlay по кнопке закрытия
    if (e.target.closest('[data-close-image]')) {
      e.preventDefault();
      e.stopPropagation();
      closeImageOverlay();
      return;
    }

    // FIX: Закрытие изображения overlay по клику на фон
    if (e.target === imageOverlay) {
      closeImageOverlay();
      return;
    }

    // FIX: Навигация по изображениям в overlay
    const imageNavBtn = e.target.closest('[data-image-nav]');
    if (imageNavBtn) {
      e.preventDefault();
      e.stopPropagation();
      const direction = imageNavBtn.getAttribute('data-image-nav');
      navigateImage(direction);
      return;
    }
  });

  // FIX: Поддержка клавиатурной навигации в overlay изображений
  document.addEventListener('keydown', (e) => {
    if (!imageOverlay.classList.contains('show')) return;
    
    if (e.key === 'Escape') {
      closeImageOverlay();
    } else if (e.key === 'ArrowLeft') {
      navigateImage('prev');
    } else if (e.key === 'ArrowRight') {
      navigateImage('next');
    }
  });

  // ====== Регистрация ======
  const registerModal = document.getElementById("registerModal");
  const openRegisterBtn = document.getElementById("openRegister");
  const closeRegisterBtn = document.querySelector("[data-close-register]");
  const registerForm = document.getElementById("registerForm");
  const registerError = document.getElementById("registerError");
  const registerSuccess = document.getElementById("registerSuccess");

  if (openRegisterBtn && registerModal) {
    openRegisterBtn.addEventListener("click", () => {
      registerModal.style.display = "block";
      registerModal.setAttribute("aria-hidden", "false");
    });

    if (closeRegisterBtn) {
      closeRegisterBtn.addEventListener("click", () => {
        registerModal.style.display = "none";
        registerModal.setAttribute("aria-hidden", "true");
        if (registerError) registerError.style.display = "none";
      });
    }

    window.addEventListener("click", (e) => {
      if (e.target === registerModal) {
        registerModal.style.display = "none";
        registerModal.setAttribute("aria-hidden", "true");
      }
    });
  }

  if (registerForm) {
    // В Vercel serverless CSRF отключен, поэтому не ищем токены
    const isVercel = window.location.hostname.includes('vercel.app') ||
                     window.location.hostname.includes('extension-investment');

    let existingCsrfToken = null;
    if (!isVercel) {
      // Получаем CSRF токен из существующей формы входа (только не в Vercel)
      existingCsrfToken = document.querySelector('input[name="_csrf"]')?.value ||
                         document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

      // Устанавливаем CSRF токен в форму регистрации
      const registerCsrfField = document.getElementById('registerCsrfToken');
      if (registerCsrfField && existingCsrfToken) {
        registerCsrfField.value = existingCsrfToken;
      }
    }

    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(registerForm).entries());

      if (registerError) registerError.style.display = "none";
      if (registerSuccess) registerSuccess.style.display = "none";

      try {
        const headers = {
          "Content-Type": "application/json"
        };

        // Добавляем CSRF токен только если не в Vercel
        if (!isVercel && (formData._csrf || existingCsrfToken)) {
          headers["X-CSRF-Token"] = formData._csrf || existingCsrfToken;
        }

        const res = await fetch("/auth/register", {
          method: "POST",
          headers: headers,
          body: JSON.stringify(formData),
          credentials: 'same-origin'
        });
        const data = await res.json();

        if (data.success) {
          if (registerError) registerError.style.display = "none";
          if (registerSuccess) {
            registerSuccess.textContent = "Регистрация завершена. Теперь вы можете открыть личный кабинет.";
            registerSuccess.style.display = "block";
          } else {
            alert("Регистрация завершена");
          }
          registerForm.reset();
          // Закрываем модальное окно через 2 секунды
          setTimeout(() => {
            if (registerModal) {
              registerModal.style.display = "none";
              registerModal.setAttribute("aria-hidden", "true");
            }
          }, 2000);
        } else {
          if (registerError) {
            registerError.textContent = data.message || "Ошибка регистрации";
            registerError.style.display = "block";
          } else {
            alert(data.message || "Ошибка регистрации");
          }
        }
      } catch (err) {
        console.error("Registration error:", err);
        if (registerError) {
          registerError.textContent = "Сеть недоступна или сервер не отвечает";
          registerError.style.display = "block";
        } else {
          alert("Сеть недоступна или сервер не отвечает");
        }
      }
    });
  }

  // FIX: Модальное окно описания товара
  const descriptionModal = document.getElementById('descriptionModal');
  const descriptionModalTitle = document.getElementById('descriptionModalTitle');
  const descriptionModalContent = document.getElementById('descriptionModalContent');
  const closeDescriptionBtn = document.querySelector('[data-close-description]');

  // Функция открытия модального окна описания
  function openDescriptionModal(productName, description) {
    if (!descriptionModal || !description) return;
    
    if (descriptionModalTitle) {
      descriptionModalTitle.textContent = productName || 'Описание товара';
    }
    
    if (descriptionModalContent) {
      // Экранируем HTML и создаем параграф
      const p = document.createElement('p');
      p.style.whiteSpace = 'pre-wrap';
      p.style.wordWrap = 'break-word';
      p.textContent = description;
      descriptionModalContent.innerHTML = '';
      descriptionModalContent.appendChild(p);
    }
    
    descriptionModal.style.display = 'block';
    descriptionModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // Функция закрытия модального окна описания
  function closeDescriptionModal() {
    if (!descriptionModal) return;
    descriptionModal.style.display = 'none';
    descriptionModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Обработчик клика на значок "i" или кнопку "Описание"
  document.addEventListener('click', (e) => {
    // Клик на значок "i"
    const infoIcon = e.target.closest('.product-info-icon');
    if (infoIcon) {
      e.preventDefault();
      e.stopPropagation();
      const productName = infoIcon.getAttribute('data-product-name') || 'Товар';
      const description = infoIcon.getAttribute('data-description') || '';
      openDescriptionModal(productName, description);
      return;
    }

    // Клик на кнопку "Описание" (для совместимости)
    const descBtn = e.target.closest('[data-description-modal]');
    if (descBtn) {
      e.preventDefault();
      e.stopPropagation();
      const productName = descBtn.getAttribute('data-product-name') || 'Товар';
      const description = descBtn.getAttribute('data-description') || '';
      openDescriptionModal(productName, description);
      return;
    }

    // Закрытие модального окна описания
    if (e.target.closest('[data-close-description]')) {
      e.preventDefault();
      e.stopPropagation();
      closeDescriptionModal();
      return;
    }

    // Закрытие по клику на фон
    if (e.target === descriptionModal) {
      closeDescriptionModal();
      return;
    }
  });

  // Обработчик закрытия по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Закрываем модальное окно описания
      if (descriptionModal && descriptionModal.style.display === 'block') {
        closeDescriptionModal();
      }
      // Закрываем видео overlay
      if (videoOverlay && videoOverlay.classList.contains('show')) {
        closeVideoOverlay();
      }
    }
  });

  // ====== Категории и рейтинг ======
  document.addEventListener("click", async (e) => {
    // FIX: Пропускаем обработку, если клик по кнопке видео, изображениям или описанию (уже обработано выше)
    if (e.target.closest('.btn[data-video]') || 
        e.target.closest('[data-close-video]') || 
        e.target === videoOverlay ||
        e.target.closest('.product-image-slide') ||
        e.target.closest('.slider-arrow') ||
        e.target.closest('.slider-indicator') ||
        e.target.closest('[data-close-image]') ||
        e.target.closest('[data-image-nav]') ||
        e.target === imageOverlay ||
        e.target.closest('.product-info-icon') ||
        e.target.closest('[data-description-modal]') ||
        e.target.closest('[data-close-description]') ||
        e.target === descriptionModal) {
      return;
    }

    // Категории (открытие/закрытие/выбор)
    const openCat = e.target.closest("#openCategories");
    const dropdown = document.getElementById("categoriesMenu");

    if (openCat && dropdown) {
      const opened = dropdown.classList.toggle("open");
      dropdown.setAttribute("aria-hidden", opened ? "false" : "true");
      return;
    }

    const catItem = e.target.closest(".dropdown-item");
    if (catItem && dropdown) {
      const cat = catItem.getAttribute("data-category");
      const url = new URL(window.location.href);
      if (cat === "all") url.searchParams.delete("category");
      else url.searchParams.set("category", cat);
      window.location.href = url.toString();
      return;
    }

    // Категории услуг (открытие/закрытие/выбор)
    const openServicesCat = e.target.closest("#openServicesCategories");
    const servicesDropdown = document.getElementById("servicesCategoriesMenu");

    if (openServicesCat && servicesDropdown) {
      const opened = servicesDropdown.classList.toggle("open");
      servicesDropdown.setAttribute("aria-hidden", opened ? "false" : "true");
      return;
    }

    const servicesCatItem = e.target.closest(".dropdown-item");
    if (servicesCatItem && servicesDropdown && e.target.closest("#openServicesCategories, #servicesCategoriesMenu")) {
      const cat = servicesCatItem.getAttribute("data-category");
      const url = new URL(window.location.href);
      if (cat === "all") url.searchParams.delete("category");
      else url.searchParams.set("category", cat);
      // Добавляем якорь для перехода к секции услуг
      url.hash = "services";
      window.location.href = url.toString();
      return;
    }

    if (dropdown && !e.target.closest(".category-dropdown")) {
      dropdown.classList.remove("open");
      dropdown.setAttribute("aria-hidden", "true");
    }

    if (servicesDropdown && !e.target.closest(".category-dropdown")) {
      servicesDropdown.classList.remove("open");
      servicesDropdown.setAttribute("aria-hidden", "true");
    }

    // Рейтинг (лайк/дизлайк) - доступно всем: гостям и пользователям
    const likeBtn = e.target.closest(".like-btn");
    const dislikeBtn = e.target.closest(".dislike-btn");

    if (likeBtn || dislikeBtn) {
      const ratingBlock = e.target.closest(".product-rating");
      if (!ratingBlock) return;
      
      // FIX: убрано повторное объявление productId - используем присвоение
      productId = ratingBlock.dataset.id;
      
      // Проверяем, голосовал ли уже (через cookie для гостей или data-атрибут для пользователей)
      if (ratingBlock.dataset.voted === "true") {
        return;
      }
      
      // Для гостей также проверяем cookie
      if (!window.IS_AUTH) {
        const voteCookie = document.cookie.split(';').some(cookie => cookie.trim().startsWith(`exto_vote_${productId}=`));
        if (voteCookie) {
          ratingBlock.dataset.voted = "true";
          ratingBlock.querySelectorAll("button").forEach((b) => {
            b.disabled = true;
          });
          return;
        }
      }

      const resultEl = ratingBlock.querySelector(".result");
      const votesEl = ratingBlock.querySelector(".votes");
      const value = likeBtn ? "like" : "dislike";

      // Отключаем кнопки сразу, чтобы предотвратить повторные клики
      ratingBlock.querySelectorAll("button").forEach((b) => {
        b.disabled = true;
      });

      try {
        const csrfMeta = document.querySelector('meta[name="csrf-token"]');
        const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : null;
        
        // Унифицированный формат: используем vote вместо value
        const vote = value === 'like' ? 'up' : 'down';
        
        const res = await fetch(`/api/rating/${productId}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || ''
          },
          body: JSON.stringify({ vote }),
          credentials: 'include' // Важно для отправки cookie
        });
        const data = await res.json();

        if (data.success) {
          if (resultEl) resultEl.textContent = String(data.result);
          if (votesEl) votesEl.textContent = `(${data.total} голосов)`;
          ratingBlock.dataset.voted = "true";
        } else {
          console.warn("⚠️ Сервер вернул ошибку:", data.message || data.error);
          // Включаем кнопки обратно при ошибке
          ratingBlock.querySelectorAll("button").forEach((b) => {
            b.disabled = false;
          });
          
          if (res.status === 409) {
            // Уже голосовал - помечаем как проголосовавший
            ratingBlock.dataset.voted = "true";
            ratingBlock.querySelectorAll("button").forEach((b) => {
              b.disabled = true;
            });
          } else {
            alert(data.message || "Ошибка при голосовании");
          }
        }
      } catch (err) {
        console.error("❌ Ошибка сохранения рейтинга:", err);
        // Включаем кнопки обратно при ошибке
        ratingBlock.querySelectorAll("button").forEach((b) => {
          b.disabled = false;
        });
      }
    }
  });
});

// =======================
// Универсальные функции для работы с карточками
// =======================

/**
 * Универсальная функция удаления карточки
 * @param {string} itemType - тип карточки: 'product', 'service', 'banner'
 * @param {string} itemId - ID карточки
 * @param {HTMLElement} cardElement - элемент карточки в DOM
 * @returns {Promise<boolean>} - успешно ли удалено
 */
async function deleteItem(itemType, itemId, cardElement) {
  const typeNames = { product: 'товар', service: 'услугу', banner: 'баннер' };
  const confirmed = confirm(`Вы уверены, что хотите удалить этот ${typeNames[itemType]}? Это действие нельзя отменить.`);
  if (!confirmed) {
    return false;
  }

  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (!csrfToken) {
    alert('Ошибка: отсутствует CSRF токен. Обновите страницу.');
    return false;
  }

  // Определяем эндпоинт в зависимости от контекста
  const isAdminPage = window.location.pathname.includes('/admin/');
  const endpoint = isAdminPage 
    ? `/admin/${itemType === 'product' ? 'products' : itemType === 'service' ? 'services' : 'banners'}/${itemId}`
    : `/api/${itemType === 'product' ? 'products' : itemType === 'service' ? 'services' : 'banners'}/${itemId}`;

  const deleteBtn = cardElement?.querySelector(`.delete-${itemType}-btn`);
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Удаление...';
  }

  try {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin'
    });

    const data = await res.json();

    if (data.success) {
      // Плавное удаление карточки (с проверкой)
      if (cardElement && cardElement.style) {
        cardElement.style.opacity = '0.5';
        cardElement.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          if (cardElement && cardElement.remove) {
            cardElement.remove();
          }
          
          // Проверяем, остались ли еще карточки
          const remainingCards = document.querySelectorAll('.catalog-item, .product-card');
          if (remainingCards && remainingCards.length === 0) {
            location.reload();
          }
        }, 300);
      }
      
      showToast(`✅ ${typeNames[itemType].charAt(0).toUpperCase() + typeNames[itemType].slice(1)} удалён`, 'success');
      return true;
    } else {
      if (deleteBtn && deleteBtn.disabled !== undefined) {
        deleteBtn.disabled = false;
      }
      if (deleteBtn && deleteBtn.textContent !== undefined) {
        deleteBtn.textContent = '🗑️ Удалить';
      }
      showToast('❌ Ошибка удаления: ' + (data.message || 'Неизвестная ошибка'), 'error');
      return false;
    }
  } catch (err) {
    console.error(`❌ Ошибка сети при удалении ${itemType}:`, err);
    if (deleteBtn && deleteBtn.disabled !== undefined) {
      deleteBtn.disabled = false;
    }
    if (deleteBtn && deleteBtn.textContent !== undefined) {
      deleteBtn.textContent = '🗑️ Удалить';
    }
    showToast('❌ Ошибка сети. Проверьте подключение к интернету', 'error');
    return false;
  }
}

/**
 * Универсальная функция голосования за карточку
 * @param {string} itemType - тип карточки: 'product', 'service', 'banner'
 * @param {string} itemId - ID карточки
 * @param {string} vote - 'up' или 'down'
 * @param {HTMLElement} ratingBlock - блок рейтинга
 * @returns {Promise<boolean>} - успешно ли проголосовано
 */
async function voteItem(itemType, itemId, vote, ratingBlock) {
  if (!ratingBlock) return false;
  
  // Проверяем, голосовал ли уже
  if (ratingBlock.dataset.voted === 'true') {
    return false;
  }

  // Отключаем кнопки (с проверкой существования)
  const buttons = ratingBlock.querySelectorAll('button');
  if (buttons && buttons.length > 0) {
    buttons.forEach(btn => {
      if (btn && btn.disabled !== undefined) {
        btn.disabled = true;
      }
    });
  }

  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

  try {
    // Определяем эндпоинт
    let endpoint;
    let body;
    
    // Унифицированный формат: используем vote: "up"/"down" для всех типов
    if (itemType === 'product') {
      endpoint = `/api/rating/${itemId}`;
    } else {
      endpoint = `/api/${itemType === 'service' ? 'services' : 'banners'}/${itemId}/vote`;
    }
    body = JSON.stringify({ vote }); // Единый формат для всех типов

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || ''
      },
      body: body,
      credentials: 'same-origin'
    });

    const data = await res.json();

    if (data.success) {
      // Обновляем отображение
      const resultEl = ratingBlock.querySelector(`.${itemType}-result`) || ratingBlock.querySelector('.rating-result');
      const votesEl = ratingBlock.querySelector(`.${itemType}-votes`) || ratingBlock.querySelector('.rating-votes');

      if (resultEl && resultEl.textContent !== undefined) {
        resultEl.textContent = data.result !== undefined ? data.result : ((data.rating_up || data.likes || 0) - (data.rating_down || data.dislikes || 0));
      }
      if (votesEl && votesEl.textContent !== undefined) {
        votesEl.textContent = `(${data.total !== undefined ? data.total : ((data.rating_up || data.likes || 0) + (data.rating_down || data.dislikes || 0))} голосов)`;
      }

      if (ratingBlock && ratingBlock.dataset) {
        ratingBlock.dataset.voted = 'true';
      }
      return true;
    } else {
      // Включаем кнопки обратно при ошибке (с проверкой)
      const buttons = ratingBlock.querySelectorAll('button');
      if (buttons && buttons.length > 0) {
        buttons.forEach(btn => {
          if (btn && btn.disabled !== undefined) {
            btn.disabled = false;
          }
        });
      }
      
      if (res.status === 409) {
        // Уже голосовал - помечаем как проголосовавший
        if (ratingBlock && ratingBlock.dataset) {
          ratingBlock.dataset.voted = 'true';
        }
        if (buttons && buttons.length > 0) {
          buttons.forEach(btn => {
            if (btn && btn.disabled !== undefined) {
              btn.disabled = true;
            }
          });
        }
      } else {
        showToast('Ошибка: ' + (data.message || 'Не удалось проголосовать'), 'error');
      }
      return false;
    }
  } catch (err) {
    console.error('Ошибка голосования:', err);
    const buttons = ratingBlock.querySelectorAll('button');
    if (buttons && buttons.length > 0) {
      buttons.forEach(btn => {
        if (btn && btn.disabled !== undefined) {
          btn.disabled = false;
        }
      });
    }
    showToast('Ошибка сети при голосовании', 'error');
    return false;
  }
}

/**
 * Универсальная функция блокировки/разблокировки карточки (только для админа)
 * @param {string} itemType - тип карточки: 'product', 'service', 'banner'
 * @param {string} itemId - ID карточки
 * @param {HTMLElement} button - кнопка блокировки
 * @returns {Promise<boolean>} - успешно ли изменен статус
 */
async function toggleBlock(itemType, itemId, button) {
  if (!button || !button.classList) return false;

  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (!csrfToken) {
    alert('Ошибка: отсутствует CSRF токен. Обновите страницу.');
    return false;
  }

  const action = button.classList.contains(`block-${itemType}-btn`) ? 'block' : 'publish';
  if (button.disabled !== undefined) {
    button.disabled = true;
  }
  if (button.textContent !== undefined) {
    button.textContent = action === 'block' ? 'Блокировка...' : 'Публикация...';
  }

  try {
    // Используем правильные эндпоинты для блокировки
    let endpoint;
    if (itemType === 'product') {
      endpoint = `/admin/products/${itemId}/toggle-visibility`;
    } else if (itemType === 'service') {
      endpoint = `/admin/services/${itemId}/toggle-visibility`;
    } else {
      endpoint = `/admin/banners/${itemId}/toggle-visibility`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin'
    });

    const data = await res.json();

    if (data.success) {
      showToast(data.message || 'Статус успешно изменен', 'success');
      setTimeout(() => location.reload(), 1000); // Перезагружаем страницу через 1 секунду
      return true;
    } else {
      showToast('Ошибка: ' + (data.message || 'Не удалось изменить статус'), 'error');
      if (button && button.disabled !== undefined) {
        button.disabled = false;
      }
      if (button && button.textContent !== undefined) {
        button.textContent = action === 'block' ? '🚫 Заблокировать' : '✅ Опубликовать';
      }
      return false;
    }
  } catch (err) {
    console.error('Ошибка изменения статуса:', err);
    showToast('Ошибка сети', 'error');
    if (button && button.disabled !== undefined) {
      button.disabled = false;
    }
    if (button && button.textContent !== undefined) {
      button.textContent = action === 'block' ? '🚫 Заблокировать' : '✅ Опубликовать';
    }
    return false;
  }
}

/**
 * Универсальная функция перехода к редактированию карточки
 * @param {string} itemType - тип карточки: 'product', 'service', 'banner'
 * @param {string} itemId - ID карточки
 */
function editItem(itemType, itemId) {
  if (!itemId) {
    alert('Ошибка: отсутствует ID');
    return;
  }

  // Определяем URL для редактирования
  let editUrl;
  const isAdminPage = window.location.pathname.includes('/admin/');
  const isCabinetPage = window.location.pathname.includes('/cabinet/');
  
  if (isAdminPage) {
    if (itemType === 'product') {
      editUrl = `/admin/products/${itemId}/edit`;
    } else if (itemType === 'service') {
      editUrl = `/admin/services/${itemId}/edit`;
    } else {
      editUrl = `/admin/banners/${itemId}/edit`;
    }
  } else if (isCabinetPage) {
    // Пользовательский кабинет
    if (itemType === 'product' || itemType === 'service') {
      editUrl = `/cabinet/product/${itemId}/edit`;
    } else {
      editUrl = `/cabinet/banner/${itemId}/edit`;
    }
  } else {
    // Публичная страница - редирект в кабинет
    if (itemType === 'product' || itemType === 'service') {
      editUrl = `/cabinet/product/${itemId}/edit`;
    } else {
      editUrl = `/cabinet/banner/${itemId}/edit`;
    }
  }

  window.location.href = editUrl;
}

/**
 * Показ toast-уведомления
 * @param {string} message - сообщение
 * @param {string} type - тип: 'success', 'error', 'info'
 */
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  if (toast.className !== undefined) {
    toast.className = 'toast toast-' + type;
  }
  if (toast.setAttribute) {
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
  }
  if (toast.style && toast.style.cssText !== undefined) {
    toast.style.cssText = `
      padding: 12px 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 250px;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
  }
  if (toast.textContent !== undefined) {
    toast.textContent = message;
  }

  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast && toast.style && toast.style.animation !== undefined) {
      toast.style.animation = 'slideOut 0.3s ease-out';
    }
    setTimeout(() => {
      if (toast && toast.parentNode && toast.parentNode.removeChild) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 5000);
}

  // Инициализация универсальных обработчиков при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  // Обработчики удаления (с безопасными проверками)
  document.addEventListener('click', async (e) => {
    if (!e || !e.target) return;
    
    const deleteBtn = e.target.closest && e.target.closest('.delete-product-btn, .delete-service-btn, .delete-banner-btn');
    if (deleteBtn && deleteBtn.classList) {
      e.preventDefault();
      const itemType = deleteBtn.classList.contains('delete-product-btn') ? 'product' 
        : deleteBtn.classList.contains('delete-service-btn') ? 'service' 
        : 'banner';
      const itemId = deleteBtn.dataset && deleteBtn.dataset.id ? deleteBtn.dataset.id : null;
      if (!itemId) {
        console.error('❌ Отсутствует ID карточки');
        return;
      }
      const cardElement = deleteBtn.closest && deleteBtn.closest('.catalog-item, .product-card');
      await deleteItem(itemType, itemId, cardElement);
    }
  });

  // Обработчики голосования (с безопасными проверками)
  document.addEventListener('click', async (e) => {
    if (!e || !e.target) return;
    
    const likeBtn = e.target.closest && e.target.closest('.product-like-btn, .service-like-btn, .banner-like-btn');
    const dislikeBtn = e.target.closest && e.target.closest('.product-dislike-btn, .service-dislike-btn, .banner-dislike-btn');
    
    if (likeBtn || dislikeBtn) {
      e.preventDefault();
      const ratingBlock = e.target.closest && e.target.closest('.product-rating, .service-rating, .banner-rating, .item-rating');
      if (!ratingBlock || !ratingBlock.dataset) return;
      
      const itemId = ratingBlock.dataset.id;
      if (!itemId) {
        console.error('❌ Отсутствует ID карточки для голосования');
        return;
      }
      const itemType = ratingBlock.dataset.type || 
        (ratingBlock.classList && ratingBlock.classList.contains('product-rating') ? 'product' :
         ratingBlock.classList && ratingBlock.classList.contains('service-rating') ? 'service' : 'banner');
      const vote = likeBtn ? 'up' : 'down';
      
      await voteItem(itemType, itemId, vote, ratingBlock);
    }
  });

  // Обработчики блокировки/публикации (только для админа, с безопасными проверками)
  document.addEventListener('click', async (e) => {
    if (!e || !e.target) return;
    
    const blockBtn = e.target.closest && e.target.closest('.block-product-btn, .block-service-btn, .block-banner-btn');
    const publishBtn = e.target.closest && e.target.closest('.publish-product-btn, .publish-service-btn, .publish-banner-btn');
    
    if (blockBtn || publishBtn) {
      e.preventDefault();
      const btn = blockBtn || publishBtn;
      if (!btn || !btn.classList || !btn.dataset) return;
      
      const itemType = blockBtn ? 
        (blockBtn.classList.contains('block-product-btn') ? 'product' :
         blockBtn.classList.contains('block-service-btn') ? 'service' : 'banner') :
        (publishBtn.classList.contains('publish-product-btn') ? 'product' :
         publishBtn.classList.contains('publish-service-btn') ? 'service' : 'banner');
      const itemId = btn.dataset.id;
      if (!itemId) {
        console.error('❌ Отсутствует ID карточки для блокировки/публикации');
        return;
      }
      await toggleBlock(itemType, itemId, btn);
    }
  });

  // Обработчики редактирования (с безопасными проверками)
  document.addEventListener('click', (e) => {
    if (!e || !e.target) return;
    
    const editBtn = e.target.closest && e.target.closest('.edit-product-btn, .edit-service-btn, .edit-banner-btn');
    if (editBtn && editBtn.classList && editBtn.dataset) {
      e.preventDefault();
      const itemType = editBtn.classList.contains('edit-product-btn') ? 'product' 
        : editBtn.classList.contains('edit-service-btn') ? 'service' 
        : 'banner';
      const itemId = editBtn.dataset.id;
      if (!itemId) {
        console.error('❌ Отсутствует ID карточки для редактирования');
        return;
      }
      editItem(itemType, itemId);
    }
  });
});
