// =======================
// Вспомогательные функции
// =======================

// Функция для получения пути к элементу (для отладки)
function getElementPath(element) {
  if (!element) return '';
  const path = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();
    if (element.id) {
      selector += '#' + element.id;
      path.unshift(selector);
      break;
    } else {
      let sibling = element;
      let nth = 1;
      while (sibling = sibling.previousElementSibling) {
        if (sibling.nodeName.toLowerCase() === selector) nth++;
      }
      if (nth !== 1) selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    element = element.parentElement;
  }
  return path.join(' > ');
}


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

// Инициализация DOM элементов (сразу при загрузке скрипта)
let videoOverlay = document.getElementById('videoOverlay');
let videoIframeContainer = document.getElementById('videoIframeContainer');
let imageOverlay = document.getElementById('imageOverlay');
let imageModal = document.getElementById('imageModal');
let imageModalImage = document.getElementById('imageModalImage');
let imageModalCurrent = document.getElementById('imageModalCurrent');
let imageModalTotal = document.getElementById('imageModalTotal');
let imageModalTitle = document.getElementById('imageModalTitle');

document.addEventListener("DOMContentLoaded", () => {
  console.log('🔄 DOM загружен, инициализация скрипта...');
  console.log('🌐 Текущий URL:', window.location.href);
  console.log('📊 User Agent:', navigator.userAgent);
  console.log('📱 Viewport:', `${window.innerWidth}x${window.innerHeight}`);

  // Проверяем, находимся ли мы на странице кабинета пользователя
  const isCabinetPage = window.IS_CABINET_PAGE === true;
  console.log('📍 isCabinetPage:', isCabinetPage);

  // Если это страница кабинета, пропускаем инициализацию публичных функций
  if (isCabinetPage) {
    console.log('ℹ️ Инициализация кабинета пользователя - пропускаем публичные функции');
    return;
  }

  console.log('✅ Инициализация публичных функций...');

  // Элементы DOM для видео overlay (инициализируем в начале)
  let videoOverlay = document.getElementById('videoOverlay');
  let videoIframeContainer = document.getElementById('videoIframeContainer');
  let imageOverlay = document.getElementById('imageOverlay');
  let imageModal = document.getElementById('imageModal');
  let imageModalImage = document.getElementById('imageModalImage');
  let imageModalCurrent = document.getElementById('imageModalCurrent');
  let imageModalTotal = document.getElementById('imageModalTotal');
  let imageModalTitle = document.getElementById('imageModalTitle');

  // Глобальные переменные
  let productId;
  let currentVideoIframe = null;
  let currentVideoUrl = null;
  let isVideoOpening = false;
  let youtubePlayer = null;
  let isPlaying = false;
  let isPaused = false;
  let currentImageIndex = 0;
  let currentImages = [];
  let currentProductName = '';
  let socket = null;
  let currentChatCardId = null;
  let socketInitialized = false;

  // Подсчитываем карточки товаров и услуг отдельно
  const productCards = document.querySelectorAll('#catalog .product-card');
  const serviceCards = document.querySelectorAll('#services .product-card');
  const allCards = document.querySelectorAll('.product-card');

  console.log('📊 Количество карточек товаров:', productCards.length);
  console.log('📊 Количество карточек услуг:', serviceCards.length);
  console.log('📊 Всего карточек (.product-card):', allCards.length);
  console.log('📊 Сравнение с DOM:', {
    'Товары в #catalog .product-card': productCards.length,
    'Услуги в #services .product-card': serviceCards.length,
    'Все .product-card': allCards.length,
    'Проверка: товары + услуги = все': (productCards.length + serviceCards.length) === allCards.length
  });

  // Проверяем наличие элементов страницы услуг
  const servicesSection = document.getElementById('services');
  const servicesGrid = document.getElementById('services-grid');
  console.log('🔍 Элементы страницы услуг:', {
    servicesSection: !!servicesSection,
    servicesGrid: !!servicesGrid,
    serviceCardsOnPage: serviceCards.length
  });

  // Проверяем каждую карточку услуги отдельно
  serviceCards.forEach((card, index) => {
    const cardId = card.getAttribute('data-product-id');
    const ratingBlock = card.querySelector('.service-rating');
    const chatBtn = card.querySelector('.chat-btn');
    const videoBtn = card.querySelector('.btn[data-video]');

    console.log(`📋 Карточка услуги ${index + 1} (ID: ${cardId}):`, {
      ratingBlock: !!ratingBlock,
      chatBtn: !!chatBtn,
      videoBtn: !!videoBtn,
      chatBtnData: chatBtn ? chatBtn.getAttribute('data-card-id') : null,
      videoBtnData: videoBtn ? videoBtn.getAttribute('data-video') : null
    });
  });

  // Проверяем каждую карточку товара отдельно
  productCards.forEach((card, index) => {
    const cardId = card.getAttribute('data-product-id');
    const ratingBlock = card.querySelector('.product-rating');
    const chatBtn = card.querySelector('.chat-btn');
    const videoBtn = card.querySelector('.btn[data-video]');

    console.log(`📋 Карточка товара ${index + 1} (ID: ${cardId}):`, {
      ratingBlock: !!ratingBlock,
      chatBtn: !!chatBtn,
      videoBtn: !!videoBtn,
      chatBtnData: chatBtn ? chatBtn.getAttribute('data-card-id') : null,
      videoBtnData: videoBtn ? videoBtn.getAttribute('data-video') : null
    });
  });
  
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
                // FIX: Добавляем проверку, чтобы избежать бесконечной рекурсии при создании плеера
                if (!window.youtubePlayerRetry) {
                  window.youtubePlayerRetry = 0;
                }
                if (window.youtubePlayerRetry < 3 && videoId && videoIframeContainer) {
                  window.youtubePlayerRetry++;
                  setTimeout(() => {
                    if (videoId && videoIframeContainer) {
                      createYouTubeIframe(videoId);
                    }
                  }, 2000);
                } else {
                  console.error('❌ Превышено количество попыток воспроизведения YouTube видео');
                  if (currentVideoUrl) {
                    window.open(currentVideoUrl, '_blank');
                  }
                  closeVideoOverlay();
                }
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
      
      // Обработка разных типов видео
      if (videoType === 'vk') {
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
  console.log('🎯 Регистрация основного обработчика кликов');
  document.addEventListener('click', (e) => {
    // Фильтруем клики по основным интерактивным элементам для избежания лишних обработок
    if (!e.target.closest('a, button, .product-card, .service-rating, .chat-btn, .btn[data-video], [data-close-chat-modal], .chat-close-btn, .chat-send-btn, .image-clickable, [data-close-image], [data-image-nav], .chat-edit-btn, .chat-delete-btn, .banner-clickable, .banner-link-icon, .product-info-icon, [data-description-modal], [data-close-description], .slider-arrow, .slider-indicator, .product-image-slide')) {
      return;
    }

    console.log('🖱️ Общий обработчик клика сработал, target:', e.target.className, e.target.tagName, 'id:', e.target.id);
    console.log('🖱️ Полный путь к элементу:', getElementPath(e.target));

    // FIX: Открытие видео по клику на кнопку "Обзор" - создаём плеер строго внутри клика пользователя
    const videoBtn = e.target.closest('.btn[data-video]');
    if (videoBtn) {
      // Определяем тип карточки
      const cardElement = videoBtn.closest('.product-card');
      let cardType = 'неизвестный';
      if (cardElement) {
        if (cardElement.closest('#catalog')) {
          cardType = 'товар';
        } else if (cardElement.closest('#services')) {
          cardType = 'услуга';
        }
      }
      console.log('🎬 Найдена кнопка видео в карточке', cardType + ':', videoBtn, 'data-video:', videoBtn.getAttribute('data-video'));
      console.log('🎬 Обработка кнопки видео...');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // Останавливаем дальнейшее распространение события

      const videoUrl = videoBtn.getAttribute('data-video');
      if (videoUrl) {
        console.log('🎬 Клик на кнопку видео, URL:', videoUrl);
        
        // FIX: Определяем тип видео для правильной обработки
        const videoType = getVideoType(videoUrl);
        
        // Обработка всех типов видео в overlay
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
        } else if (videoType === 'vk') {
          // VK видео обрабатываем через overlay
          if (!videoOverlay || !videoIframeContainer) {
            console.error('❌ Video overlay elements not found, opening in new tab');
            window.open(videoUrl, '_blank');
            return false;
          }

          const vkParams = extractVKVideoParams(videoUrl);
          if (!vkParams) {
            console.warn('⚠️ Не удалось извлечь параметры VK из URL:', videoUrl);
            window.open(videoUrl, '_blank');
            return false;
          }

          const embedUrl = buildVKEmbedUrl(vkParams);
          console.log('▶️ Открытие VK видео в overlay:', embedUrl);

          // Показываем overlay
          videoOverlay.classList.add('show');
          videoOverlay.setAttribute('aria-hidden', 'false');
          videoOverlay.style.display = 'flex';
          document.body.style.overflow = 'hidden';

          currentVideoUrl = videoUrl;
          createVkIframe(embedUrl);
        } else if (videoType === 'instagram') {
          // Instagram видео обрабатываем через overlay
          console.log('▶️ Открытие Instagram видео в overlay:', videoUrl);
          openVideoOverlay(videoUrl).catch(err => {
            console.error('❌ Ошибка при открытии Instagram видео:', err);
            window.open(videoUrl, '_blank');
          });
        } else {
          // Неизвестный тип - показываем пользователю сообщение в overlay с предложением открыть в новой вкладке
          console.log('⚠️ Неизвестный тип видео, показываем сообщение пользователю:', videoUrl);
          
          // Показываем overlay
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
          
          // Создаем сообщение пользователю
          const messageDiv = document.createElement('div');
          messageDiv.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            width: 100%;
            text-align: center;
            padding: 20px;
            color: white;
            font-family: Arial, sans-serif;
          `;
          
          messageDiv.innerHTML = `
            <h3 style="margin-bottom: 20px;">Неизвестный тип видео</h3>
            <p style="margin-bottom: 20px; max-width: 80%;">Видео не может быть воспроизведено в режиме предварительного просмотра из-за ограничений безопасности.</p>
            <button id="openVideoBtn" class="btn" style="background: #ff4081; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-top: 10px;">
              Открыть видео в новой вкладке
            </button>
          `;
          
          videoIframeContainer.appendChild(messageDiv);
          
          // Добавляем обработчик для кнопки открытия видео
          const openVideoBtn = document.getElementById('openVideoBtn');
          if (openVideoBtn) {
            openVideoBtn.addEventListener('click', function(e) {
              e.stopPropagation();
              window.open(videoUrl, '_blank');
              closeVideoOverlay();
            });
          }
        }
      } else {
        console.warn('⚠️ Кнопка видео не содержит data-video атрибут');
      }
      return false; // Дополнительная защита от всплытия
    }
    
    // Обработчик для закрытия чата по клику на overlay
    const closeChatOverlay = e.target.closest('[data-close-chat-modal]');
    if (closeChatOverlay) {
      e.preventDefault();
      e.stopPropagation();
      const cardId = closeChatOverlay.getAttribute('data-close-chat-modal');
      if (cardId) {
        console.log('💬 Закрытие чата по клику на overlay для карточки:', cardId);
        window.closeChatModal(cardId);
      }
      return false;
    }
    
    // Обработчик для закрытия чата по клику на кнопку закрытия
    const closeChatBtn = e.target.closest('.chat-close-btn');
    if (closeChatBtn) {
      e.preventDefault();
      e.stopPropagation();
      const cardId = closeChatBtn.getAttribute('data-close-chat-modal');
      if (cardId) {
        console.log('💬 Закрытие чата по клику на кнопку для карточки:', cardId);
        window.closeChatModal(cardId);
      }
      return false;
    }
    
    // Обработчик для отправки сообщения чата
    const sendChatBtn = e.target.closest('.chat-send-btn');
    if (sendChatBtn) {
      e.preventDefault();
      e.stopPropagation();
      const cardId = sendChatBtn.getAttribute('data-send-chat-message');
      if (cardId) {
        console.log('💬 Отправка сообщения чата для карточки:', cardId);
        window.sendChatMessage(cardId);
      }
      return false;
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

    // FIX: Обработчик клика на кнопку чата
    const chatBtn = e.target.closest('.chat-btn');
    if (chatBtn) {
      console.log('💬 Найдена кнопка чата:', chatBtn, 'data-card-id:', chatBtn.dataset.cardId);
      e.preventDefault();
      const cardId = chatBtn.dataset.cardId;
      if (cardId) {
        console.log('💬 Открываем чат для карточки:', cardId);
        openChatModal(cardId);
      } else {
        console.warn('⚠️ Кнопка чата не содержит data-card-id');
      }
      return;
    }
    
    // Обработчик кнопки редактирования комментария
    const editBtn = e.target.closest('.chat-edit-btn');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      const commentId = editBtn.getAttribute('data-edit-comment');
      const commentText = editBtn.getAttribute('data-comment-text');
      if (commentId) {
        console.log('✏️ Редактирование комментария:', commentId);
        editComment(commentId, commentText);
      }
      return;
    }
    
    // Обработчик кнопки удаления комментария
    const deleteBtn = e.target.closest('.chat-delete-btn');
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const commentId = deleteBtn.getAttribute('data-delete-comment');
      if (commentId) {
        console.log('🗑️ Удаление комментария:', commentId);
        deleteComment(commentId);
      }
      return;
    }
  });

  // FIX: Поддержка клавиатурной навигации в overlay изображений
  document.addEventListener('keydown', (e) => {
    if (imageOverlay && imageOverlay.classList && imageOverlay.classList.contains('show')) return;
    
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

      // Получаем данные формы, исключая CSRF токен в Vercel
      let formData = Object.fromEntries(new FormData(registerForm).entries());

      // В Vercel удаляем CSRF поле из данных формы
      if (isVercel && formData._csrf) {
        delete formData._csrf;
      }

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

        // Проверяем тип контента ответа
        const contentType = res.headers.get("content-type");
        let data;

        if (contentType && contentType.includes("application/json")) {
          // Если ответ в формате JSON, парсим как JSON
          data = await res.json();
        } else {
          // Если ответ не JSON (например, HTML ошибка), парсим как текст
          const text = await res.text();
          data = { success: false, message: text || "Ошибка сервера" };
        }

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
    const likeBtn = e.target.closest(".like-btn, .product-like-btn, .service-like-btn, .banner-like-btn");
    const dislikeBtn = e.target.closest(".dislike-btn, .product-dislike-btn, .service-dislike-btn, .banner-dislike-btn");

    if (likeBtn || dislikeBtn) {
      // Используем более широкий селектор для поддержки разных типов карточек (товары, услуги, баннеры)
      const ratingBlock = e.target.closest(".product-rating, .service-rating, .banner-rating, .item-rating");
      if (!ratingBlock) return;
      
      // FIX: убрано повторное объявление productId - используем присвоение
      productId = ratingBlock.dataset.id;
      
      // Определяем тип карточки
      let itemType = 'product'; // по умолчанию
      if (ratingBlock.classList.contains('service-rating')) {
        itemType = 'service';
      } else if (ratingBlock.classList.contains('banner-rating')) {
        itemType = 'banner';
      } else if (ratingBlock.dataset.type) {
        itemType = ratingBlock.dataset.type;
      }
      
      // Проверяем, голосовал ли уже (через cookie для гостей или data-атрибут для пользователей)
      if (ratingBlock.dataset.voted === "true") {
        return;
      }
      
      // Для гостей также проверяем cookie
      if (!window.IS_AUTH) {
        const voteCookie = document.cookie.split(';').some(cookie => cookie.trim().startsWith(`exto_${itemType}_vote_${productId}=`));
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
        
        // Используем правильный эндпоинт в зависимости от типа карточки
        let endpoint;
        if (itemType === 'service') {
          endpoint = `/api/services/${productId}/vote`;
        } else {
          endpoint = `/api/rating/${productId}`;
        }
        
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken || ''
          },
          body: JSON.stringify({ vote, type: itemType }), // Передаем тип карточки в запросе
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
          const remainingCards = document.querySelectorAll('.catalog-item, .product-card, .service-card');
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
    } else if (itemType === 'service') {
      // Для услуг используем специальный эндпоинт
      endpoint = `/api/services/${itemId}/vote`;
    } else {
      // Для баннеров используем тот же эндпоинт, что и для товаров
      endpoint = `/api/rating/${itemId}`;
    }
    body = JSON.stringify({ vote, type: itemType }); // Включаем тип карточки в запрос для всех типов

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
      const resultEl = ratingBlock.querySelector(`.${itemType}-result`) || ratingBlock.querySelector('.rating-result') || ratingBlock.querySelector('.result');
      const votesEl = ratingBlock.querySelector(`.${itemType}-votes`) || ratingBlock.querySelector('.rating-votes') || ratingBlock.querySelector('.votes');

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

  // ======= Чат комментариев =======

  // Инициализация Socket.IO
  let socket = null;
  let currentChatCardId = null;

  let socketInitialized = false; // Флаг для отслеживания инициализации сокета

  function initializeSocket() {
    if (socketInitialized && socket) return socket;

    // Проверяем, доступна ли библиотека Socket.IO
    if (typeof io === 'undefined') {
      console.warn('⚠️ Socket.IO библиотека не загружена');
      return null;
    }

    socket = io({
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('💬 Подключен к чату');
      socketInitialized = true;
    });

    socket.on('disconnect', () => {
      console.log('💬 Отключен от чата');
      socketInitialized = false;
    });

    socket.on('comment:new', (data) => {
      try {
        if (data && data.cardId === currentChatCardId) {
          addCommentToChat(data);
        }
      } catch (error) {
        console.error('❌ Ошибка при добавлении нового комментария:', error);
      }
    });

    socket.on('error', (error) => {
      console.error('❌ Ошибка чата:', typeof error === 'object' && error ? JSON.stringify(error) : error);
      // Проверяем, что функция showToast существует перед вызовом
      if (typeof showToast === 'function') {
        showToast('Ошибка подключения к чату', 'error');
      } else {
        console.warn('⚠️ Функция showToast не найдена');
      }
    });

    // Обработчик успешного присоединения к чату
    socket.on('joined-comment-chat', (data) => {
      try {
        if (data && data.success) {
          console.log('✅ Успешно присоединился к чату карточки:', data.cardId);
        } else {
          console.warn('⚠️ Неудачное присоединение к чату:', data);
        }
      } catch (error) {
        console.error('❌ Ошибка при обработке присоединения к чату:', error);
      }
    });

    // Обработчик уведомления о новом пользователе в чате
    socket.on('user-joined-chat', (data) => {
      try {
        console.log('👤 Новый пользователь в чате:', data.username);
      } catch (error) {
        console.error('❌ Ошибка при обработке уведомления о новом пользователе:', error);
      }
    });

    // Обработчик уведомления о выходе пользователя из чата
    socket.on('user-left-chat', (data) => {
      try {
        console.log('👤 Пользователь покинул чат:', data.socketId);
      } catch (error) {
        console.error('❌ Ошибка при обработке уведомления о выходе пользователя:', error);
      }
    });

    // Обработчик обновления комментария
    socket.on('comment:updated', (data) => {
      try {
        if (data && data._id) {
          // Находим комментарий в DOM и обновляем его текст
          const commentElement = document.querySelector(`[data-comment-id="${data._id}"]`);
          if (commentElement) {
            const textElement = commentElement.querySelector('.chat-message-text');
            if (textElement && data.text) {
              textElement.textContent = data.text;
              // Добавляем визуальный индикатор обновления
              commentElement.style.backgroundColor = '#e8f5e8';
              setTimeout(() => {
                commentElement.style.backgroundColor = '';
              }, 500);
            }
          }
        }
      } catch (error) {
        console.error('❌ Ошибка при обработке обновления комментария:', error);
      }
    });

    // Обработчик удаления комментария
    socket.on('comment:deleted', (data) => {
      try {
        if (data && data._id) {
          // Находим комментарий в DOM и удаляем его
          const commentElement = document.querySelector(`[data-comment-id="${data._id}"]`);
          if (commentElement) {
            // Плавное удаление
            commentElement.style.opacity = '0';
            commentElement.style.transform = 'translateX(-100%)';
            commentElement.style.transition = 'opacity 0.3s, transform 0.3s';
            
            setTimeout(() => {
              if (commentElement && commentElement.parentNode) {
                commentElement.parentNode.removeChild(commentElement);
              }
            }, 300);
          }
        }
      } catch (error) {
        console.error('❌ Ошибка при обработке удаления комментария:', error);
      }
    });

    return socket;
  }

  // Открытие модального окна чата
  async function openChatModal(cardId) {
    try {
      // Проверяем роль пользователя
      const userRole = window.USER_ROLE;
      const isGuest = !userRole; // Гость - это пользователь без роли

      // Все пользователи (включая гостей) могут открывать чат для чтения
      currentChatCardId = cardId;
      const modal = document.getElementById(`chat-modal-${cardId}`);
      if (!modal) {
        console.error('❌ Модальное окно чата не найдено');
        return;
      }

      // Инициализируем сокет
      socket = initializeSocket();

      // Проверяем, что сокет был инициализирован
      if (!socket) {
        console.error('❌ Socket.IO недоступен на этом сервере');
        showToast('Чат временно недоступен на этом сервере', 'error');
        return;
      }

      // Присоединяемся к комнате, если сокет доступен
      try {
        socket.emit('join-comment-chat', { cardId });
      } catch (error) {
        console.warn('⚠️ Ошибка при присоединении к комнате чата:', error);
      }

      // Загружаем историю комментариев
      await loadChatMessages(cardId);

      // Показываем модальное окно
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      // Настраиваем интерфейс в зависимости от роли пользователя
      const inputContainer = modal.querySelector('.chat-input-container');
      const sendBtn = modal.querySelector('.chat-send-btn');

      if (isGuest) {
        // Гости могут только читать комментарии
        if (inputContainer) inputContainer.style.display = 'none';

        // Добавляем информационное сообщение для гостей
        const messagesContainer = document.getElementById(`chat-messages-${cardId}`);
        if (messagesContainer && !messagesContainer.querySelector('.guest-info')) {
          const guestInfo = document.createElement('div');
          guestInfo.className = 'guest-info';
          guestInfo.style.cssText = `
            text-align: center;
            color: #888;
            font-style: italic;
            padding: 15px;
            border-bottom: 1px solid rgba(255, 51, 51, 0.2);
            background: rgba(255, 51, 51, 0.05);
            margin-bottom: 10px;
          `;
          guestInfo.textContent = 'Вы можете читать комментарии. Для отправки сообщений необходимо войти в систему.';
          messagesContainer.insertBefore(guestInfo, messagesContainer.firstChild);
        }
      } else {
        // Авторизованные пользователи могут отправлять сообщения
        if (inputContainer) inputContainer.style.display = 'flex';
        if (sendBtn) sendBtn.disabled = false;

        // Фокус на поле ввода
        const input = document.getElementById(`chat-input-${cardId}`);
        if (input) {
          setTimeout(() => {
            if (input && input.focus) {
              input.focus();
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('❌ Ошибка при открытии модального окна чата:', error);
      showToast('Ошибка открытия чата', 'error');
    }
  }

  // Открытие модалки авторизации для гостей
  function openAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.style.display = 'block';
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  // Закрытие модалки авторизации
  function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  // Закрытие модального окна чата
  window.closeChatModal = function(cardId) {
    try {
      console.log('💬 Закрытие чата с ID:', cardId);
      const modal = document.getElementById(`chat-modal-${cardId}`);
      if (!modal) {
        console.error('❌ Модальное окно не найдено для ID:', cardId);
        return;
      }

      // Отсоединяемся от комнаты, если сокет доступен
      if (socket && currentChatCardId) {
        try {
          socket.emit('leave-comment-chat', { cardId: currentChatCardId });
        } catch (error) {
          console.warn('⚠️ Ошибка при отсоединении от комнаты чата:', error);
        }
        currentChatCardId = null;
      }

      // Скрываем модальное окно
      modal.style.display = 'none';
      document.body.style.overflow = '';

      // Очищаем сообщения
      const messagesContainer = document.getElementById(`chat-messages-${cardId}`);
      if (messagesContainer) {
        messagesContainer.innerHTML = '';
      }

      console.log('✅ Чат успешно закрыт');
    } catch (error) {
      console.error('❌ Ошибка при закрытии модального окна чата:', error);
      // Попробуем восстановить состояние
      document.body.style.overflow = '';
    }
  }

  // Дополнительный обработчик для закрытия чата
  function addChatCloseHandlers() {
    // Обработчик клика на кнопку закрытия
    document.addEventListener('click', function(e) {
      if (e.target.closest('.chat-close-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const button = e.target.closest('.chat-close-btn');
        const cardId = button.getAttribute('data-close-chat-modal');
        if (cardId) {
          console.log('💬 Клик на кнопку закрытия чата:', cardId);
          window.closeChatModal(cardId);
        }
      }
    });

    // Обработчик клика на фон модального окна
    document.addEventListener('click', function(e) {
      if (e.target.closest('.chat-modal-overlay')) {
        e.preventDefault();
        e.stopPropagation();
        const overlay = e.target.closest('.chat-modal-overlay');
        const cardId = overlay.getAttribute('data-close-chat-modal');
        if (cardId) {
          console.log('💬 Клик на фон чата:', cardId);
          window.closeChatModal(cardId);
        }
      }
    });
  }

  // Загрузка истории комментариев
  async function loadChatMessages(cardId) {
    try {
      const messagesContainer = document.getElementById(`chat-messages-${cardId}`);
      if (!messagesContainer) return;

      const response = await fetch(`/api/comments/${cardId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ошибка! Статус: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.success) {
        messagesContainer.innerHTML = '';

        if (data.comments && data.comments.length === 0) {
          messagesContainer.innerHTML = '<div class="no-comments">Комментариев пока нет. Будьте первым!</div>';
          return;
        }

        if (data.comments && Array.isArray(data.comments)) {
          data.comments.forEach(comment => {
            addCommentToChat(comment, false); // false - не скроллить автоматически
          });
        }

        // Скролл к последнему сообщению
        setTimeout(() => {
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }, 100);
      } else {
        messagesContainer.innerHTML = '<div class="error">Ошибка загрузки комментариев</div>';
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки комментариев:', error);
      const messagesContainer = document.getElementById(`chat-messages-${cardId}`);
      if (messagesContainer) {
        messagesContainer.innerHTML = '<div class="error">Ошибка сети</div>';
      }
    }
  }

  // Добавление комментария в чат
  function addCommentToChat(comment, autoScroll = true) {
    try {
      if (!currentChatCardId) return;

      const messagesContainer = document.getElementById(`chat-messages-${currentChatCardId}`);
      if (!messagesContainer) return;

      // Проверяем, что комментарий содержит необходимые поля
      if (!comment || !comment._id || !comment.text) {
        console.warn('⚠️ Некорректный комментарий:', comment);
        return;
      }

      const commentElement = document.createElement('div');
      commentElement.className = 'chat-message';
      commentElement.setAttribute('data-comment-id', comment._id);

      let adminButtons = '';
      if (window.IS_ADMIN && comment._id) {
        adminButtons = `
          <button class="chat-edit-btn" data-edit-comment="${comment._id}" data-comment-text="${escapeHtml(comment.text || '')}">✏️</button>
          <button class="chat-delete-btn" data-delete-comment="${comment._id}">🗑️</button>
        `;
      }

      commentElement.innerHTML = `
        <div class="chat-message-header">
          <strong>${comment.username || 'Пользователь'}</strong>
          <span class="chat-message-time">${new Date(comment.createdAt || Date.now()).toLocaleString()}</span>
          <div class="chat-admin-actions">${adminButtons}</div>
        </div>
        <div class="chat-message-text">${escapeHtml(comment.text || '')}</div>
      `;

      messagesContainer.appendChild(commentElement);

      if (autoScroll) {
        setTimeout(() => {
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }, 100);
      }
    } catch (error) {
      console.error('❌ Ошибка при добавлении комментария в чат:', error);
    }
  }

  // Экранирование HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Отправка сообщения - глобально доступная функция
  window.sendChatMessage = async function(cardId) {
    try {
      console.log('💬 Попытка отправки сообщения в чат карточки:', cardId);
      console.log('🔍 USER_ROLE:', window.USER_ROLE);
      console.log('🔍 IS_AUTH:', window.IS_AUTH);
      console.log('🔍 IS_ADMIN:', window.IS_ADMIN);

      // Проверяем, что пользователь авторизован
      const userRole = window.USER_ROLE;
      if (!userRole) {
        console.log('❌ Пользователь не авторизован (userRole: null)');
        showToast('Для отправки сообщений необходимо войти в систему', 'error');
        return;
      }

      console.log('✅ Пользователь авторизован с ролью:', userRole);

      const input = document.getElementById(`chat-input-${cardId}`);
      if (!input) {
        console.error('❌ Поле ввода не найдено для ID:', cardId);
        return;
      }

      const text = input.value.trim();
      console.log('📝 Текст сообщения:', text);

      if (!text) {
        console.log('⚠️ Текст сообщения пустой');
        return;
      }

      // Проверяем длину сообщения
      if (text.length > 1000) {
        console.log('⚠️ Сообщение слишком длинное:', text.length);
        showToast('Сообщение слишком длинное (максимум 1000 символов)', 'error');
        return;
      }

      // Отключаем кнопку
      const sendBtn = document.querySelector(`#chat-modal-${cardId} .chat-send-btn`);
      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Отправка...';
      }

      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      console.log('🔑 CSRF токен найден:', !!csrfToken);

      if (!csrfToken) {
        console.warn('⚠️ CSRF токен не найден - возможны проблемы с авторизацией');
      }

      // Проверяем, доступен ли сокет
      if (!socket) {
        console.warn('⚠️ Socket.IO недоступен, сообщение будет отправлено без сокета');
      }

      console.log('🚀 Отправка POST запроса на /api/comments/' + cardId);
      // Определяем endpoint в зависимости от типа карточки
      const commentEndpoint = `/api/comments/${cardId}`;
      const response = await fetch(commentEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ text }),
        credentials: 'same-origin'
      });

      console.log('📡 Ответ сервера:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP ошибка:', response.status, errorText);
        throw new Error(`HTTP ошибка! Статус: ${response.status}`);
      }

      const data = await response.json();
      console.log('📋 Данные ответа:', data);

      if (data.success) {
        console.log('✅ Комментарий успешно отправлен');
        input.value = '';
        // Сообщение будет добавлено через Socket.IO
      } else {
        console.error('❌ Сервер вернул ошибку:', data.message);
        showToast('Ошибка: ' + (data.message || 'Не удалось отправить сообщение'), 'error');
      }
    } catch (error) {
      console.error('❌ Ошибка отправки сообщения:', error);
      showToast('Ошибка сети при отправке сообщения', 'error');
    } finally {
      // Включаем кнопку обратно
      const sendBtn = document.querySelector(`#chat-modal-${cardId} .chat-send-btn`);
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Отправить';
      }
    }
  }

  // Обработчики клавиш в поле ввода чата
  document.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('chat-input')) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const cardId = e.target.id.replace('chat-input-', '');
        sendChatMessage(cardId);
      }
    }
  });

  // Редактирование комментария (только для админа)
  async function editComment(commentId, currentText) {
    const newText = prompt('Редактировать комментарий:', currentText);
    if (newText === null || newText.trim() === currentText) return;

    const trimmedText = newText.trim();
    if (!trimmedText) {
      showToast('Текст комментария не может быть пустым', 'error');
      return;
    }

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({ text: trimmedText }),
        credentials: 'same-origin'
      });

      const data = await response.json();

      if (data.success) {
        showToast('Комментарий обновлен', 'success');
        // Обновление будет выполнено через сокет событие 'comment:updated'
      } else {
        showToast('Ошибка: ' + (data.message || 'Не удалось обновить комментарий'), 'error');
      }
    } catch (error) {
      console.error('❌ Ошибка редактирования комментария:', error);
      showToast('Ошибка сети при редактировании комментария', 'error');
    }
  }

  // Удаление комментария (только для админа)
  async function deleteComment(commentId) {
    if (!confirm('Вы уверены, что хотите удалить этот комментарий?')) return;

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfToken || ''
        },
        credentials: 'same-origin'
      });

      const data = await response.json();

      if (data.success) {
        showToast('Комментарий удален', 'success');
        // Удаление будет выполнено через сокет событие 'comment:deleted'
      } else {
        showToast('Ошибка: ' + (data.message || 'Не удалось удалить комментарий'), 'error');
      }
    } catch (error) {
      console.error('❌ Ошибка удаления комментария:', error);
      showToast('Ошибка сети при удалении комментария', 'error');
    }
  }

  // Закрытие модалки авторизации
  document.addEventListener('click', (e) => {
    // Закрытие модалки авторизации
    if (e.target.closest('[data-close-auth]')) {
      e.preventDefault();
      e.stopPropagation();
      closeAuthModal();
      return;
    }

    // Закрытие по клику на фон модалки авторизации
    const authModal = document.getElementById('authModal');
    if (authModal && e.target === authModal) {
      closeAuthModal();
      return;
    }
  });

  // Обработчик клавиш для модалки авторизации
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const authModal = document.getElementById('authModal');
      if (authModal && authModal.style.display === 'block') {
        closeAuthModal();
      }
    }
  });

// Инициализируем обработчики закрытия чата
// addChatCloseHandlers(); // Закомментировано, так как дублируется в основном обработчике событий

// Обработчики вкладок для навигации по разделам
document.addEventListener('DOMContentLoaded', () => {
  // Обработчики desktop вкладок (header)
  const desktopTabButtons = document.querySelectorAll('.header-tabs .tab-button');
  
  if (desktopTabButtons.length > 0) {
    desktopTabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Удаляем активный класс у всех кнопок
        desktopTabButtons.forEach(btn => btn.classList.remove('active'));
        
        // Добавляем активный класс к нажатой кнопке
        button.classList.add('active');
        
        // Получаем href для перехода
        const href = button.getAttribute('href');
        if (href) {
          window.location.href = href;
        }
      });
    });
  }
  
  // Обработчики mobile вкладок (footer)
  const mobileTabButtons = document.querySelectorAll('.mobile-tab-button');
  
  if (mobileTabButtons.length > 0) {
    mobileTabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Удаляем активный класс у всех кнопок
        mobileTabButtons.forEach(btn => btn.classList.remove('active'));
        
        // Добавляем активный класс к нажатой кнопке
        button.classList.add('active');
        
        // Получаем href для перехода
        const href = button.getAttribute('href');
        if (href) {
          window.location.href = href;
        }
      });
    });
  }
  
  // Обработчики для переключения вкладок с контентом
  const contentTabButtons = document.querySelectorAll('.js-tab-switcher');
  
  if (contentTabButtons.length > 0) {
    contentTabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Удаляем активный класс у всех кнопок
        contentTabButtons.forEach(btn => btn.classList.remove('active'));
        
        // Добавляем активный класс к нажатой кнопке
        button.classList.add('active');
        
        // Получаем ID вкладки
        const tabId = button.getAttribute('data-tab');
        
        // Выполняем действия в зависимости от выбранной вкладки
        switch(tabId) {
          case 'overview':
            showOverviewTab();
            break;
          case 'settings':
            showSettingsTab();
            break;
          case 'comments':
            showCommentsTab();
            break;
        }
      });
    });
  }
  
  // Инициализация содержимого вкладок
  function initializeTabContent() {
    // При загрузке страницы показываем вкладку "Обзор" по умолчанию
    showOverviewTab();
  }
  
  // Функции отображения содержимого вкладок
  function showOverviewTab() {
    // Показываем секции каталога товаров и услуг
    document.querySelectorAll('.section').forEach(section => {
      if (section.id === 'catalog' || section.id === 'services') {
        section.style.display = 'block';
      } else if (section.id === 'ad' || section.id === 'about' || section.id === 'contacts') {
        // Показываем также рекламу, о проекте и контакты
        section.style.display = 'block';
      } else {
        // Скрываем другие секции
        section.style.display = 'none';
      }
    });
    
    // Скрываем контент специальных вкладок, если он существует
    const settingsSection = document.getElementById('settings-content');
    const commentsSection = document.getElementById('comments-content');
    if (settingsSection) settingsSection.style.display = 'none';
    if (commentsSection) commentsSection.style.display = 'none';
  }
  
 function showSettingsTab() {
    // Скрываем все стандартные секции
    document.querySelectorAll('.section').forEach(section => {
      if (section.id !== 'settings-content') {
        section.style.display = 'none';
      }
    });
    
    // Создаем и показываем контент для вкладки "Настройки"
    createSettingsContent();
 }
  
  function showCommentsTab() {
    // Скрываем все стандартные секции
    document.querySelectorAll('.section').forEach(section => {
      if (section.id !== 'comments-content') {
        section.style.display = 'none';
      }
    });
    
    // Создаем и показываем контент для вкладки "Комментарии"
    createCommentsContent();
  }
  
  // Функция создания контента для вкладки "Настройки"
  function createSettingsContent() {
    // Создаем элемент с контентом настроек
    let settingsSection = document.getElementById('settings-content');
    if (!settingsSection) {
      settingsSection = document.createElement('section');
      settingsSection.id = 'settings-content';
      settingsSection.className = 'section';
      settingsSection.innerHTML = `
        <h2>Настройки</h2>
        <div class="settings-container">
          <div class="form-section">
            <h3>Персональные настройки</h3>
            <div class="form-grid">
              <div>
                <label for="theme-select">Тема оформления</label>
                <select id="theme-select" class="theme-select">
                  <option value="dark">Темная (по умолчанию)</option>
                  <option value="light">Светлая</option>
                  <option value="auto">Автоматическая</option>
                </select>
              </div>
              <div>
                <label for="lang-select">Язык интерфейса</label>
                <select id="lang-select" class="lang-select">
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="kz">Қазақша</option>
                </select>
              </div>
            </div>
          <div class="form-section">
            <h3>Уведомления</h3>
            <div class="form-grid">
              <div class="checkbox-group">
                <input type="checkbox" id="email-notifications" checked>
                <label for="email-notifications">Email-уведомления</label>
              </div>
              <div class="checkbox-group">
                <input type="checkbox" id="push-notifications">
                <label for="push-notifications">Push-уведомления</label>
              </div>
            </div>
          </div>
        </div>
      `;
      document.querySelector('main').appendChild(settingsSection);
    }
    
    // Показываем секцию настроек
    settingsSection.style.display = 'block';
  }
  
  // Функция создания контента для вкладки "Комментарии"
  function createCommentsContent() {
    // Создаем элемент с контентом комментариев
    let commentsSection = document.getElementById('comments-content');
    if (!commentsSection) {
      commentsSection = document.createElement('section');
      commentsSection.id = 'comments-content';
      commentsSection.className = 'section';
      commentsSection.innerHTML = `
        <h2>Комментарии</h2>
        <div class="comments-container">
          <div class="comments-filter">
            <div class="form-grid" style="display: flex; gap: 10px; align-items: center;">
              <div style="flex: 1;">
                <select id="comments-filter-type" class="comments-filter-select">
                  <option value="all">Все комментарии</option>
                  <option value="mine">Мои комментарии</option>
                  <option value="recent">Недавние</option>
                </select>
              </div>
              <div>
                <input type="text" id="comments-search" placeholder="Поиск комментариев..." class="comments-search-input">
              </div>
            </div>
          <div class="comments-list">
            <div class="comment-item">
              <div class="comment-header">
                <strong>Пользователь123</strong>
                <span class="comment-date">2023-12-01</span>
              </div>
              <div class="comment-content">
                <p>Отличный товар! Рекомендую к покупке.</p>
                <div class="comment-actions">
                  <button class="btn small outline">Ответить</button>
                  <button class="btn small">Пожаловаться</button>
                </div>
              </div>
            <div class="comment-item">
              <div class="comment-header">
                <strong>Аноним</strong>
                <span class="comment-date">2023-11-28</span>
              </div>
              <div class="comment-content">
                <p>Цена завышена, аналогичный товар дешевле в другом месте.</p>
                <div class="comment-actions">
                  <button class="btn small outline">Ответить</button>
                  <button class="btn small">Пожаловаться</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.querySelector('main').appendChild(commentsSection);
    }
    
    // Показываем секцию комментариев
    commentsSection.style.display = 'block';
  }
  
  // Инициализируем содержимое вкладок при загрузке
  initializeTabContent();
});

// Функция создания контента для вкладки "Настройки"
function createSettingsContent() {
  // Создаем элемент с контентом настроек
  let settingsSection = document.getElementById('settings-content');
  if (!settingsSection) {
    settingsSection = document.createElement('section');
    settingsSection.id = 'settings-content';
    settingsSection.className = 'section';
    settingsSection.innerHTML = `
      <h2>Настройки</h2>
      <div class="settings-container">
        <div class="form-section">
          <h3>Персональные настройки</h3>
          <div class="form-grid">
            <div>
              <label for="theme-select">Тема оформления</label>
              <select id="theme-select" class="theme-select">
                <option value="dark">Темная (по умолчанию)</option>
                <option value="light">Светлая</option>
                <option value="auto">Автоматическая</option>
              </select>
            </div>
            <div>
              <label for="lang-select">Язык интерфейса</label>
              <select id="lang-select" class="lang-select">
                <option value="ru">Русский</option>
                <option value="en">English</option>
                <option value="kz">Қазақша</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-section">
          <h3>Уведомления</h3>
          <div class="form-grid">
            <div class="checkbox-group">
              <input type="checkbox" id="email-notifications" checked>
              <label for="email-notifications">Email-уведомления</label>
            </div>
            <div class="checkbox-group">
              <input type="checkbox" id="push-notifications">
              <label for="push-notifications">Push-уведомления</label>
            </div>
          </div>
        </div>
      </div>
    `;
    document.querySelector('main').appendChild(settingsSection);
  }
  
  // Показываем секцию настроек
  settingsSection.style.display = 'block';
}

// Функция создания контента для вкладки "Комментарии"
function createCommentsContent() {
  // Создаем элемент с контентом комментариев
  let commentsSection = document.getElementById('comments-content');
  if (!commentsSection) {
    commentsSection = document.createElement('section');
    commentsSection.id = 'comments-content';
    commentsSection.className = 'section';
    commentsSection.innerHTML = `
      <h2>Комментарии</h2>
      <div class="comments-container">
        <div class="comments-filter">
          <div class="form-grid" style="display: flex; gap: 10px; align-items: center;">
            <div style="flex: 1;">
              <select id="comments-filter-type" class="comments-filter-select">
                <option value="all">Все комментарии</option>
                <option value="mine">Мои комментарии</option>
                <option value="recent">Недавние</option>
              </select>
            </div>
            <div>
              <input type="text" id="comments-search" placeholder="Поиск комментариев..." class="comments-search-input">
            </div>
          </div>
        </div>
        <div class="comments-list">
          <div class="comment-item">
            <div class="comment-header">
              <strong>Пользователь123</strong>
              <span class="comment-date">2023-12-01</span>
            </div>
            <div class="comment-content">
              <p>Отличный товар! Рекомендую к покупке.</p>
              <div class="comment-actions">
                <button class="btn small outline">Ответить</button>
                <button class="btn small">Пожаловаться</button>
              </div>
            </div>
          </div>
          <div class="comment-item">
            <div class="comment-header">
              <strong>Аноним</strong>
              <span class="comment-date">2023-11-28</span>
            </div>
            <div class="comment-content">
              <p>Цена завышена, аналогичный товар дешевле в другом месте.</p>
              <div class="comment-actions">
                <button class="btn small outline">Ответить</button>
                <button class="btn small">Пожаловаться</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.querySelector('main').appendChild(commentsSection);
  }
  
  // Показываем секцию комментариев
  commentsSection.style.display = 'block';
}
