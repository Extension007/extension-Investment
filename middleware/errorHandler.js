module.exports = (err, req, res, next) => {
  // Единый обработчик ошибок приложения
  // В проде можно скрывать детали, в деве — логировать подробнее
  // Здесь возвращаем унифицированный ответ для API и HTML
  // Определяем, ожидает ли клиент JSON
  const wantsJson =
    req.xhr ||
    req.get("accept")?.includes("application/json") ||
    req.originalUrl.startsWith("/api/");

  // Логируем
  console.error("Global error:", err);

  if (wantsJson) {
    return res
      .status(err.status || 500)
      .json({ error: "Server error", details: err.message });
  }

  // Для HTML страниц — простой ответ
  res
    .status(err.status || 500)
    .send("Внутренняя ошибка сервера");
};


