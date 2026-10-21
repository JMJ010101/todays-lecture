// app.js : API 호출, 데이터 가공, 화면 그리기
const API_URL = "https://www.googleapis.com/youtube/v3/search";
const PLACEHOLDER_KEY = "여기에_발급받은_키";

const categoryButtons = document.querySelectorAll(".category[data-query]");
const allTabs = document.querySelectorAll(".category, .favorites-tab");
const favoritesTab = document.getElementById("favoritesTab");
const favoritesCountEl = document.getElementById("favoritesCount");
const toolbarEl = document.getElementById("toolbar");
const orderSelect = document.getElementById("orderSelect");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const emptyStateEl = document.getElementById("emptyState");
const moreAreaEl = document.getElementById("moreArea");
const moreStatusEl = document.getElementById("moreStatus");
const moreButton = document.getElementById("moreButton");

// 지금 선택된 분야의 검색어 (아직 안 골랐으면 빈 문자열)
let currentQuery = "";
// 지금까지 불러온 영상과 다음 페이지를 가리키는 표시(없으면 마지막 페이지)
let page = { videos: [], nextPageToken: "" };
let isLoadingMore = false;
// 찜한 강의 목록 화면을 보고 있는지
let isFavoritesView = false;

// 찜한 강의 (브라우저에 저장돼 창을 닫아도 남는다, 최근에 찜한 순)
const FAVORITES_KEY = "lecture-favorites";
let favorites = loadFavorites();

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.filter((video) => video && typeof video.videoId === "string");
  } catch (err) {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (err) {
    // 저장 공간이 없어도 이번 접속에서는 계속 동작한다
  }
}

function isFavorite(videoId) {
  return favorites.some((video) => video.videoId === videoId);
}

function updateFavoritesCount() {
  favoritesCountEl.textContent = favorites.length;
}

// 찜하기 / 찜 해제
function toggleFavorite(video, button) {
  if (isFavorite(video.videoId)) {
    favorites = favorites.filter((item) => item.videoId !== video.videoId);
  } else {
    favorites = [video, ...favorites];
  }
  saveFavorites();
  updateFavoritesCount();
  if (isFavoritesView) {
    showFavorites();
  } else {
    button.setAttribute("aria-pressed", String(isFavorite(video.videoId)));
  }
}

// 찜한 강의 모아보기
function showFavorites() {
  isFavoritesView = true;
  currentQuery = ""; // 아직 오는 중인 검색 결과는 버린다
  page = { videos: [], nextPageToken: "" };
  updateMoreArea();
  toolbarEl.hidden = true;
  if (favorites.length === 0) {
    resultsEl.replaceChildren();
    showStatus("아직 찜한 강의가 없어요. 카드의 하트를 눌러 담아보세요");
    return;
  }
  showStatus("");
  renderVideoCards(favorites);
}

// 요청 주소 만들기 (검색어는 자동으로 인코딩된다)
function buildSearchUrl(query, order, pageToken) {
  const url = new URL(API_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", query);
  url.searchParams.set("order", order);
  url.searchParams.set("relevanceLanguage", "ko");
  url.searchParams.set("maxResults", CONFIG.MAX_RESULTS);
  url.searchParams.set("key", CONFIG.YOUTUBE_API_KEY);
  if (pageToken) url.searchParams.set("pageToken", pageToken);
  return url;
}

// HTML 문자 코드(&amp; 등)를 보통 글자로 바꾸기
function decodeHtml(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  return doc.documentElement.textContent;
}

// API 응답을 화면에 쓸 값만 골라 가공하기
function parseItems(data) {
  return (data.items || [])
    .filter((item) => item.id && item.id.videoId)
    .map((item) => ({
      videoId: item.id.videoId,
      title: decodeHtml(item.snippet.title),
      channelTitle: decodeHtml(item.snippet.channelTitle),
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.medium?.url || "",
    }));
}

// 영상 목록 한 페이지 가져오기 (에러는 사용자용 문구로 바꿔 던진다)
async function fetchVideos(query, order, pageToken) {
  let res;
  try {
    res = await fetch(buildSearchUrl(query, order, pageToken));
  } catch (err) {
    throw new Error("네트워크 연결을 확인해 주세요");
  }
  if (!res.ok) {
    if (res.status === 400) {
      throw new Error("API 키가 올바르지 않아요. config.js를 확인해 주세요");
    }
    if (res.status === 403) {
      throw new Error("오늘 사용량을 초과했거나 키 제한 설정에 걸렸어요. Cloud Console을 확인해 주세요");
    }
    throw new Error("영상을 불러오지 못했어요. 잠시 후 다시 시도해 주세요");
  }
  try {
    const data = await res.json();
    return { videos: parseItems(data), nextPageToken: data.nextPageToken || "" };
  } catch (err) {
    throw new Error("응답을 해석하지 못했어요. 잠시 후 다시 시도해 주세요");
  }
}

// sessionStorage에 저장된 결과 꺼내기 / 저장하기 (쿼터 절약)
function cacheKey(query, order) {
  return "lecture-pages:" + order + ":" + query.toLowerCase();
}

function getCachedResults(query, order) {
  try {
    const saved = sessionStorage.getItem(cacheKey(query, order));
    return saved ? JSON.parse(saved) : null;
  } catch (err) {
    return null;
  }
}

function saveCachedResults(query, order, savedPage) {
  try {
    sessionStorage.setItem(cacheKey(query, order), JSON.stringify(savedPage));
  } catch (err) {
    // 저장 공간이 없어도 검색은 계속 동작한다
  }
}

// "2024-05-01T12:00:00Z" -> "2024.05.01"
function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

// 상태 문구 표시 (isError가 true면 빨간색)
function showStatus(message, isError = false) {
  // 검색을 시작하면 처음 안내 화면은 숨긴다
  emptyStateEl.classList.add("hidden");
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

// 에러 표시: 이전 결과는 지운다
function showError(message) {
  page = { videos: [], nextPageToken: "" };
  resultsEl.replaceChildren();
  updateMoreArea();
  showStatus(message, true);
}

// 영상 카드 그리기 (모든 값은 textContent로 넣는다)
function renderVideoCards(videos, append = false) {
  if (!append) resultsEl.replaceChildren();
  const cards = videos.map((video) => {
    const card = document.createElement("article");
    card.className = "card";

    const link = document.createElement("a");
    link.className = "card-link";
    link.href = "https://www.youtube.com/watch?v=" + encodeURIComponent(video.videoId);
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (video.thumbnail) {
      const img = document.createElement("img");
      img.src = video.thumbnail;
      img.alt = "";
      img.loading = "lazy";
      thumb.appendChild(img);
    }
    link.appendChild(thumb);

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("h2");
    title.className = "card-title";
    title.textContent = video.title;

    const meta = document.createElement("p");
    meta.className = "card-meta";
    const channel = document.createElement("span");
    channel.className = "card-channel";
    channel.textContent = video.channelTitle;
    const date = document.createElement("span");
    date.textContent = formatDate(video.publishedAt);
    meta.append(channel, date);

    body.append(title, meta);
    link.appendChild(body);

    const heart = document.createElement("button");
    heart.type = "button";
    heart.className = "heart";
    heart.setAttribute("aria-label", video.title + " 찜하기");
    heart.setAttribute("aria-pressed", String(isFavorite(video.videoId)));
    heart.addEventListener("click", () => toggleFavorite(video, heart));

    card.append(link, heart);
    return card;
  });
  resultsEl.append(...cards);
}

// 선택한 분야의 첫 페이지 불러오기
async function search() {
  const query = currentQuery;
  const order = orderSelect.value;
  if (!query) return;

  const key = (CONFIG.YOUTUBE_API_KEY || "").trim();
  if (!key || key === PLACEHOLDER_KEY) {
    showError("config.js에 API 키를 입력해 주세요");
    return;
  }

  const cached = getCachedResults(query, order);
  if (cached) {
    page = cached;
    showResults();
    return;
  }

  page = { videos: [], nextPageToken: "" };
  resultsEl.replaceChildren();
  updateMoreArea();
  showStatus("불러오는 중...");
  try {
    page = await fetchVideos(query, order);
    saveCachedResults(query, order, page);
    // 기다리는 사이 다른 분야나 정렬을 골랐다면 이 결과는 버린다
    if (query !== currentQuery || order !== orderSelect.value) return;
    showResults();
  } catch (err) {
    if (query !== currentQuery || order !== orderSelect.value) return;
    showError(err.message);
  }
}

// 더보기: 다음 페이지를 불러와 목록 아래에 이어 붙이기
async function loadMore() {
  const query = currentQuery;
  const order = orderSelect.value;
  if (isLoadingMore || !page.nextPageToken) return;

  isLoadingMore = true;
  moreStatusEl.textContent = "";
  moreButton.disabled = true;
  moreButton.textContent = "불러오는 중...";
  try {
    const next = await fetchVideos(query, order, page.nextPageToken);
    // 기다리는 사이 다른 분야나 정렬을 골랐다면 이 결과는 버린다
    if (query !== currentQuery || order !== orderSelect.value) return;
    const knownIds = new Set(page.videos.map((video) => video.videoId));
    const newVideos = next.videos.filter((video) => !knownIds.has(video.videoId));
    page = { videos: [...page.videos, ...newVideos], nextPageToken: next.nextPageToken };
    saveCachedResults(query, order, page);
    renderVideoCards(newVideos, true);
  } catch (err) {
    if (query === currentQuery && order === orderSelect.value) {
      moreStatusEl.textContent = err.message;
    }
  } finally {
    isLoadingMore = false;
    updateMoreArea();
  }
}

// 더보기 버튼은 다음 페이지가 있을 때만 보인다
function updateMoreArea() {
  moreAreaEl.hidden = page.videos.length === 0 || !page.nextPageToken;
  moreButton.disabled = false;
  moreButton.textContent = "더보기";
}

function showResults() {
  moreStatusEl.textContent = "";
  if (page.videos.length === 0) {
    resultsEl.replaceChildren();
    updateMoreArea();
    showStatus("검색 결과가 없어요");
    return;
  }
  showStatus("");
  renderVideoCards(page.videos);
  updateMoreArea();
}

// 분야 버튼을 누르면 선택 표시를 옮기고 바로 불러오기
categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    isFavoritesView = false;
    toolbarEl.hidden = false;
    currentQuery = button.dataset.query;
    allTabs.forEach((other) => {
      other.setAttribute("aria-pressed", String(other === button));
    });
    search();
  });
});

// 정렬을 바꾸면 선택한 분야가 있을 때 바로 다시 불러오기
orderSelect.addEventListener("change", search);
moreButton.addEventListener("click", loadMore);

// 찜한 강의 탭
favoritesTab.addEventListener("click", () => {
  allTabs.forEach((other) => {
    other.setAttribute("aria-pressed", String(other === favoritesTab));
  });
  showFavorites();
});

updateFavoritesCount();
