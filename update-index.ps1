# PowerShell скрипт для обновления index.ejs
# Используем корректный синтаксис PowerShell вместо bash-оператора &&

# 1. Копируем резервный файл
Write-Host "Копирование резервного файла..."
Copy-Item -Path "views/index.ejs.backup" -Destination "views/index.ejs" -Force

# 2. Добавляем HTML-разметку футера для мобильных вкладок
Write-Host "Добавление мобильного футера..."

# HTML-разметка для мобильного футера
$mobileFooter = @"
  <!-- Footer с вкладками для мобильных устройств -->
  <footer class="mobile-tabs-footer">
    <div class="mobile-tabs-container">
      <a href="/products" class="mobile-tab-button <%= typeof activeTab !== 'undefined' && activeTab === 'products' ? 'active' : '' %>">
        <span class="tab-icon">🛒</span>
        <span>Товары</span>
      </a>
      <a href="/services" class="mobile-tab-button <%= typeof activeTab !== 'undefined' && activeTab === 'services' ? 'active' : '' %>">
        <span class="tab-icon">🔧</span>
        <span>Услуги</span>
      </a>
      <a href="/ad" class="mobile-tab-button <%= typeof activeTab !== 'undefined' && activeTab === 'ad' ? 'active' : '' %>">
        <span class="tab-icon">📢</span>
        <span>Реклама</span>
      </a>
      <a href="/about" class="mobile-tab-button <%= typeof activeTab !== 'undefined' && activeTab === 'about' ? 'active' : '' %>">
        <span class="tab-icon">📖</span>
        <span>О Нас</span>
      </a>
      <a href="/contacts" class="mobile-tab-button <%= typeof activeTab !== 'undefined' && activeTab === 'contacts' ? 'active' : '' %>">
        <span class="tab-icon">📞</span>
        <span>Контакты</span>
      </a>
    </div>
  </footer>
"@

# Добавляем разметку в конец файла
$mobileFooter | Out-File -FilePath "views/index.ejs" -Append -Encoding utf8

Write-Host "Обновление завершено успешно!"
Write-Host "Файл views/index.ejs обновлен с мобильным футером."
