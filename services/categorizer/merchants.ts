/**
 * Bundled knowledge for category suggestions, used after the user's own
 * history. Written the way people type them; everything is folded with
 * normalize.ts at load time, so "Жито", "Žito" and "Zhito" need only one entry,
 * and only spellings that fold differently are listed separately
 * ("Еврофарм" vs "Eurofarm", "Сетек" vs "Setec").
 *
 * MERCHANTS: store and service names, matched as whole words in the merchant.
 * KEYWORDS:  generic words ("apteka", "kafe"), matched in the merchant and the
 *            note, also as the start of a longer word ("aptekata").
 *
 * North Macedonia first, then the region (Serbia, Croatia, Bosnia and
 * Herzegovina, Montenegro, Kosovo, Albania, Bulgaria, Slovenia) and
 * international services. Every label must be a built-in subcategory id
 * (checked by a test), and no name may point to two subcategories.
 */

export type BuiltInSubcategory =
  | "sub-food"
  | "sub-bills"
  | "sub-health"
  | "sub-transport"
  | "sub-shopping"
  | "sub-restaurants"
  | "sub-subscriptions"
  | "sub-entertainment"
  | "sub-stocks"
  | "sub-crypto"
  | "sub-unexpected";

export const MERCHANTS: Record<BuiltInSubcategory, string[]> = {
  "sub-food": [
    // North Macedonia
    "Vero", "Веро", "Veropoulos", "Vero Centar", "Vero Jumbo", "Kam", "Кам", "Kam Market", "Tinex", "Тинекс",
    "Super Tinex", "Stokomak", "Стокомак", "Ramstore", "Ramstor", "Рамстор", "Ramstore Express", "Zito",
    "Жито", "Zito Market", "Zito Leb", "Kipper", "Кипер", "Elida", "Елида", "Alda", "Алда", "Spar",
    "Шпар", "Kit Go", "Kitgo", "Кит Го", "Super Kit Go", "Reptil", "Рептил", "Tamaro", "Тамаро", "Carrefour",
    "Daniela", "Даниела", "Global Market", "Pepida", "Bimilk", "Makmarket",
    // Region
    "Maxi", "Макси", "Tempo", "Idea", "Идеа", "Roda", "Univerexport", "Aman", "Dis", "Lidl", "Лидл",
    "Kaufland", "Кауфланд", "Billa", "Била", "Fantastico", "Фантастико", "T Market", "CBA", "Konzum",
    "Mercator", "Tus", "Interspar", "Plodine", "Studenac", "Tommy", "Bingo", "Amko", "Voli", "Viva Fresh",
    "Big Market", "Conad", "Euromax", "Eco Market", "Interex", "Hipermarket", "Metro", "Penny",
    "Delhaize", "Gomex",
  ],
  "sub-bills": [
    // North Macedonia
    "EVN", "ЕВН", "EVN Home", "EVN Makedonija", "ESM", "Elektrani na Makedonija", "Vodovod",
    "Водовод", "Vodovod i Kanalizacija", "Komunalna Higiena", "Комунална хигиена", "BEG",
    "Balkan Energy", "Toplifikacija", "Топлификација", "Makedonski Telekom", "Македонски Телеком",
    "Telekom", "Телеком", "A1", "А1", "A1 Makedonija", "One Vip", "Telekabel", "Телекабел",
    "Neotel", "Blizoo", "Lyca", "Makedonska Posta", "Македонска пошта", "Posta", "UJP",
    "Upraviteli", "Eurolink", "Евролинк", "Triglav", "Триглав", "Sava Osiguruvanje", "Uniqa",
    "Grawe", "Halk Osiguruvanje", "Croatia Osiguruvanje", "Makedonija Osiguruvanje",
    "Insurance", "Osiguruvanje",
    // Region
    "EPS", "Elektroprivreda", "Infostan", "Telenor", "Yettel", "MTS", "Vivacom", "Виваком",
    "HEP", "Hrvatski Telekom", "BH Telecom", "M Tel", "Mtel", "OSHEE", "Vodafone", "One Albania",
    "Kesco", "Vala", "IPKO", "Toplana", "Beogas", "Srbijagas", "Bulgargaz", "Electrohold",
  ],
  "sub-health": [
    // North Macedonia
    "Zegin", "Зегин", "Eurofarm", "Еврофарм", "Euro Farm", "Gradski Apteki", "Градски аптеки",
    "Pharmacorp", "Farmakorp", "Alkaloid", "Алкалоид", "Zhiva Farm", "Ziva Farm", "Viva Farm",
    "Re Medika", "Remedika", "Ре Медика", "Acibadem Sistina", "Sistina", "Систина", "Zan Mitrev",
    "Жан Митрев", "Filip Vtori", "Plodnost", "Biotek", "Синлаб", "Synlab", "Ortoped",
    // Region
    "Benu", "Sopharmacy", "Софармаси", "Subra", "Ljekarna", "Apoteka", "Farmacia", "Euromedica",
    "Mediq", "Lilly Apoteka",
  ],
  "sub-transport": [
    // Fuel, North Macedonia
    "Makpetrol", "Макпетрол", "Lukoil", "Лукоил", "OKTA", "ОКТА", "AVIA", "Авиа", "Detoil",
    "Pin Petrol", "Besa Petrol", "Mak Oil", "Makoil", "Arka Petrol", "Veda Petrol", "Dadi",
    "Global Petrol", "Euro Petrol",
    // Fuel, region
    "Petrol", "NIS", "NIS Petrol", "Gazprom", "MOL", "OMV", "Shell", "Eko", "Еко", "Crodux", "INA",
    "Energopetrol", "Hifa", "Kastrati", "Taci Oil", "Rompetrol",
    // Getting around
    "JSP", "ЈСП", "Javno Soobrakajno", "Gradski Parking", "Градски паркинг", "Parking Skopje",
    "AMSM", "АМСМ", "Makedonski Zeleznici", "MZ Transport", "Galeb", "Bolt", "Uber", "Lotus Taxi",
    "Vardar Taxi", "Wizz Air", "Wizzair", "Ryanair", "Pegasus", "Turkish Airlines", "Austrian Airlines",
    "Air Serbia", "Flixbus", "Putevi Srbije", "Patarina", "Rent a Car",
  ],
  "sub-shopping": [
    // Electronics and home, North Macedonia
    "Anhoch", "Анхоч", "Neptun", "Нептун", "Setec", "Сетек", "Tehnomarket", "Техномаркет",
    "Ledikom", "Elipso", "Елипсо", "Alfi", "Mobelix", "Мобеликс", "JYSK", "Јиск", "Ikea",
    "Икеа", "Jumbo", "Џамбо", "Pepco", "Пепко", "Momax", "Lesnina", "Emmezeta", "Bauhaus",
    "Praktiker", "Prima Home", "Ananas", "Pazar3", "Пазар3", "Literatura", "Kultura",
    "Skopje City Mall", "East Gate Mall", "Diamond Mall", "Capitol Mall",
    // Fashion and shoes
    "Zara", "Bershka", "Pull and Bear", "Pull&Bear", "Stradivarius", "Massimo Dutti", "Oysho",
    "Mango", "H&M", "HM", "Reserved", "Sinsay", "Синсеј", "LC Waikiki", "Waikiki", "Koton",
    "DeFacto", "New Yorker", "Terranova", "Calliope", "C&A", "Colins", "Mavi", "Tally Weijl",
    "Calzedonia", "Intimissimi", "Tezenis", "Springfield", "Women Secret", "Tom Tailor", "US Polo",
    "Lacoste", "Guess", "Tommy Hilfiger", "Levis", "Benetton", "Timberland", "Deichmann", "CCC",
    "Bata", "Buzz", "Sport Vision", "Sportvision", "Intersport", "Adidas", "Nike", "Puma", "Skechers",
    "Converse", "Vans", "KiK", "Lindex", "Primark",
    // Cosmetics and drugstores
    "DM", "Дм", "Drogerie Markt", "Lilly", "Douglas", "Sephora", "Kozmo", "Muller",
    // Region electronics and online
    "Gigatron", "Tehnomanija", "Win Win", "Technopolis", "Технополис", "Technomarket", "Zora",
    "Emag", "Sancta Domenica", "iStyle", "Kupujem Prodajem", "Njuskalo", "OLX", "Ananas Rs",
    // International online
    "Temu", "Shein", "AliExpress", "Amazon", "eBay", "Apple Store", "Samsung", "Xiaomi", "Decathlon",
  ],
  "sub-restaurants": [
    // Chains and delivery
    "McDonalds", "Мекдоналдс", "Mekdonalds", "KFC", "КФЦ", "Burger King", "Dominos", "Pizza Hut",
    "Subway", "Starbucks", "Costa Coffee", "Wolt", "Волт", "Korpa", "Корпа", "Glovo", "Глово",
    "Donesi", "Foodpanda", "Takeaway", "Bolt Food", "Uber Eats",
    // Skopje favourites and regional chains
    "Leb i Sol", "Skopski Merak", "Kapan An", "Destan", "Дестан", "Gurman", "Walter", "Zdravo Zivo",
  ],
  "sub-subscriptions": [
    "Netflix", "Нетфликс", "Spotify", "Спотифај", "YouTube Premium", "YouTube", "Google One",
    "Google Play", "Google Storage", "iCloud", "apple.com/bill", "Apple Music", "Apple TV",
    "App Store", "iTunes", "Disney Plus", "Disney", "HBO Max", "HBO", "Max", "Amazon Prime",
    "Prime Video", "Deezer", "Tidal", "Microsoft 365", "Microsoft", "Office 365", "Xbox Game Pass",
    "PlayStation Plus", "PS Plus", "Nintendo Online", "ChatGPT", "OpenAI", "Claude", "Anthropic",
    "Adobe", "Canva", "Dropbox", "Patreon", "Twitch", "Duolingo", "Audible", "Kindle Unlimited",
    "LinkedIn Premium", "Tinder", "Bumble", "Max TV", "MaxTV", "Arena Sport", "Арена Спорт", "EON",
    "Telemach", "SkyShowtime", "Voyo",
  ],
  "sub-entertainment": [
    // Cinema, culture and events
    "Cineplexx", "Синеплекс", "Cinema City", "Kinoteka", "Кинотека", "Milenium", "MOB",
    "Makedonska Opera i Balet", "Filharmonija", "Филхармонија", "Karti Mk", "Eventim", "Entrio",
    "Tickets Mk", "Ticketmaster",
    // Games and betting
    "Steam", "Epic Games", "PlayStation Store", "PlayStation", "Nintendo", "Xbox", "Mozzart",
    "Моцарт", "Sportlife", "Спортлајф", "Admiral", "Адмирал", "Meridian", "Balkan Bet", "Casino",
    "Kazino", "Flamingo", "Princess Casino", "Pinnbet", "MaxBet", "Max Bet", "Octagon",
    // Travel and leisure
    "Booking", "Airbnb", "Hotels", "Expedia", "Trivago", "Fibula", "Fibula Air",
    "Feniks", "Jet Travel", "Mak Travel", "Abba Travel", "Kontiki", "Popova Kula", "Aquapark",
    "Matka", "Bowling",
  ],
  "sub-stocks": [
    "Trading 212", "Trading212", "eToro", "Interactive Brokers", "IBKR", "Degiro", "XTB",
    "Revolut Trading", "Makedonska Berza", "MSE", "KB Publikum", "Publikum", "Ilirika",
    "WVP", "Generali Investments", "Inovo Status", "Sava Penziski", "KB Prvo", "Triglav Penziski",
  ],
  "sub-crypto": [
    "Binance", "Бинанс", "Coinbase", "Kraken", "Bybit", "OKX", "Crypto Com", "Bitstamp", "Bitpanda",
    "KuCoin", "Ledger", "Trezor",
  ],
  "sub-unexpected": ["Vulkanizer", "Вулканизер", "Avto Servis", "Auto Servis", "Bosch Car Service"],
};

export const KEYWORDS: Record<BuiltInSubcategory, string[]> = {
  "sub-food": [
    "market", "marketi", "supermarket", "hipermarket", "minimarket", "prodavnica", "дуќан", "dukan",
    "pekara", "pekarnica", "фурна", "mesara", "mesarnica", "kasap", "kasapnica", "piljara",
    "zelencuk", "ovosje", "leb", "mleko", "namirnici", "grocery", "groceries", "bakery",
    "butcher", "bakal", "trafika", "kiosk", "pazar", "zelen pazar", "bitpazar", "pijaca",
  ],
  "sub-bills": [
    "struja", "elektricna", "voda", "parno", "greenje", "toplinska", "internet", "telefon",
    "mobilen", "smetka", "smetki", "kirija", "najam", "zakup", "stanarina", "kredit", "rata",
    "lizing", "zaem", "osiguruvanje", "polisa", "danok", "porez", "komunalii", "komunalna",
    "upravitel", "zgrada", "vlez", "kablovska", "tv", "rent", "utilities", "electricity", "bill",
  ],
  "sub-health": [
    "apteka", "apoteka", "ljekarna", "pharmacy", "farmacija", "lekar", "doktor", "doctor", "bolnica",
    "hospital", "klinika", "poliklinika", "ordinacija", "pregled", "stomatolog", "zabar", "zabolekar",
    "dental", "dentist", "laboratorija", "analizi", "optika", "ocila", "lekovi", "lek", "vitamini",
    "fizioterapija", "psiholog", "terapija", "medicinski", "zdravstveno",
  ],
  "sub-transport": [
    "benzin", "benzinska", "bs", "gorivo", "nafta", "dizel", "diesel", "plin", "lpg", "fuel",
    "petrol", "pumpa", "taksi", "taxi", "avtobus", "autobus", "bus", "voz", "zeleznica", "parking",
    "garaza", "patarina", "putarina", "avtoperalna", "perenje", "gumi", "registracija",
    "tehnicki pregled", "avion", "let", "airline", "karta za avtobus", "prevoz",
  ],
  "sub-shopping": [
    "obleka", "cevli", "butik", "boutique", "mall", "shop", "store", "kozmetika", "parfem",
    "parfimerija", "nakit", "zlatara", "knizarnica", "knigi", "igracki", "mebel", "mebeli",
    "elektronika", "kompjuter", "laptop", "tehnika", "online", "poracka", "podarok", "cvekjarnica",
    "cvekarnica", "drogerija", "frizer", "frizerski", "salon", "kozmeticki", "manikir",
  ],
  "sub-restaurants": [
    "restoran", "restaurant", "kafe", "kafic", "kafana", "cafe", "kafeterija", "coffee", "bar",
    "pab", "pub", "bistro", "picerija", "pizzeria", "pizza", "pica", "burger", "burek",
    "buregdzilnica", "skara", "gril", "grill", "kebap", "kebab", "cevapi", "sendvic", "sandwich",
    "slatkarnica", "poslasticarnica", "torta", "kolaci", "sladoled", "gelato", "rucek", "dorucek",
    "vecera", "lunch", "dinner", "brunch", "fast food", "dostava hrana",
  ],
  "sub-subscriptions": [
    "pretplata", "pretplati", "clenarina", "clanarina", "subscription", "premium", "membership",
    "mesecna pretplata",
  ],
  "sub-entertainment": [
    "kino", "cinema", "teatar", "theatre", "theater", "koncert", "concert", "festival", "muzej",
    "museum", "izlozba", "bilet", "bileti", "igri", "game", "games", "gaming", "kladilnica", "oblog",
    "tiket", "kazino", "casino", "teretana", "fitnes", "fitness", "gym", "bazen", "sport", "sportski",
    "hotel", "hostel", "apartman", "smestuvanje", "patuvanje", "odmor", "letuvanje", "zimuvanje",
    "bowling", "bilijard", "karaoke", "zabava", "nokjen", "klub",
  ],
  "sub-stocks": [
    "akcii", "akcija", "berza", "etf", "fond", "investicii", "investicija", "investment", "stocks",
    "trading", "broker", "penziski", "obvrznici", "bonds",
  ],
  "sub-crypto": ["kripto", "crypto", "bitcoin", "btc", "eth", "ethereum", "usdt", "solana", "coin"],
  "sub-unexpected": [
    "popravka", "servis", "kazna", "globa", "itno", "majstor", "vodoinstalater", "elektricar",
    "steta", "urgent", "emergency", "repair",
  ],
};
