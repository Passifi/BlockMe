const DEFAULT_STATE = {
  blockedSites: [],
  blockedSearches: [],
  blockStart: "",
  blockEnd: "",
};

const SEARCH_ENGINES = [
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "search.yahoo.com",
  "brave.com",
  "ecosia.org",
];

let state = { ...DEFAULT_STATE };
let stateLoaded = false;
let stateLoading = null;

function loadState() {
  stateLoading = new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_STATE, (data) => {
      state = {
        blockedSites: Array.isArray(data.blockedSites) ? data.blockedSites : [],
        blockedSearches: Array.isArray(data.blockedSearches)
          ? data.blockedSearches
          : [],
        blockStart: typeof data.blockStart === "string" ? data.blockStart : "",
        blockEnd: typeof data.blockEnd === "string" ? data.blockEnd : "",
      };
      stateLoaded = true;
      resolve(state);
    });
  });
  return stateLoading;
}

function ensureState() {
  if (stateLoaded) return Promise.resolve(state);
  if (stateLoading) return stateLoading;
  return loadState();
}

function normalizeHost(input) {
  if (!input) return "";
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    return url.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isHostBlocked(hostname) {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  return state.blockedSites.some((entry) => {
    const blocked = normalizeHost(entry);
    if (!blocked) return false;
    return host === blocked || host.endsWith(`.${blocked}`);
  });
}

function isSearchEngine(hostname) {
  const host = hostname.toLowerCase();
  return SEARCH_ENGINES.some((engine) => host === engine || host.endsWith(engine));
}

function getSearchQuery(url) {
  const params = url.searchParams;
  return (
    params.get("q") ||
    params.get("query") ||
    params.get("p") ||
    params.get("search") ||
    ""
  );
}

function parseTimeToMinutes(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isWithinBlockWindow(date = new Date()) {
  const start = parseTimeToMinutes(state.blockStart);
  const end = parseTimeToMinutes(state.blockEnd);
  if (start === null || end === null) return true;
  const current = date.getHours() * 60 + date.getMinutes();
  if (start === end) return true;
  if (start < end) {
    return current >= start && current <= end;
  }
  return current >= start || current <= end;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesBlockedTerm(query, term) {
  const cleaned = String(term).trim().toLowerCase();
  if (!cleaned) return false;
  const pattern = `\\b${escapeRegex(cleaned).replace(/\s+/g, "\\s+")}\\b`;
  const regex = new RegExp(pattern, "i");
  return regex.test(query);
}

function isSearchBlocked(url) {
  if (!state.blockedSearches.length) return false;
  if (!isSearchEngine(url.hostname)) return false;
  const query = getSearchQuery(url).toLowerCase();
  if (!query) return false;
  return state.blockedSearches.some((term) => matchesBlockedTerm(query, term));
}

function shouldIgnoreUrl(rawUrl) {
  if (!rawUrl) return true;
  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    return true;
  }
  const blockedUrl = chrome.runtime.getURL("blocked.html");
  return rawUrl.startsWith(blockedUrl);
}

function maybeRedirect(tabId, rawUrl) {
  if (shouldIgnoreUrl(rawUrl)) return;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }

  if (!isWithinBlockWindow()) return;

  let blockType = "";
  if (isHostBlocked(url.hostname)) {
    blockType = "site";
  } else if (isSearchBlocked(url)) {
    blockType = "search";
  } else {
    return;
  }

  const target = encodeURIComponent(rawUrl);
  const redirectUrl = chrome.runtime.getURL(
    `blocked.html?type=${blockType}&target=${target}`
  );
  chrome.tabs.update(tabId, { url: redirectUrl });
}

chrome.runtime.onInstalled.addListener(loadState);
chrome.runtime.onStartup.addListener(loadState);
chrome.storage.onChanged.addListener((changes) => {
  if (
    changes.blockedSites ||
    changes.blockedSearches ||
    changes.blockStart ||
    changes.blockEnd
  ) {
    loadState();
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  ensureState().then(() => maybeRedirect(details.tabId, details.url));
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  ensureState().then(() => maybeRedirect(details.tabId, details.url));
});

loadState();
