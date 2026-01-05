# План унификации обработки видео в карточках товаров и услуг

## Текущая проблема
- В карточках товаров видео с неизвестным типом (не YouTube, VK, Instagram) открываются в новой вкладке
- В карточках услуг видео воспроизводятся в overlay на странице
- Требуется унифицировать поведение: все видео должны открываться в overlay

## Анализ текущей реализации
В файле `public/script.js` в обработчике клика по видео-кнопке (строки 1134-1257) есть следующая логика:

```javascript
} else {
  // Неизвестный тип - открываем в новой вкладке
  console.warn('⚠️ Неизвестный тип видео, открываем в новой вкладке:', videoType);
  window.open(videoUrl, '_blank');
}
```

## Решение
Изменить логику для неизвестных типов видео, чтобы они тоже открывались в overlay с универсальным iframe, а не в новой вкладке.

## Конкретные изменения
В файле `public/script.js`, в обработчике клика по видео-кнопке (строки 1249-1253), заменить текущую логику:

```javascript
} else {
  // Неизвестный тип - открываем в новой вкладке
  console.warn('⚠️ Неизвестный тип видео, открываем в новой вкладке:', videoType);
  window.open(videoUrl, '_blank');
}
```

на:

```javascript
} else {
  // Неизвестный тип - открываем в overlay с универсальным iframe
  console.log('▶️ Открытие неизвестного типа видео в overlay:', videoUrl);
  
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
  
  // Создаем универсальный iframe для неизвестных типов видео
  const iframe = document.createElement('iframe');
 iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
  iframe.setAttribute('allowfullscreen', '');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.display = 'block';
  iframe.src = videoUrl;
  
  iframe.onerror = function() {
    console.error('❌ Ошибка загрузки универсального iframe');
    window.open(videoUrl, '_blank');
    closeVideoOverlay();
  };
  
  iframe.onload = function() {
    console.log('✅ Универсальный iframe загружен');
  };
  
  videoIframeContainer.appendChild(iframe);
  currentVideoIframe = iframe;
}
```

## Результат
После изменений все видео в карточках товаров и услуг будут открываться в overlay на странице, а не переходить по внешней ссылке.