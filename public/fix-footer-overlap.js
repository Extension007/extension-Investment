// JavaScript-решение для предотвращения перекрытия контента футером
document.addEventListener('DOMContentLoaded', function() {
    // Функция для обновления высоты дополнительного пространства
    function updateFooterSpacing() {
        const footer = document.querySelector('.mobile-tabs-footer');
        const additionalSpace = document.querySelector('.footer-spacing');
        
        if (footer && additionalSpace) {
            const footerHeight = footer.offsetHeight;
            // Устанавливаем высоту дополнительного пространства равной высоте футера
            additionalSpace.style.height = footerHeight + 20 + 'px'; // +20px для дополнительного отступа
        }
    }

    // Добавляем элемент для дополнительного пространства в конец body
    const additionalSpace = document.createElement('div');
    additionalSpace.className = 'footer-spacing';
    additionalSpace.style.display = 'block';
    document.body.appendChild(additionalSpace);

    // Обновляем размер при загрузке страницы
    updateFooterSpacing();

    // Обновляем размер при изменении размеров окна
    window.addEventListener('resize', updateFooterSpacing);

    // Также вызываем обновление при полной загрузке страницы (на случай, если контент загружается асинхронно)
    window.addEventListener('load', updateFooterSpacing);
});