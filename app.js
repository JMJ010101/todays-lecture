// app.js : API 호출, 데이터 가공, 화면 그리기
const API_URL = "https://www.googleapis.com/youtube/v3/search";
const PLACEHOLDER_KEY = "여기에_발급받은_키";

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const orderSelect = document.getElementById("orderSelect");
const inputHint = document.getElementById("inputHint");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const emptyStateEl = document.getElementById("emptyState");

// 요청 주소 만들기 (검색어는 자동으로 인코딩된다)
function buildSearchUrl(query, order) {
  const url = new URL(API_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", query);
  url.searchParams.set("order", order);
  url.searchParams.set("relevanceLanguage", "ko");
  url.searchParams.set("maxResults", CONFIG.MAX_RESULTS);
  url.searchParams.set("key", CONFIG.YOUTUBE_API_KEY);
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

// 영상 목록 가져오기 (에러는 사용자용 문구로 바꿔 던진다)
async function fetchVideos(query, order) {
  let res;
  try {
    res = await fetch(buildSearchUrl(query, order));
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
    return parseItems(await res.json());
  } catch (err) {
    throw new Error("응답을 해석하지 못했어요. 잠시 후 다시 시도해 주세요");
  }
}

// sessionStorage에 저장된 결과 꺼내기 / 저장하기 (쿼터 절약)
function cacheKey(query, order) {
  return "lecture:" + order + ":" + query.toLowerCase();
}

function getCachedResults(query, order) {
  try {
    const saved = sessionStorage.getItem(cacheKey(query, order));
    return saved ? JSON.parse(saved) : null;
  } catch (err) {
    return null;
  }
}

function saveCachedResults(query, order, videos) {
  try {
    sessionStorage.setItem(cacheKey(query, order), JSON.stringify(videos));
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
  resultsEl.replaceChildren();
  showStatus(message, true);
}

// 영상 카드 그리기 (모든 값은 textContent로 넣는다)
function renderVideoCards(videos) {
  resultsEl.replaceChildren();
  const cards = videos.map((video) => {
    const link = document.createElement("a");
    link.className = "card";
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
    return link;
  });
  resultsEl.append(...cards);
}

// 검색 실행
async function search() {
  const query = searchInput.value.trim();
  const order = orderSelect.value;

  inputHint.textContent = "";
  if (!query) {
    resultsEl.replaceChildren();
    showStatus("");
    inputHint.textContent = "검색어를 입력해 주세요";
    searchInput.focus();
    return;
  }

  const key = (CONFIG.YOUTUBE_API_KEY || "").trim();
  if (!key || key === PLACEHOLDER_KEY) {
    showError("config.js에 API 키를 입력해 주세요");
    return;
  }

  const cached = getCachedResults(query, order);
  if (cached) {
    showResults(cached);
    return;
  }

  resultsEl.replaceChildren();
  showStatus("불러오는 중...");
  try {
    const videos = await fetchVideos(query, order);
    saveCachedResults(query, order, videos);
    // 기다리는 사이 다른 검색이 시작됐다면 이 결과는 버린다
    if (query !== searchInput.value.trim() || order !== orderSelect.value) return;
    showResults(videos);
  } catch (err) {
    showError(err.message);
  }
}

function showResults(videos) {
  if (videos.length === 0) {
    resultsEl.replaceChildren();
    showStatus("검색 결과가 없어요");
    return;
  }
  showStatus("");
  renderVideoCards(videos);
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  search();
});

// 추천 검색어를 누르면 입력창에 넣고 바로 검색
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    searchInput.value = chip.textContent;
    search();
  });
});

// 정렬을 바꾸면 검색어가 있을 때 바로 다시 검색
orderSelect.addEventListener("change", () => {
  if (searchInput.value.trim()) search();
});
