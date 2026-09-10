export const LOCALE_COOKIE = "hp_locale";
export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];

type Dictionary = {
  navHome: string;
  navArchive: string;
  navTracks: string;
  navArtists: string;
  navAuth: string;
  navProfile: string;
  navAdmin: string;
  logout: string;
  footerLeft: string;
  footerRight: string;
  listen: string;
  playRandom: string;
  playRandomTracks: string;
  randomAllFromSection: string;
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
  profileTitle: string;
  profileDesc: string;
  profileAuthRequired: string;
  profilePointsTitle: string;
  profileCurrentPoints: string;
  profileCurrentDiscount: string;
  profileNextDiscount: string;
  profileMaxDiscount: string;
  profilePurchasesTitle: string;
  profileRatingsTitle: string;
  profileNoPurchases: string;
  profileNoRatings: string;
  profilePurchasedAt: string;
  profileRatedAt: string;
  profileOpenBeat: string;
  artistAbout: string;
  artistMusic: string;
  artistNews: string;
  artistAddPost: string;
  artistAllReleases: string;
  commentsTitle: string;
  leaveComment: string;
  yourName: string;
  commentPlaceholder: string;
  submitComment: string;
  deletePost: string;
  deleteComment: string;
  noComments: string;
  starsLabel: string;
};

export const dictionary: Record<Locale, Dictionary> = {
  ru: {
    navHome: "Главная",
    navArchive: "Архив",
    navTracks: "Треки",
    navArtists: "Артисты",
    navAuth: "Вход / Регистрация",
    navProfile: "Профиль",
    navAdmin: "Админ",
    logout: "Выйти",
    footerLeft: "Архив / Кейс-файлы",
    footerRight: "Публичный контент только для просмотра. Управление записями в админке.",
    listen: "Слушать",
    playRandom: "Случайный бит",
    playRandomTracks: "Случайный трек",
    randomAllFromSection: "Все треки раздела",
    archiveEyebrow: "Архив",
    beatsTitle: "Кейсы битов",
    beatsDesc: "Материалы из архива. Основной контент — из собственной базы.",
    tracksEyebrow: "Треки",
    tracksTitle: "Релизы HaM",
    tracksDesc: "Карточки релизов. Данные — из собственной базы.",
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
    profileTitle: "Профиль пользователя",
    profileDesc: "Ваши поинты, история покупок и оценённые биты.",
    profileAuthRequired: "Войдите в аккаунт, чтобы открыть профиль.",
      profilePointsTitle: "Лояльность",
    profileCurrentPoints: "Текущие поинты",
    profileCurrentDiscount: "Текущая скидка",
    profileNextDiscount: "Следующий порог",
    profileMaxDiscount: "Максимальная скидка уже активна",
    profilePurchasesTitle: "История покупок",
    profileRatingsTitle: "Оценённые биты",
    profileNoPurchases: "Покупок пока нет.",
    profileNoRatings: "Вы ещё не оценили ни одного бита.",
    profilePurchasedAt: "Куплено",
    profileRatedAt: "Оценено",
    profileOpenBeat: "Открыть кейс",
    artistAbout: "О себе",
    artistMusic: "Вся музыка",
    artistNews: "Новости",
    artistAddPost: "Добавить новость",
    artistAllReleases: "Все релизы",
    commentsTitle: "Комментарии",
    leaveComment: "Оставить комментарий",
    yourName: "Ваше имя",
    commentPlaceholder: "Ваш комментарий...",
    submitComment: "Отправить",
    deletePost: "Удалить",
    deleteComment: "Удалить",
    noComments: "Комментариев пока нет.",
    starsLabel: "Оценка",
  },
  en: {
    navHome: "Home",
    navArchive: "Archive",
    navTracks: "Tracks",
    navArtists: "Artists",
    navAuth: "Login / Sign Up",
    navProfile: "Profile",
    navAdmin: "Admin",
    logout: "Logout",
    footerLeft: "Archive / Case Files",
    footerRight: "Public content is read-only. Content management lives in admin.",
    listen: "Listen",
    playRandom: "Play Random Beat",
    playRandomTracks: "Play Random Track",
    randomAllFromSection: "All Section Tracks",
    archiveEyebrow: "Archive",
    beatsTitle: "Beat Files",
    beatsDesc: "Archive records. Main content is served from our own database.",
    tracksEyebrow: "Tracks",
    tracksTitle: "HaM Releases",
    tracksDesc: "Release cards served from our own database.",
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
    profileTitle: "User Profile",
    profileDesc: "Your points, purchase history, and rated beats.",
    profileAuthRequired: "Sign in to open your profile.",
      profilePointsTitle: "Loyalty",
    profileCurrentPoints: "Current Points",
    profileCurrentDiscount: "Current Discount",
    profileNextDiscount: "Next Threshold",
    profileMaxDiscount: "Maximum discount is already active",
    profilePurchasesTitle: "Purchase History",
    profileRatingsTitle: "Rated Beats",
    profileNoPurchases: "No purchases yet.",
    profileNoRatings: "You have not rated any beats yet.",
    profilePurchasedAt: "Purchased",
    profileRatedAt: "Rated",
    profileOpenBeat: "Open Case",
    artistAbout: "About",
    artistMusic: "All Music",
    artistNews: "News",
    artistAddPost: "Add Post",
    artistAllReleases: "All Releases",
    commentsTitle: "Comments",
    leaveComment: "Leave a Comment",
    yourName: "Your name",
    commentPlaceholder: "Your comment...",
    submitComment: "Submit",
    deletePost: "Delete",
    deleteComment: "Delete",
    noComments: "No comments yet.",
    starsLabel: "Rating",
  },
};
