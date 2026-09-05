'use strict';

function loc(en, ru, kk, zh) {
  return { en, ru, kk, zh };
}

function city(code, en, ru, kk, zh) {
  return { code, value: en, name: loc(en, ru, kk, zh) };
}

function region(code, en, ru, kk, zh, cities) {
  return { code, value: en, name: loc(en, ru, kk, zh), cities };
}

function country(code, en, ru, kk, zh, regions) {
  return { code, value: en, name: loc(en, ru, kk, zh), regions };
}

const LOCATIONS = [
  country("KZ", "Kazakhstan", "Казахстан", "Қазақстан", "哈萨克斯坦", [
    region("AST", "Astana", "Астана", "Астана", "阿斯塔纳", [
      city("AST", "Astana", "Астана", "Астана", "阿斯塔纳"),
      city("KOS", "Kosshy", "Косшы", "Қосшы", "科斯希"),
      city("STE", "Stepnogorsk", "Степногорск", "Степногорск", "斯捷普诺戈尔斯克")
    ]),
    region("ALA", "Almaty Region", "Алматинская область", "Алматы облысы", "阿拉木图州", [
      city("ALA", "Almaty", "Алматы", "Алматы", "阿拉木图"),
      city("KON", "Konaev", "Конаев", "Қонаев", "科纳耶夫"),
      city("ESI", "Esik", "Есик", "Есік", "叶西克"),
      city("TAL", "Talgar", "Талгар", "Талғар", "塔尔加尔"),
      city("KAS", "Kaskelen", "Каскелен", "Қаскелең", "卡斯克连"),
      city("USH", "Ushkonyr", "Ушконыр", "Үшқоңыр", "乌什科内尔")
    ]),
    region("SHY", "Shymkent", "Шымкент", "Шымкент", "奇姆肯特", [
      city("SHY", "Shymkent", "Шымкент", "Шымкент", "奇姆肯特"),
      city("ARY", "Arys", "Арысь", "Арыс", "阿雷斯"),
      city("LEN", "Lenger", "Ленгер", "Леңгір", "连格尔")
    ]),
    region("KAR", "Karaganda Region", "Карагандинская область", "Қарағанды облысы", "卡拉干达州", [
      city("KAR", "Karaganda", "Караганда", "Қарағанды", "卡拉干达"),
      city("TEM", "Temirtau", "Темиртау", "Теміртау", "捷米尔套"),
      city("BAL", "Balkhash", "Балхаш", "Балқаш", "巴尔喀什"),
      city("SAT", "Satpayev", "Сатпаев", "Сәтбаев", "萨特帕耶夫"),
      city("JEZ", "Zhezkazgan", "Жезказган", "Жезқазған", "热兹卡兹甘"),
      city("SAR", "Saran", "Сарань", "Саран", "萨兰")
    ]),
    region("ATY", "Atyrau Region", "Атырауская область", "Атырау облысы", "阿特劳州", [
      city("ATY", "Atyrau", "Атырау", "Атырау", "阿特劳"),
      city("KUL", "Kulsary", "Кульсары", "Құлсары", "库尔萨雷"),
      city("INY", "Inderbor", "Индербор", "Индербор", "因杰尔博尔"),
      city("MAK", "Makat", "Макат", "Мақат", "马卡特"),
      city("DSS", "Dossor", "Доссор", "Доссор", "多索尔")
    ]),
    region("AKT", "Aktobe Region", "Актюбинская область", "Ақтөбе облысы", "阿克托别州", [
      city("AKT", "Aktobe", "Актобе", "Ақтөбе", "阿克托别"),
      city("HRO", "Khromtau", "Хромтау", "Хромтау", "赫罗姆套"),
      city("KAN", "Kandyagash", "Кандыагаш", "Қандыағаш", "坎德阿加什")
    ]),
    region("MAN", "Mangystau Region", "Мангистауская область", "Маңғыстау облысы", "曼吉斯套州", [
      city("AQT", "Aktau", "Актау", "Ақтау", "阿克套"),
      city("ZHA", "Zhanaozen", "Жанаозен", "Жаңаөзен", "扎纳奥曾"),
      city("FOR", "Fort-Shevchenko", "Форт-Шевченко", "Форт-Шевченко", "舍甫琴科堡")
    ])
  ]),
  country("RU", "Russia", "Россия", "Ресей", "俄罗斯", [
    region("MOW", "Moscow", "Москва", "Мәскеу", "莫斯科", [
      city("MOW", "Moscow", "Москва", "Мәскеу", "莫斯科"),
      city("KHI", "Khimki", "Химки", "Химки", "希姆基"),
      city("POD", "Podolsk", "Подольск", "Подольск", "波多利斯克"),
      city("BAL", "Balashikha", "Балашиха", "Балашиха", "巴拉希哈"),
      city("MYT", "Mytishchi", "Мытищи", "Мытищи", "梅季希")
    ]),
    region("SPE", "Saint Petersburg", "Санкт-Петербург", "Санкт-Петербург", "圣彼得堡", [
      city("SPE", "Saint Petersburg", "Санкт-Петербург", "Санкт-Петербург", "圣彼得堡"),
      city("PUS", "Pushkin", "Пушкин", "Пушкин", "普希金"),
      city("KOL", "Kolpino", "Колпино", "Колпино", "科尔皮诺")
    ]),
    region("KDA", "Krasnodar Krai", "Краснодарский край", "Краснодар өлкесі", "克拉斯诺达尔边疆区", [
      city("KRA", "Krasnodar", "Краснодар", "Краснодар", "克拉斯诺达尔"),
      city("SOC", "Sochi", "Сочи", "Сочи", "索契"),
      city("NOV", "Novorossiysk", "Новороссийск", "Новороссийск", "新罗西斯克"),
      city("ANA", "Anapa", "Анапа", "Анапа", "阿纳帕"),
      city("GEL", "Gelendzhik", "Геленджик", "Геленджик", "格连吉克"),
      city("ARM", "Armavir", "Армавир", "Армавир", "阿尔马维尔")
    ]),
    region("SVE", "Sverdlovsk Region", "Свердловская область", "Свердлов облысы", "斯维尔德洛夫斯克州", [
      city("EKB", "Yekaterinburg", "Екатеринбург", "Екатеринбург", "叶卡捷琳堡"),
      city("NTA", "Nizhny Tagil", "Нижний Тагил", "Нижний Тагил", "下塔吉尔"),
      city("KAM", "Kamensk-Uralsky", "Каменск-Уральский", "Каменск-Уральский", "卡缅斯克-乌拉尔斯基")
    ]),
    region("TAT", "Tatarstan", "Республика Татарстан", "Татарстан Республикасы", "鞑靼斯坦共和国", [
      city("KZN", "Kazan", "Казань", "Қазан", "喀山"),
      city("NCH", "Naberezhnye Chelny", "Набережные Челны", "Набережные Челны", "纳别列日内切尔内"),
      city("NIZ", "Nizhnekamsk", "Нижнекамск", "Нижнекамск", "下卡姆斯克")
    ])
  ]),
  country("CN", "China", "Китай", "Қытай", "中国", [
    region("BJ", "Beijing", "Пекин", "Бейжің", "北京", [
      city("BJ", "Beijing", "Пекин", "Бейжің", "北京"),
      city("CYA", "Chaoyang", "Чаоян", "Чаоян", "朝阳"),
      city("HDN", "Haidian", "Хайдянь", "Хайдянь", "海淀")
    ]),
    region("SH", "Shanghai", "Шанхай", "Шанхай", "上海", [
      city("SH", "Shanghai", "Шанхай", "Шанхай", "上海"),
      city("PUD", "Pudong", "Пудун", "Пудун", "浦东"),
      city("MIN", "Minhang", "Миньхан", "Миньхан", "闵行")
    ]),
    region("GD", "Guangdong", "Гуандун", "Гуандун", "广东", [
      city("GZ", "Guangzhou", "Гуанчжоу", "Гуанчжоу", "广州"),
      city("SZ", "Shenzhen", "Шэньчжэнь", "Шэньчжэнь", "深圳"),
      city("DG", "Dongguan", "Дунгуань", "Дунгуань", "东莞"),
      city("FS", "Foshan", "Фошань", "Фошань", "佛山"),
      city("ZH", "Zhuhai", "Чжухай", "Чжухай", "珠海"),
      city("ZS", "Zhongshan", "Чжуншань", "Чжуншань", "中山")
    ]),
    region("ZJ", "Zhejiang", "Чжэцзян", "Чжэцзян", "浙江", [
      city("HZ", "Hangzhou", "Ханчжоу", "Ханчжоу", "杭州"),
      city("NB", "Ningbo", "Нинбо", "Нинбо", "宁波"),
      city("WZ", "Wenzhou", "Вэньчжоу", "Вэньчжоу", "温州"),
      city("JX", "Jiaxing", "Цзясин", "Цзясин", "嘉兴"),
      city("SX", "Shaoxing", "Шаосин", "Шаосин", "绍兴")
    ]),
    region("SC", "Sichuan", "Сычуань", "Сычуань", "四川", [
      city("CD", "Chengdu", "Чэнду", "Чэнду", "成都"),
      city("MY", "Mianyang", "Мяньян", "Мяньян", "绵阳"),
      city("DZ", "Dazhou", "Дачжоу", "Дачжоу", "达州")
    ])
  ]),
  country("UZ", "Uzbekistan", "Узбекистан", "Өзбекстан", "乌兹别克斯坦", [
    region("TKT", "Tashkent", "Ташкент", "Ташкент", "塔什干", [
      city("TKT", "Tashkent", "Ташкент", "Ташкент", "塔什干"),
      city("CHI", "Chirchiq", "Чирчик", "Chirchiq", "奇尔奇克"),
      city("ANG", "Angren", "Ангрен", "Ангрен", "安格连"),
      city("BEK", "Bekabad", "Бекабад", "Бекабад", "别卡巴德"),
      city("YAN", "Yangiyul", "Янгиюль", "Янгиюль", "扬吉尤尔")
    ]),
    region("SAM", "Samarkand Region", "Самаркандская область", "Самарқанд облысы", "撒马尔罕州", [
      city("SAM", "Samarkand", "Самарканд", "Самарқанд", "撒马尔罕"),
      city("KAT", "Kattakurgan", "Каттакурган", "Каттакурган", "卡塔库尔干"),
      city("URG", "Urgut", "Ургут", "Ұргут", "乌尔古特")
    ]),
    region("BUX", "Bukhara Region", "Бухарская область", "Бұхара облысы", "布哈拉州", [
      city("BUX", "Bukhara", "Бухара", "Бұхара", "布哈拉"),
      city("GIZ", "Gijduvan", "Гиждуван", "Ғиждуван", "吉日杜万"),
      city("KAG", "Kagan", "Каган", "Каған", "卡甘")
    ]),
    region("AND", "Andijan Region", "Андижанская область", "Андижан облысы", "安集延州", [
      city("AND", "Andijan", "Андижан", "Андижан", "安集延"),
      city("ASA", "Asaka", "Асака", "Асака", "阿萨卡"),
      city("SHA", "Shahrixon", "Шахрихан", "Шахрихон", "沙赫里汗")
    ])
  ]),
  country("KG", "Kyrgyzstan", "Кыргызстан", "Қырғызстан", "吉尔吉斯斯坦", [
    region("BIS", "Bishkek", "Бишкек", "Бішкек", "比什凯克", [
      city("BIS", "Bishkek", "Бишкек", "Бішкек", "比什凯克"),
      city("KAN", "Kant", "Кант", "Қант", "坎特"),
      city("TOK", "Tokmok", "Токмок", "Тоқмок", "托克马克"),
      city("KAR", "Kara-Balta", "Кара-Балта", "Қара-Балта", "卡拉巴尔塔"),
      city("SHOP", "Shopokov", "Шопоков", "Шопоков", "绍波科夫")
    ]),
    region("OSH", "Osh Region", "Ошская область", "Ош облысы", "奥什州", [
      city("OSH", "Osh", "Ош", "Ош", "奥什"),
      city("KYZ", "Kyzyl-Kiya", "Кызыл-Кия", "Қызыл-Кия", "克孜勒基亚"),
      city("UZG", "Uzgen", "Узген", "Өзгөн", "乌兹根")
    ]),
    region("ISS", "Issyk-Kul Region", "Иссык-Кульская область", "Ыстықкөл облысы", "伊塞克湖州", [
      city("KAR", "Karakol", "Каракол", "Қарақол", "卡拉科尔"),
      city("BAL", "Balykchy", "Балыкчы", "Балықчы", "巴雷克奇"),
      city("CHL", "Cholpon-Ata", "Чолпон-Ата", "Шолпан-Ата", "乔尔蓬阿塔")
    ]),
    region("JAL", "Jalal-Abad Region", "Джалал-Абадская область", "Жалал-Абад облысы", "贾拉拉巴德州", [
      city("JAL", "Jalal-Abad", "Джалал-Абад", "Жалал-Абад", "贾拉拉巴德"),
      city("KER", "Kerben", "Кербен", "Кербен", "凯尔本"),
      city("TAS", "Tash-Kumyr", "Таш-Кумыр", "Таш-Көмүр", "塔什库梅尔")
    ])
  ]),
  country("TR", "Turkey", "Турция", "Түркия", "土耳其", [
    region("IST", "Istanbul", "Стамбул", "Ыстанбұл", "伊斯坦布尔", [
      city("IST", "Istanbul", "Стамбул", "Ыстанбұл", "伊斯坦布尔"),
      city("BEY", "Beylikduzu", "Бейликдюзю", "Бейликдюзю", "贝伊利克杜聚"),
      city("KAD", "Kadikoy", "Кадыкёй", "Кадыкөй", "卡德柯伊"),
      city("BAK", "Bakirkoy", "Бакыркёй", "Бакыркөй", "巴克尔柯伊"),
      city("UMR", "Umraniye", "Умрание", "Үмрание", "于姆拉尼耶")
    ]),
    region("ANK", "Ankara", "Анкара", "Анкара", "安卡拉", [
      city("ANK", "Ankara", "Анкара", "Анкара", "安卡拉"),
      city("KEC", "Kecioren", "Кечиорен", "Кечиөрен", "凯奇奥伦"),
      city("SNC", "Sincan", "Синджан", "Синджан", "辛詹")
    ]),
    region("IZM", "Izmir", "Измир", "Измир", "伊兹密尔", [
      city("IZM", "Izmir", "Измир", "Измир", "伊兹密尔"),
      city("ALI", "Aliaga", "Алиага", "Алиага", "阿利亚阿"),
      city("TOR", "Torbali", "Торбалы", "Торбалы", "托尔巴勒")
    ]),
    region("ANT", "Antalya", "Анталья", "Анталия", "安塔利亚", [
      city("ANT", "Antalya", "Анталья", "Анталия", "安塔利亚"),
      city("ALA", "Alanya", "Аланья", "Аланья", "阿拉尼亚"),
      city("MAN", "Manavgat", "Манавгат", "Манавгат", "马纳夫加特")
    ])
  ]),
  country("AE", "United Arab Emirates", "ОАЭ", "БАӘ", "阿联酋", [
    region("DXB", "Dubai", "Дубай", "Дубай", "迪拜", [
      city("DXB", "Dubai", "Дубай", "Дубай", "迪拜"),
      city("JBR", "Jumeirah", "Джумейра", "Джумейра", "朱美拉"),
      city("MRC", "Dubai Marina", "Дубай Марина", "Дубай Марина", "迪拜码头"),
      city("DEI", "Deira", "Дейра", "Дейра", "德伊勒"),
      city("BRD", "Bur Dubai", "Бур-Дубай", "Бур-Дубай", "柏迪拜")
    ]),
    region("AUH", "Abu Dhabi", "Абу-Даби", "Әбу-Даби", "阿布扎比", [
      city("AUH", "Abu Dhabi", "Абу-Даби", "Әбу-Даби", "阿布扎比"),
      city("AIN", "Al Ain", "Эль-Айн", "Әл-Айн", "艾因"),
      city("RUW", "Ruwais", "Рувайс", "Рувайс", "鲁韦斯")
    ]),
    region("SHJ", "Sharjah", "Шарджа", "Шарджа", "沙迦", [
      city("SHJ", "Sharjah", "Шарджа", "Шарджа", "沙迦"),
      city("KHF", "Khor Fakkan", "Хор-Факкан", "Хор-Факкан", "豪尔费坎"),
      city("DIB", "Dibba Al-Hisn", "Дибба-эль-Хисн", "Дибба-әл-Хисн", "迪巴阿尔希斯恩")
    ])
  ]),
  country("DE", "Germany", "Германия", "Германия", "德国", [
    region("BER", "Berlin", "Берлин", "Берлин", "柏林", [
      city("BER", "Berlin", "Берлин", "Берлин", "柏林"),
      city("POT", "Potsdam", "Потсдам", "Потсдам", "波茨坦"),
      city("ORA", "Oranienburg", "Ораниенбург", "Ораниенбург", "奥拉宁堡")
    ]),
    region("BAY", "Bavaria", "Бавария", "Бавария", "巴伐利亚", [
      city("MUC", "Munich", "Мюнхен", "Мюнхен", "慕尼黑"),
      city("NUR", "Nuremberg", "Нюрнберг", "Нюрнберг", "纽伦堡"),
      city("AUG", "Augsburg", "Аугсбург", "Аугсбург", "奥格斯堡")
    ]),
    region("NRW", "North Rhine-Westphalia", "Северный Рейн-Вестфалия", "Солтүстік Рейн-Вестфалия", "北莱茵-威斯特法伦", [
      city("CGN", "Cologne", "Кёльн", "Кельн", "科隆"),
      city("DUS", "Dusseldorf", "Дюссельдорф", "Дюссельдорф", "杜塞尔多夫"),
      city("DTM", "Dortmund", "Дортмунд", "Дортмунд", "多特蒙德")
    ]),
    region("HAM", "Hamburg", "Гамбург", "Гамбург", "汉堡", [
      city("HAM", "Hamburg", "Гамбург", "Гамбург", "汉堡"),
      city("NDE", "Norderstedt", "Нордерштедт", "Нордерштедт", "诺德施泰特"),
      city("AHR", "Ahrensburg", "Аренсбург", "Аренсбург", "阿伦斯堡")
    ])
  ]),
  country("GB", "United Kingdom", "Великобритания", "Ұлыбритания", "英国", [
    region("ENG", "England", "Англия", "Англия", "英格兰", [
      city("LON", "London", "Лондон", "Лондон", "伦敦"),
      city("MAN", "Manchester", "Манчестер", "Манчестер", "曼彻斯特"),
      city("BIR", "Birmingham", "Бирмингем", "Бирмингем", "伯明翰")
    ]),
    region("SCT", "Scotland", "Шотландия", "Шотландия", "苏格兰", [
      city("EDI", "Edinburgh", "Эдинбург", "Эдинбург", "爱丁堡"),
      city("GLA", "Glasgow", "Глазго", "Глазго", "格拉斯哥"),
      city("ABD", "Aberdeen", "Абердин", "Абердин", "阿伯丁")
    ]),
    region("WLS", "Wales", "Уэльс", "Уэльс", "威尔士", [
      city("CDF", "Cardiff", "Кардифф", "Кардифф", "加的夫"),
      city("SWA", "Swansea", "Суонси", "Суонси", "斯旺西"),
      city("NWP", "Newport", "Ньюпорт", "Ньюпорт", "纽波特")
    ])
  ]),
  country("US", "United States", "США", "АҚШ", "美国", [
    region("CA", "California", "Калифорния", "Калифорния", "加利福尼亚", [
      city("LAX", "Los Angeles", "Лос-Анджелес", "Лос-Анджелес", "洛杉矶"),
      city("SFO", "San Francisco", "Сан-Франциско", "Сан-Франциско", "旧金山"),
      city("SDG", "San Diego", "Сан-Диего", "Сан-Диего", "圣地亚哥"),
      city("SJC", "San Jose", "Сан-Хосе", "Сан-Хосе", "圣何塞"),
      city("SAC", "Sacramento", "Сакраменто", "Сакраменто", "萨克拉门托")
    ]),
    region("NY", "New York", "Нью-Йорк", "Нью-Йорк", "纽约州", [
      city("NYC", "New York City", "Нью-Йорк", "Нью-Йорк", "纽约"),
      city("BUF", "Buffalo", "Баффало", "Баффало", "布法罗"),
      city("ALB", "Albany", "Олбани", "Олбани", "奥尔巴尼")
    ]),
    region("TX", "Texas", "Техас", "Техас", "得克萨斯", [
      city("HOU", "Houston", "Хьюстон", "Хьюстон", "休斯敦"),
      city("DAL", "Dallas", "Даллас", "Даллас", "达拉斯"),
      city("AUS", "Austin", "Остин", "Остин", "奥斯汀")
    ]),
    region("FL", "Florida", "Флорида", "Флорида", "佛罗里达", [
      city("MIA", "Miami", "Майами", "Майами", "迈阿密"),
      city("ORL", "Orlando", "Орландо", "Орландо", "奥兰多"),
      city("TPA", "Tampa", "Тампа", "Тампа", "坦帕")
    ])
  ]),
  country("KR", "South Korea", "Южная Корея", "Оңтүстік Корея", "韩国", [
    region("SEL", "Seoul", "Сеул", "Сеул", "首尔", [
      city("SEL", "Seoul", "Сеул", "Сеул", "首尔"),
      city("GAN", "Gangnam", "Каннам", "Каннам", "江南"),
      city("SNG", "Songpa", "Сонгпа", "Сонгпа", "松坡"),
      city("MAP", "Mapo", "Мапхо", "Мапхо", "麻浦"),
      city("YDP", "Yeongdeungpo", "Ёндынпхо", "Ёндынпхо", "永登浦")
    ]),
    region("BSN", "Busan", "Пусан", "Пусан", "釜山", [
      city("BSN", "Busan", "Пусан", "Пусан", "釜山"),
      city("HAE", "Haeundae", "Хэундэ", "Хэундэ", "海云台"),
      city("SAS", "Sasang", "Сасанг", "Сасанг", "沙上")
    ]),
    region("GGI", "Gyeonggi", "Кёнгидо", "Кёнгидо", "京畿道", [
      city("SUV", "Suwon", "Сувон", "Сувон", "水原"),
      city("GYN", "Goyang", "Коян", "Коян", "高阳"),
      city("YON", "Yongin", "Йонъин", "Йонъин", "龙仁")
    ])
  ]),
  country("JP", "Japan", "Япония", "Жапония", "日本", [
    region("TOK", "Tokyo", "Токио", "Токио", "东京", [
      city("TOK", "Tokyo", "Токио", "Токио", "东京"),
      city("SHB", "Shibuya", "Сибуя", "Сибуя", "涩谷"),
      city("SJN", "Shinjuku", "Синдзюку", "Синдзюку", "新宿"),
      city("GZA", "Ginza", "Гиндза", "Гиндза", "银座"),
      city("AKH", "Akihabara", "Акихабара", "Акихабара", "秋叶原")
    ]),
    region("OSA", "Osaka", "Осака", "Осака", "大阪", [
      city("OSA", "Osaka", "Осака", "Осака", "大阪"),
      city("SAK", "Sakai", "Сакаи", "Сакаи", "堺"),
      city("HIG", "Higashiosaka", "Хигасиосака", "Хигасиосака", "东大阪")
    ]),
    region("KAN", "Kanagawa", "Канагава", "Канагава", "神奈川", [
      city("YOK", "Yokohama", "Йокогама", "Йокогама", "横滨"),
      city("KAW", "Kawasaki", "Кавасаки", "Кавасаки", "川崎"),
      city("SAG", "Sagamihara", "Сагамихара", "Сагамихара", "相模原")
    ])
  ]),
  country("AZ", "Azerbaijan", "Азербайджан", "Әзербайжан", "阿塞拜疆", [
    region("BAK", "Baku", "Баку", "Баку", "巴库", [
      city("BAK", "Baku", "Баку", "Баку", "巴库"),
      city("SUM", "Sumqayit", "Сумгаит", "Сумгаит", "苏姆盖特"),
      city("XIR", "Khirdalan", "Хырдалан", "Хырдалан", "赫尔达兰")
    ]),
    region("GAN", "Ganja", "Гянджа", "Гянджа", "占贾", [
      city("GAN", "Ganja", "Гянджа", "Гянджа", "占贾"),
      city("MIN", "Mingachevir", "Мингечевир", "Мингечевир", "明盖恰乌尔"),
      city("NAF", "Naftalan", "Нафталан", "Нафталан", "纳夫塔兰")
    ]),
    region("LEN", "Lankaran", "Ленкорань", "Ленкорань", "连科兰", [
      city("LEN", "Lankaran", "Ленкорань", "Ленкорань", "连科兰"),
      city("MAS", "Masalli", "Масаллы", "Масаллы", "马萨雷"),
      city("ASTA", "Astara", "Астара", "Астара", "阿斯塔拉")
    ])
  ]),
  country("AM", "Armenia", "Армения", "Армения", "亚美尼亚", [
    region("YRV", "Yerevan", "Ереван", "Ереван", "埃里温", [
      city("YRV", "Yerevan", "Ереван", "Ереван", "埃里温"),
      city("ABV", "Abovyan", "Абовян", "Абовян", "阿博维扬"),
      city("ECH", "Ejmiatsin", "Эчмиадзин", "Эчмиадзин", "埃奇米阿津")
    ]),
    region("GYM", "Shirak", "Ширак", "Ширак", "希拉克", [
      city("GYM", "Gyumri", "Гюмри", "Гюмри", "久姆里"),
      city("ART", "Artik", "Артик", "Артик", "阿尔蒂克"),
      city("MAR", "Maralik", "Маралик", "Маралик", "马拉利克")
    ]),
    region("VAN", "Vanadzor", "Ванадзор", "Ванадзор", "瓦纳佐尔", [
      city("VAN", "Vanadzor", "Ванадзор", "Ванадзор", "瓦纳佐尔"),
      city("ALA", "Alaverdi", "Алаверди", "Алаверди", "阿拉韦尔迪"),
      city("STE2", "Stepanavan", "Степанаван", "Степанаван", "斯捷潘纳万")
    ])
  ]),
  country("GE", "Georgia", "Грузия", "Грузия", "格鲁吉亚", [
    region("TBS", "Tbilisi", "Тбилиси", "Тбилиси", "第比利斯", [
      city("TBS", "Tbilisi", "Тбилиси", "Тбилиси", "第比利斯"),
      city("RST", "Rustavi", "Рустави", "Рустави", "鲁斯塔维"),
      city("MTS", "Mtskheta", "Мцхета", "Мцхета", "姆茨赫塔")
    ]),
    region("BAT", "Adjara", "Аджария", "Аджария", "阿扎尔", [
      city("BAT", "Batumi", "Батуми", "Батуми", "巴统"),
      city("KOB", "Kobuleti", "Кобулети", "Кобулети", "科布列季"),
      city("KHE", "Khelvachauri", "Хелвачаури", "Хелвачаури", "赫尔瓦乔里")
    ]),
    region("KUT", "Imereti", "Имерети", "Имерети", "伊梅列季", [
      city("KUT", "Kutaisi", "Кутаиси", "Кутаиси", "库塔伊西"),
      city("SAMT", "Samtredia", "Самтредиа", "Самтредиа", "萨姆特雷迪亚"),
      city("ZES", "Zestafoni", "Зестафони", "Зестафони", "泽斯塔福尼")
    ])
  ]),
  country("TJ", "Tajikistan", "Таджикистан", "Тәжікстан", "塔吉克斯坦", [
    region("DUS", "Dushanbe", "Душанбе", "Душанбе", "杜尚别", [
      city("DUS", "Dushanbe", "Душанбе", "Душанбе", "杜尚别"),
      city("HIS", "Hisor", "Гиссар", "Гиссар", "希萨尔"),
      city("VHD", "Vahdat", "Вахдат", "Вахдат", "瓦赫达特")
    ]),
    region("SUG", "Sughd", "Согдийская область", "Соғды облысы", "粟特州", [
      city("KHU", "Khujand", "Худжанд", "Худжанд", "苦盏"),
      city("ISF", "Isfara", "Исфара", "Исфара", "伊斯法拉"),
      city("PEN", "Panjakent", "Пенджикент", "Панҷакент", "潘吉肯特")
    ]),
    region("KUL", "Khatlon", "Хатлонская область", "Хатлон облысы", "哈特隆州", [
      city("BOK", "Bokhtar", "Бохтар", "Бохтар", "博赫塔尔"),
      city("KULY", "Kulob", "Куляб", "Күлоб", "库洛布"),
      city("NOR", "Norak", "Нурек", "Норак", "努列克")
    ])
  ]),
  country("BY", "Belarus", "Беларусь", "Беларусь", "白俄罗斯", [
    region("MNS", "Minsk", "Минск", "Минск", "明斯克", [
      city("MNS", "Minsk", "Минск", "Минск", "明斯克"),
      city("BOR", "Barysaw", "Борисов", "Барысаў", "鲍里索夫"),
      city("SLU", "Slutsk", "Слуцк", "Слуцк", "斯卢茨克")
    ]),
    region("BRS", "Brest", "Брестская область", "Брест облысы", "布列斯特州", [
      city("BRE", "Brest", "Брест", "Брест", "布列斯特"),
      city("PIN", "Pinsk", "Пинск", "Пінск", "平斯克"),
      city("BAR", "Baranavichy", "Барановичи", "Баранавічы", "巴拉诺维奇")
    ]),
    region("GRO", "Grodno", "Гродненская область", "Гродно облысы", "格罗德诺州", [
      city("GRD", "Grodno", "Гродно", "Гродно", "格罗德诺"),
      city("LID", "Lida", "Лида", "Ліда", "利达"),
      city("SLN", "Slonim", "Слоним", "Слонім", "斯洛尼姆")
    ])
  ]),
  country("UA", "Ukraine", "Украина", "Украина", "乌克兰", [
    region("KYI", "Kyiv", "Киев", "Киев", "基辅", [
      city("KYI", "Kyiv", "Киев", "Киев", "基辅"),
      city("BRV", "Brovary", "Бровары", "Бровары", "布罗瓦里"),
      city("IRP", "Irpin", "Ирпень", "Ирпень", "伊尔平")
    ]),
    region("ODA", "Odesa", "Одесская область", "Одесса облысы", "敖德萨州", [
      city("ODS", "Odesa", "Одесса", "Одесса", "敖德萨"),
      city("CHR", "Chornomorsk", "Черноморск", "Черноморск", "切尔诺莫尔斯克"),
      city("IZM2", "Izmail", "Измаил", "Измаил", "伊兹梅尔")
    ]),
    region("LVI", "Lviv", "Львовская область", "Львов облысы", "利沃夫州", [
      city("LVI", "Lviv", "Львов", "Львов", "利沃夫"),
      city("DRO", "Drohobych", "Дрогобыч", "Дрогобыч", "德罗霍贝奇"),
      city("STR", "Stryi", "Стрый", "Стрый", "斯特雷")
    ])
  ]),
  country("MD", "Moldova", "Молдова", "Молдова", "摩尔多瓦", [
    region("KIV", "Chisinau", "Кишинёв", "Кишинев", "基希讷乌", [
      city("KIV", "Chisinau", "Кишинёв", "Кишинев", "基希讷乌"),
      city("BAL2", "Balti", "Бельцы", "Бельцы", "伯尔兹"),
      city("ORH", "Orhei", "Оргеев", "Орхей", "奥尔海")
    ]),
    region("COM", "Comrat", "Комрат", "Комрат", "科姆拉特", [
      city("COM", "Comrat", "Комрат", "Комрат", "科姆拉特"),
      city("CAD", "Ceadir-Lunga", "Чадыр-Лунга", "Чадыр-Лунга", "恰德尔伦加"),
      city("VUL", "Vulcanesti", "Вулканешты", "Вулканешты", "武尔克内什蒂")
    ])
  ]),
  country("PL", "Poland", "Польша", "Польша", "波兰", [
    region("MAZ", "Mazovia", "Мазовецкое воеводство", "Мазовия", "马佐夫舍", [
      city("WAR", "Warsaw", "Варшава", "Варшава", "华沙"),
      city("RAD", "Radom", "Радом", "Радом", "拉多姆"),
      city("PLO", "Plock", "Плоцк", "Плоцк", "普沃茨克")
    ]),
    region("MAL", "Lesser Poland", "Малопольское воеводство", "Кіші Польша", "小波兰", [
      city("KRK", "Krakow", "Краков", "Краков", "克拉科夫"),
      city("TAR", "Tarnow", "Тарнув", "Тарнув", "塔尔努夫"),
      city("NOW", "Nowy Sacz", "Новый Сонч", "Новы-Сонч", "新松奇")
    ]),
    region("SIL", "Silesia", "Силезское воеводство", "Силезия", "西里西亚", [
      city("KAT", "Katowice", "Катовице", "Катовице", "卡托维兹"),
      city("GLI", "Gliwice", "Гливице", "Гливице", "格利维采"),
      city("CZS", "Czestochowa", "Ченстохова", "Ченстохова", "琴斯托霍瓦")
    ])
  ]),
  country("CZ", "Czech Republic", "Чехия", "Чехия", "捷克", [
    region("PRG", "Prague", "Прага", "Прага", "布拉格", [
      city("PRG", "Prague", "Прага", "Прага", "布拉格"),
      city("KLA", "Kladno", "Кладно", "Кладно", "克拉德诺"),
      city("MLB", "Mlada Boleslav", "Млада-Болеслав", "Млада-Болеслав", "姆拉达-博莱斯拉夫")
    ]),
    region("BRN", "South Moravia", "Южноморавский край", "Оңтүстік Моравия", "南摩拉维亚", [
      city("BRN", "Brno", "Брно", "Брно", "布尔诺"),
      city("ZNO", "Znojmo", "Зноймо", "Зноймо", "兹诺伊莫"),
      city("HOD", "Hodonin", "Годонин", "Годонин", "霍多宁")
    ]),
    region("OVA", "Moravian-Silesian", "Моравско-Силезский край", "Моравия-Силезия", "摩拉维亚-西里西亚", [
      city("OVA", "Ostrava", "Острава", "Острава", "俄斯特拉发"),
      city("FRM", "Frydek-Mistek", "Фридек-Мистек", "Фридек-Мистек", "弗里代克-米斯泰克"),
      city("KARV", "Karvina", "Карвина", "Карвина", "卡尔维纳")
    ])
  ]),
  country("NL", "Netherlands", "Нидерланды", "Нидерланды", "荷兰", [
    region("NH", "North Holland", "Северная Голландия", "Солтүстік Голландия", "北荷兰", [
      city("AMS", "Amsterdam", "Амстердам", "Амстердам", "阿姆斯特丹"),
      city("HAR", "Haarlem", "Харлем", "Харлем", "哈勒姆"),
      city("ALK", "Alkmaar", "Алкмар", "Алкмар", "阿尔克马尔")
    ]),
    region("ZH", "South Holland", "Южная Голландия", "Оңтүстік Голландия", "南荷兰", [
      city("RTM", "Rotterdam", "Роттердам", "Роттердам", "鹿特丹"),
      city("HAG", "The Hague", "Гаага", "Гаага", "海牙"),
      city("LED", "Leiden", "Лейден", "Лейден", "莱顿")
    ]),
    region("NB", "North Brabant", "Северный Брабант", "Солтүстік Брабант", "北布拉班特", [
      city("EIN", "Eindhoven", "Эйндховен", "Эйндховен", "埃因霍温"),
      city("TIL", "Tilburg", "Тилбург", "Тилбург", "蒂尔堡"),
      city("BRE2", "Breda", "Бреда", "Бреда", "布雷达")
    ])
  ]),
  country("IN", "India", "Индия", "Үндістан", "印度", [
    region("DEL", "Delhi", "Дели", "Дели", "德里", [
      city("DEL", "Delhi", "Дели", "Дели", "德里"),
      city("NOD", "Noida", "Нойда", "Нойда", "诺伊达"),
      city("GUR", "Gurugram", "Гуруграм", "Гуруграм", "古尔冈")
    ]),
    region("MAH", "Maharashtra", "Махараштра", "Махараштра", "马哈拉施特拉邦", [
      city("BOM", "Mumbai", "Мумбаи", "Мумбаи", "孟买"),
      city("PUN", "Pune", "Пуна", "Пуна", "浦那"),
      city("NAG", "Nagpur", "Нагпур", "Нагпур", "那格浦尔")
    ]),
    region("KAR2", "Karnataka", "Карнатака", "Карнатака", "卡纳塔克邦", [
      city("BLR", "Bengaluru", "Бангалор", "Бенгалуру", "班加罗尔"),
      city("MYS", "Mysuru", "Майсур", "Майсуру", "迈索尔"),
      city("HUB", "Hubballi", "Хубли", "Хубли", "胡布利")
    ])
  ]),
  country("TH", "Thailand", "Таиланд", "Таиланд", "泰国", [
    region("BKK", "Bangkok", "Бангкок", "Бангкок", "曼谷", [
      city("BKK", "Bangkok", "Бангкок", "Бангкок", "曼谷"),
      city("NON", "Nonthaburi", "Нонтхабури", "Нонтхабури", "暖武里"),
      city("PKT", "Pak Kret", "Паккрет", "Паккрет", "北革")
    ]),
    region("CHM", "Chiang Mai", "Чиангмай", "Чиангмай", "清迈", [
      city("CHM", "Chiang Mai", "Чиангмай", "Чиангмай", "清迈"),
      city("LAM", "Lamphun", "Лампхун", "Лампхун", "南奔"),
      city("HNG", "Hang Dong", "Хангдонг", "Хангдонг", "杭东")
    ]),
    region("PHK", "Phuket", "Пхукет", "Пхукет", "普吉", [
      city("PHK", "Phuket", "Пхукет", "Пхукет", "普吉"),
      city("PAT", "Patong", "Патонг", "Патонг", "芭东"),
      city("RAW", "Rawai", "Равай", "Равай", "拉威")
    ])
  ]),
  country("VN", "Vietnam", "Вьетнам", "Вьетнам", "越南", [
    region("HAN", "Hanoi", "Ханой", "Ханой", "河内", [
      city("HAN", "Hanoi", "Ханой", "Ханой", "河内"),
      city("HDP", "Hai Duong", "Хайзыонг", "Хайзыонг", "海阳"),
      city("BHN", "Bac Ninh", "Бакнинь", "Бакнинь", "北宁")
    ]),
    region("HCM", "Ho Chi Minh City", "Хошимин", "Хошимин", "胡志明市", [
      city("HCM", "Ho Chi Minh City", "Хошимин", "Хошимин", "胡志明市"),
      city("DAN", "Thu Duc", "Тху Дык", "Тху Дык", "守德"),
      city("BIN", "Bien Hoa", "Бьенхоа", "Бьенхоа", "边和")
    ]),
    region("DNA", "Da Nang", "Дананг", "Дананг", "岘港", [
      city("DNA", "Da Nang", "Дананг", "Дананг", "岘港"),
      city("HUE", "Hue", "Хюэ", "Хюэ", "顺化"),
      city("HOI", "Hoi An", "Хойан", "Хойан", "会安")
    ])
  ]),
  country("MY", "Malaysia", "Малайзия", "Малайзия", "马来西亚", [
    region("KULA", "Kuala Lumpur", "Куала-Лумпур", "Куала-Лумпур", "吉隆坡", [
      city("KULA", "Kuala Lumpur", "Куала-Лумпур", "Куала-Лумпур", "吉隆坡"),
      city("SHAA", "Shah Alam", "Шах-Алам", "Шах-Алам", "莎阿南"),
      city("PETA", "Petaling Jaya", "Петалинг-Джая", "Петалинг-Джая", "八打灵再也")
    ]),
    region("PNG", "Penang", "Пинанг", "Пинанг", "槟城", [
      city("GEO", "George Town", "Джорджтаун", "Джорджтаун", "乔治市"),
      city("BTR", "Butterworth", "Баттеруорт", "Баттеруорт", "北海"),
      city("BKN", "Bukit Mertajam", "Букит-Мертаджам", "Букит-Мертаджам", "大山脚")
    ]),
    region("SBH", "Sabah", "Сабах", "Сабах", "沙巴", [
      city("KK", "Kota Kinabalu", "Кота-Кинабалу", "Кота-Кинабалу", "亚庇"),
      city("SDK", "Sandakan", "Сандакан", "Сандакан", "山打根"),
      city("TWU", "Tawau", "Тавау", "Тавау", "斗湖")
    ])
  ]),
  country("ID", "Indonesia", "Индонезия", "Индонезия", "印度尼西亚", [
    region("JKT", "Jakarta", "Джакарта", "Джакарта", "雅加达", [
      city("JKT", "Jakarta", "Джакарта", "Джакарта", "雅加达"),
      city("BEK", "Bekasi", "Бекаси", "Бекаси", "勿加泗"),
      city("TGR", "Tangerang", "Тангеранг", "Тангеранг", "唐格朗")
    ]),
    region("BALI", "Bali", "Бали", "Бали", "巴厘岛", [
      city("DPS", "Denpasar", "Денпасар", "Денпасар", "登巴萨"),
      city("UBD", "Ubud", "Убуд", "Убуд", "乌布"),
      city("KUTA", "Kuta", "Кута", "Кута", "库塔")
    ]),
    region("JTM", "East Java", "Восточная Ява", "Шығыс Ява", "东爪哇", [
      city("SBY", "Surabaya", "Сурабая", "Сурабая", "泗水"),
      city("MLG", "Malang", "Маланг", "Маланг", "玛琅"),
      city("KDR", "Kediri", "Кедири", "Кедири", "谏义里")
    ])
  ]),
  country("SG", "Singapore", "Сингапур", "Сингапур", "新加坡", [
    region("SGP", "Singapore", "Сингапур", "Сингапур", "新加坡", [
      city("SGP", "Singapore", "Сингапур", "Сингапур", "新加坡"),
      city("TPN", "Tampines", "Тампинс", "Тампинс", "淡滨尼"),
      city("WDL", "Woodlands", "Вудлендс", "Вудлендс", "兀兰")
    ])
  ]),
  country("SA", "Saudi Arabia", "Саудовская Аравия", "Сауд Арабиясы", "沙特阿拉伯", [
    region("RYD", "Riyadh", "Эр-Рияд", "Эр-Рияд", "利雅得", [
      city("RYD", "Riyadh", "Эр-Рияд", "Эр-Рияд", "利雅得"),
      city("KHA", "Al Kharj", "Эль-Хардж", "Әл-Хардж", "海尔季"),
      city("DIR", "Diriyah", "Диръия", "Дирия", "德拉伊耶")
    ]),
    region("MKK", "Makkah", "Мекка", "Мекке", "麦加", [
      city("JED", "Jeddah", "Джидда", "Жидда", "吉达"),
      city("MKK", "Makkah", "Мекка", "Мекке", "麦加"),
      city("TAI", "Taif", "Таиф", "Таиф", "塔伊夫")
    ]),
    region("DMM", "Eastern Province", "Восточная провинция", "Шығыс провинциясы", "东部省", [
      city("DMM", "Dammam", "Даммам", "Даммам", "达曼"),
      city("KHO", "Khobar", "Хобар", "Хобар", "胡拜尔"),
      city("JUB", "Jubail", "Джубайль", "Жубайль", "朱拜勒")
    ])
  ]),
  country("EG", "Egypt", "Египет", "Мысыр", "埃及", [
    region("CAI", "Cairo", "Каир", "Каир", "开罗", [
      city("CAI", "Cairo", "Каир", "Каир", "开罗"),
      city("GIZ", "Giza", "Гиза", "Гиза", "吉萨"),
      city("SHB", "Shubra El Kheima", "Шубра-эль-Хейма", "Шубра-әл-Хейма", "舒卜拉海迈")
    ]),
    region("ALX", "Alexandria", "Александрия", "Александрия", "亚历山大", [
      city("ALX", "Alexandria", "Александрия", "Александрия", "亚历山大"),
      city("BRG", "Borg El Arab", "Борг-эль-Араб", "Борг әл-Араб", "阿拉伯堡"),
      city("DKH", "Dekheila", "Дехейла", "Дехейла", "代赫拉")
    ]),
    region("HRG", "Red Sea", "Красное море", "Қызыл теңіз", "红海省", [
      city("HRG", "Hurghada", "Хургада", "Хургада", "赫尔格达"),
      city("ELS", "El Gouna", "Эль-Гуна", "Әл-Гуна", "艾高纳"),
      city("MSA", "Marsa Alam", "Марса-Алам", "Марса-Алам", "马萨阿拉姆")
    ])
  ]),
  country("AU", "Australia", "Австралия", "Австралия", "澳大利亚", [
    region("NSW", "New South Wales", "Новый Южный Уэльс", "Жаңа Оңтүстік Уэльс", "新南威尔士", [
      city("SYD", "Sydney", "Сидней", "Сидней", "悉尼"),
      city("NCS", "Newcastle", "Ньюкасл", "Ньюкасл", "纽卡斯尔"),
      city("WOL", "Wollongong", "Вуллонгонг", "Вуллонгонг", "卧龙岗")
    ]),
    region("VIC", "Victoria", "Виктория", "Виктория", "维多利亚州", [
      city("MEL", "Melbourne", "Мельбурн", "Мельбурн", "墨尔本"),
      city("GEE", "Geelong", "Джилонг", "Джилонг", "吉朗"),
      city("BAL3", "Ballarat", "Балларат", "Балларат", "巴拉瑞特")
    ]),
    region("QLD", "Queensland", "Квинсленд", "Квинсленд", "昆士兰", [
      city("BNE", "Brisbane", "Брисбен", "Брисбен", "布里斯班"),
      city("GCO", "Gold Coast", "Голд-Кост", "Голд-Кост", "黄金海岸"),
      city("CNS", "Cairns", "Кэрнс", "Кэрнс", "凯恩斯")
    ])
  ]),
  country("OTHER", "Other", "Другая страна", "Басқа ел", "其他国家", [
    region("OTHER", "Other region", "Другой регион", "Басқа өңір", "其他地区", [
      city("OTHER", "Other city", "Другой город", "Басқа қала", "其他城市")
    ])
  ])
];

function normalizeLocale(locale) {
  return ["ru", "en", "kk", "zh"].includes(locale) ? locale : "en";
}

function labelOf(entity, locale) {
  const lng = normalizeLocale(locale);
  return entity.name[lng] || entity.name.en;
}

function countryMatches(country, value) {
  const input = String(value || "").trim();
  return country.code === input || country.value === input || Object.values(country.name).includes(input);
}

function regionMatches(region, value) {
  const input = String(value || "").trim();
  return region.code === input || region.value === input || Object.values(region.name).includes(input);
}

function cityMatches(city, value) {
  const input = String(value || "").trim();
  return city.code === input || city.value === input || Object.values(city.name).includes(input);
}

function mapCountry(country, locale) {
  return { code: country.code, value: country.value, label: labelOf(country, locale) };
}

function mapRegion(region, locale) {
  return { code: region.code, value: region.value, label: labelOf(region, locale) };
}

function mapCity(city, locale) {
  return { code: city.code, value: city.value, label: labelOf(city, locale) };
}

function findCountryByName(name) {
  if (!name) return null;
  return LOCATIONS.find((item) => countryMatches(item, name)) || null;
}

function findRegion(countryValue, regionValue) {
  const foundCountry = findCountryByName(countryValue);
  if (!foundCountry) return null;
  return foundCountry.regions.find((item) => regionMatches(item, regionValue)) || null;
}

function findCityRecord(countryValue, cityValue, regionValue) {
  const foundCountry = findCountryByName(countryValue);
  if (!foundCountry) return null;
  const regions = regionValue
    ? foundCountry.regions.filter((item) => regionMatches(item, regionValue))
    : foundCountry.regions;

  for (const item of regions) {
    const foundCity = item.cities.find((city) => cityMatches(city, cityValue));
    if (foundCity) {
      return { country: foundCountry, region: item, city: foundCity };
    }
  }
  return null;
}

function findCity(countryValue, regionValue, cityValue) {
  return findCityRecord(countryValue, cityValue, regionValue)?.city || null;
}

function resolveLocation(countryValue, cityValue, regionValue) {
  const record = findCityRecord(countryValue, cityValue, regionValue);
  if (!record) return null;
  return {
    country: record.country.value,
    region: record.region.value,
    city: record.city.value
  };
}

function getCountries(locale = "en") {
  return LOCATIONS.map((item) => mapCountry(item, locale));
}

function getRegions(countryValue, locale = "en") {
  const foundCountry = findCountryByName(countryValue);
  if (!foundCountry) return [];
  return foundCountry.regions.map((item) => mapRegion(item, locale));
}

function getCities(countryValue, regionValue, locale = "en") {
  const foundCountry = findCountryByName(countryValue);
  if (!foundCountry) return [];
  const regions = regionValue
    ? foundCountry.regions.filter((item) => regionMatches(item, regionValue))
    : foundCountry.regions;
  const seen = new Set();
  const cities = [];
  for (const item of regions) {
    for (const city of item.cities) {
      if (seen.has(city.value)) continue;
      seen.add(city.value);
      cities.push(mapCity(city, locale));
    }
  }
  return cities.sort((a, b) => a.label.localeCompare(b.label));
}

function formatLocation(location, locale = "en") {
  const country = findCountryByName(location.country);
  const region = findRegion(location.country, location.region);
  const city = findCity(location.country, location.region, location.city);
  const parts = [city && labelOf(city, locale), country && labelOf(country, locale)]
    .filter(Boolean);
  return parts.join(", ");
}

function isValidLocation(countryValue, regionValue, cityValue) {
  return Boolean(findCityRecord(countryValue, cityValue, regionValue));
}

module.exports = {
  LOCATIONS,
  getCountries,
  getRegions,
  getCities,
  findCountryByName,
  resolveLocation,
  formatLocation,
  isValidLocation
};
