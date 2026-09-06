# Albamount iOS

Тот же сайт в приложении: https://www.albamount.xyz  
(аналог Android WebView).

## Важно для друзей (без Mac / App Store)

Apple **не позволяет** раздавать IPA-файл так же свободно, как APK на Android.

Рабочий способ прямо сейчас:

1. Откройте на iPhone в **Safari**: https://www.albamount.xyz/app  
2. «Поделиться» → **На экран «Домой»**  
3. На экране появится иконка Albamount — открывается как приложение.

## Нативное приложение (Xcode)

Папка `Albamount.xcodeproj` — оболочка WKWebView.

Нужно:

1. Mac с Xcode  
2. Apple ID (для своего телефона) или Apple Developer Program (TestFlight / App Store)  
3. Открыть `apps/ios/Albamount.xcodeproj`  
4. Указать Team в Signing  
5. Run на iPhone  

После этого можно выложить в TestFlight или App Store и дать отдельную ссылку.
