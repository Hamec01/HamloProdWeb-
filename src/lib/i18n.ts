export const LOCALE_COOKIE = "hp_locale";
export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];

type Dictionary = {
  navHome: string;
  navArchive: string;
  navTracks: string;
  navArtists: string;
  navAuth: string;
  navAdmin: string;
  logout: string;
  footerLeft: string;
  footerRight: string;
  listen: string;
  playRandom: string;
  archiveEyebrow: string;
  beatsTitle: string;
  beatsDesc: string;
  tracksEyebrow: string;
  tracksTitle: string;
  tracksDesc: string;
  artistsEyebrow: string;
  artistsTitle: string;
  artistsDesc: string;
  openCase: string;
  play: string;
  pause: string;
  release: string;
  buyerAccount: string;
  buyerLogin: string;
  backToArchive: string;
  caseFile: string;
  playback: string;
  previewStream: string;
  purchase: string;
  licenseAccess: string;
  currentPrice: string;
  buyLicense: string;
  buyLicenseSoon: string;
  saleAssetsNotReady: string;
  loginForMp3: string;
  downloadMp3: string;
  preparing: string;
  mp3Unavailable: string;
  stickyPlayer: string;
  playerReady: string;
  stop: string;
};

export const dictionary: Record<Locale, Dictionary> = {
  ru: {
    navHome: "Главная",
    navArchive: "Архив",
    navTracks: "Треки",
    navArtists: "Артисты",
    navAuth: "Вход / Регистрация",
    navAdmin: "Админ",
    logout: "Выйти",
    footerLeft: "Архив / Кейс-файлы",
    footerRight: "Публичный контент только для просмотра. Управление записями в админке.",
    listen: "Слушать",
    playRandom: "Случайный бит",
    archiveEyebrow: "Архив",
    beatsTitle: "Кейсы битов",
    beatsDesc: "Материалы из архива. Основной контент загружается из Supabase.",
    tracksEyebrow: "Треки",
    tracksTitle: "Релизы HaM",
    tracksDesc: "Карточки релизов. Данные берутся из Supabase.",
    artistsEyebrow: "Артисты",
    artistsTitle: "Кейсы артистов",
    artistsDesc: "Публичные карточки артистов в режиме просмотра.",
    openCase: "Открыть кейс",
    play: "Play",
    pause: "Pause",
    release: "Релиз",
    buyerAccount: "Аккаунт",
    buyerLogin: "Вход",
    backToArchive: "Назад в архив",
    caseFile: "Кейс-файл",
    playback: "Прослушивание",
    previewStream: "Превью",
    purchase: "Покупка",
    licenseAccess: "Лицензия",
    currentPrice: "Цена",
    buyLicense: "Купить лицензию",
    buyLicenseSoon: "Скоро покупка",
    saleAssetsNotReady: "Файлы продажи не готовы",
    loginForMp3: "Вход для MP3",
    downloadMp3: "Скачать MP3",
    preparing: "Подготовка",
    mp3Unavailable: "MP3 недоступен",
    stickyPlayer: "Плеер",
    playerReady: "Плеер готов",
    stop: "Стоп",
  },
  en: {
    navHome: "Home",
    navArchive: "Archive",
    navTracks: "Tracks",
    navArtists: "Artists",
    navAuth: "Login / Sign Up",
    navAdmin: "Admin",
    logout: "Logout",
    footerLeft: "Archive / Case Files",
    footerRight: "Public content is read-only. Content management lives in admin.",
    listen: "Listen",
    playRandom: "Play Random Beat",
    archiveEyebrow: "Archive",
    beatsTitle: "Beat Files",
    beatsDesc: "Archive records. Main content is loaded from Supabase.",
    tracksEyebrow: "Tracks",
    tracksTitle: "HaM Releases",
    tracksDesc: "Release cards powered by Supabase content.",
    artistsEyebrow: "Artists",
    artistsTitle: "Artist Files",
    artistsDesc: "Public artist cards are read-only.",
    openCase: "Open Case",
    play: "Play",
    pause: "Pause",
    release: "Release",
    buyerAccount: "Buyer Account",
    buyerLogin: "Buyer Login",
    backToArchive: "Back To Archive",
    caseFile: "Case File",
    playback: "Playback",
    previewStream: "Preview Stream",
    purchase: "Purchase",
    licenseAccess: "License Access",
    currentPrice: "Current Price",
    buyLicense: "Buy License",
    buyLicenseSoon: "Buy License Soon",
    saleAssetsNotReady: "Sale Assets Not Ready",
    loginForMp3: "Login For MP3",
    downloadMp3: "Download MP3",
    preparing: "Preparing",
    mp3Unavailable: "MP3 Unavailable",
    stickyPlayer: "Sticky Player",
    playerReady: "Player Ready",
    stop: "Stop",
  },
};
